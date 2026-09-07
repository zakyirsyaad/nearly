import { Hono } from "hono";
import { isAddress, type Address, type Hex } from "viem";
import {
  AttachImageRequestSchema, CreatePostRequestSchema, DeletePostRequestSchema,
  LikeRequestSchema, ReportPostRequestSchema,
} from "@nearly/shared";
import { attachImage, createPost, deletePost, prosesUnggahGambar, reportPost, setLike } from "../feed-gate";
import { FEED_LIMIT, rankFeed } from "../feed-rank";
import type { FeedDeps } from "../ports";

/** Jendela kandidat (spec §11.6). */
const JENDELA_MS = 14 * 24 * 3_600_000;
const MAKS_KANDIDAT = 500;

/**
 * `:id` di path wajib sama dengan `postId` di badan — kalau tidak, path
 * segment itu diam-diam diabaikan dan menghasilkan bug klien yang menyakitkan
 * untuk dilacak. Case-insensitive karena id memang heksa lowercase, tapi
 * klien bisa mengirim campuran.
 */
function sameId(pathId: string, bodyId: string) {
  return pathId.toLowerCase() === bodyId.toLowerCase();
}

export function feedRoutes(deps: FeedDeps) {
  const r = new Hono();

  r.post("/posts", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = CreatePostRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);

    const b = parsed.data;
    const hasil = await createPost({
      postId: b.postId as Hex, author: b.author as Address, body: b.body,
      expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.post("/posts/:id/delete", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = DeletePostRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    if (!sameId(c.req.param("id"), parsed.data.postId)) {
      return c.json({ code: "invalid_body" }, 400);
    }

    const b = parsed.data;
    const hasil = await deletePost({
      postId: b.postId as Hex, author: b.author as Address,
      expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.post("/posts/:id/like", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = LikeRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    if (!sameId(c.req.param("id"), parsed.data.postId)) {
      return c.json({ code: "invalid_body" }, 400);
    }

    const b = parsed.data;
    const hasil = await setLike({
      postId: b.postId as Hex, who: b.who as Address, suka: b.suka,
      expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.post("/posts/:id/report", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = ReportPostRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    if (!sameId(c.req.param("id"), parsed.data.postId)) {
      return c.json({ code: "invalid_body" }, 400);
    }

    const b = parsed.data;
    const hasil = await reportPost({
      postId: b.postId as Hex, reporter: b.reporter as Address, reason: b.reason,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.post("/posts/:id/image", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = AttachImageRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    if (!sameId(c.req.param("id"), parsed.data.postId)) {
      return c.json({ code: "invalid_body" }, 400);
    }

    const b = parsed.data;
    const hasil = await attachImage({
      postId: b.postId as Hex, author: b.author as Address, mime: b.mime,
      expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex, dataBase64: b.dataBase64,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);

    // TANPA await, dengan sengaja (spec §8.2). Unggahan ke Greenfield butuh
    // hitungan detik — dua langkah, satu di antaranya transaksi on-chain di
    // chain Greenfield. Menunggunya akan membuat menulis unggahan terasa
    // macet, dan Greenfield yang mati akan ikut mematikan penulisan.
    // prosesUnggahGambar sudah dijamin tidak pernah melempar.
    void prosesUnggahGambar(
      deps, b.postId as Hex, hasil.value.objectName, b.mime, hasil.value.bytes,
    );
    return c.json({ ok: true, imageStatus: "pending" });
  });

  /**
   * TIDAK butuh tanda tangan bukti baca, sengaja berbeda dari
   * GET /events/:id?who= di Fase 3a (spec §9.3).
   *
   * Di sana `?who=` dijaga ketat karena membocorkan NIAT seseorang berada di
   * suatu tempat dan waktu — informasi yang belum terjadi dan tidak ada di
   * mana pun selain database kita. Di sini `?who=` hanya membocorkan urutan
   * berdasarkan kedekatan graf, dan graf koneksi SUDAH publik on-chain di
   * ConnectionRegistry. Memasang gerbang di sini menambah gesekan tanpa
   * menambah perlindungan.
   *
   * `who` yang cacat bukan galat: rute ini tidak boleh gagal untuk orang yang
   * membuka tautan. Ia cukup diperlakukan sebagai penonton anonim.
   */
  r.get("/feed", async (c) => {
    const q = c.req.query();
    const viewer = q.who && isAddress(q.who) ? (q.who.toLowerCase() as Address) : null;

    const offsetMentah = Number(q.cursor);
    const offset = Number.isInteger(offsetMentah) && offsetMentah > 0
      ? Math.min(offsetMentah, MAKS_KANDIDAT)
      : 0;

    const kandidat = await deps.feed.listCandidates({
      sinceMs: deps.nowMs() - JENDELA_MS,
      limit: MAKS_KANDIDAT,
      viewer,
    });

    // Peringkat dihitung ulang tiap permintaan lalu dipotong per halaman.
    // Konsekuensinya diakui di spec §11.5: unggahan bisa bergeser antar
    // halaman saat menggulir lama, karena `kebaruan` terus meluruh.
    const semua = rankFeed(kandidat, {
      nowMs: deps.nowMs(),
      viewer,
      spEndpoint: deps.greenfield.spEndpoint,
      limit: offset + FEED_LIMIT,
    });
    const posts = semua.slice(offset);

    return c.json({
      posts,
      cursor: posts.length === FEED_LIMIT ? String(offset + FEED_LIMIT) : null,
    });
  });

  return r;
}
