import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { isAddress, type Address, type Hex } from "viem";
import {
  AttachImageRequestSchema, CreatePostRequestSchema, DeletePostRequestSchema,
  LikeRequestSchema, ReportPostRequestSchema, recoverLihatFeedSigner,
} from "@nearly/shared";
import { attachImage, createPost, deletePost, prosesUnggahGambar, reportPost, setLike } from "../feed-gate";
import { FEED_LIMIT, rankFeed } from "../feed-rank";
import type { FeedDeps } from "../ports";
import { pulihkanTandaTangan } from "../pulihkan-tanda-tangan";

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

/**
 * True HANYA kalau `who`, `expiresAt`, dan `sig` lengkap, belum kedaluwarsa,
 * dan tanda tangan LihatFeed-nya memang milik `who`. Selain itu false —
 * TIDAK PERNAH melempar dan tidak pernah jadi 4xx: rute feed tidak boleh
 * gagal untuk orang yang membuka tautan (review akhir 4a, C1).
 *
 * `recoverLihatFeedSigner` dan TIDAK PERNAH yang lain. LihatKecocokan,
 * TandaiDilihat, dan LihatBlokir berbentuk field identik `{ who, expiresAt }`;
 * kalau salah satunya diterima di sini, tanda tangan yang bocor dari layar
 * lain membuka efek blokir di feed orang itu. Kelas kesalahan Ruling 23.
 */
async function penontonTerbukti(
  q: Record<string, string>, deps: FeedDeps,
): Promise<boolean> {
  const { who, expiresAt, sig } = q;
  if (!who || !expiresAt || !sig) return false;
  if (!isAddress(who)) return false;
  if (!/^\d+$/.test(expiresAt)) return false;
  if (deps.nowMs() > Number(expiresAt) * 1000) return false;

  const signer = await pulihkanTandaTangan(() => recoverLihatFeedSigner(
    { who: who as Address, expiresAt: BigInt(expiresAt) },
    sig as Hex,
    deps.verifyingContract,
  ));
  return signer !== null && signer.toLowerCase() === who.toLowerCase();
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
      expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  /**
   * `bodyLimit` DULU, sebelum handler-nya jalan. Tanpa ini, `c.req.json()`
   * menyangga dan mengurai seluruh badan sebelum apa pun menolaknya — badan
   * 200 MB mengalokasi dua kali, mentah lalu hasil parse, dan baru sesudah
   * itu batas 2 MB diperiksa. Persis skenario yang komentar
   * MAKS_GAMBAR_BYTES di feed-gate.ts nyatakan hendak dicegah.
   *
   * 3 MB, bukan 2: base64 sekitar 4/3 ukuran aslinya, jadi 2 MB byte ≈ 2,8 MB
   * string, plus sisa badan JSON (postId, tanda tangan, mime).
   */
  const BATAS_BADAN_GAMBAR = 3 * 1024 * 1024;

  r.post("/posts/:id/image", bodyLimit({
    maxSize: BATAS_BADAN_GAMBAR,
    // Kode yang sama dengan penolakan ukuran di gerbang, supaya klien tidak
    // perlu membedakan di lapis mana badannya ditolak.
    onError: (c) => c.json({ code: "image_too_large" }, 413),
  }), async (c) => {
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
   * `?who=` punya DUA tingkat, sejak blokir (review akhir 4a, C1).
   *
   * Tanpa bukti, `who` tetap dipakai untuk URUTAN graf — seperti Fase 3b,
   * dan sengaja berbeda dari GET /events/:id?who= di Fase 3a (spec §9.3).
   * Di sana `?who=` dijaga ketat karena membocorkan NIAT seseorang berada di
   * suatu tempat dan waktu. Urutan graf hanya membocorkan kedekatan koneksi,
   * dan graf koneksi SUDAH publik on-chain di ConnectionRegistry.
   *
   * Efek BLOKIR tidak begitu. Blokir privat (spec 4a §2), dan kalau feed
   * untuk `who` tanpa bukti ikut menyaring hubungan blokir `who`, siapa pun
   * bisa membandingkan `GET /feed` dengan `GET /feed?who=A` dan membaca
   * daftar hubungan blokir A — gratis, tanpa tanda tangan, untuk alamat mana
   * pun. Karena itu efek blokir hanya untuk penonton TERBUKTI: `who` +
   * `expiresAt` + `sig` LihatFeed yang sah.
   *
   * `who` yang cacat dan bukti yang hilang/cacat/kedaluwarsa/salah tipe
   * BUKAN galat: rute ini tidak boleh gagal untuk orang yang membuka tautan.
   * `who` cacat jadi penonton anonim; bukti buruk jadi "tidak terbukti".
   */
  /**
   * Satu unggahan (layar detail, 2026-09-24). Kebijakan `who`/bukti sama
   * dengan `/feed` di bawah — termasuk "bukti cacat BUKAN galat". Bedanya:
   * unggahan yang tidak terlihat menjadi 404, karena di sini memang ada satu
   * sumber daya yang diminta, bukan daftar yang kebetulan kosong.
   */
  r.get("/posts/:id", async (c) => {
    const id = c.req.param("id");
    if (!/^0x[0-9a-fA-F]{64}$/.test(id)) return c.json({ code: "tidak_ada" }, 404);

    const q = c.req.query();
    const viewer = q.who && isAddress(q.who) ? (q.who.toLowerCase() as Address) : null;
    const terbukti = viewer !== null && await penontonTerbukti(q, deps);

    const kandidat = await deps.feed.getCandidate({ postId: id as Hex, viewer, terbukti });
    if (!kandidat) return c.json({ code: "tidak_ada" }, 404);

    // rankFeed dipakai walau isinya satu: di sanalah `terlihat()` dan
    // `imageUrlOf` hidup, jadi detail tidak bisa diam-diam menyimpang dari feed.
    const [post] = rankFeed([kandidat], {
      nowMs: deps.nowMs(),
      viewer,
      spEndpoint: deps.greenfield?.spEndpoint ?? null,
    });
    if (!post) return c.json({ code: "tidak_ada" }, 404);

    return c.json({ post });
  });

  r.get("/feed", async (c) => {
    const q = c.req.query();
    const viewer = q.who && isAddress(q.who) ? (q.who.toLowerCase() as Address) : null;
    const terbukti = viewer !== null && await penontonTerbukti(q, deps);

    const offsetMentah = Number(q.cursor);
    const offset = Number.isInteger(offsetMentah) && offsetMentah > 0
      ? Math.min(offsetMentah, MAKS_KANDIDAT)
      : 0;

    const kandidat = await deps.feed.listCandidates({
      sinceMs: deps.nowMs() - JENDELA_MS,
      limit: MAKS_KANDIDAT,
      viewer,
      terbukti,
    });

    // SELURUH jendela kandidat diperingkat sekali, lalu satu halaman dipotong
    // darinya. Bukan `limit: offset + FEED_LIMIT`: kalau limit ikut berubah
    // per halaman, jendela kandidat slot pendatang ikut bergeser, dan
    // unggahan bisa hilang dari semua halaman sekaligus muncul dua kali.
    //
    // Yang diakui spec §11.5 hanyalah PERGESERAN URUTAN akibat `kebaruan`
    // yang terus meluruh antar permintaan — bukan unggahan yang hilang atau
    // duplikat. Slot pendatang berada di indeks 5/12/20, jadi ia hanya
    // pernah muncul di halaman pertama (spec §6.6).
    const semua = rankFeed(kandidat, {
      nowMs: deps.nowMs(),
      viewer,
      spEndpoint: deps.greenfield?.spEndpoint ?? null,
      limit: MAKS_KANDIDAT,
    });
    const posts = semua.slice(offset, offset + FEED_LIMIT);

    return c.json({
      posts,
      cursor: posts.length === FEED_LIMIT ? String(offset + FEED_LIMIT) : null,
    });
  });

  return r;
}
