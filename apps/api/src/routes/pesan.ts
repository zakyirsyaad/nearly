import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { isAddress, type Address, type Hex } from "viem";
import {
  DaftarKunciPesanRequestSchema, KirimPesanRequestSchema, LaporanPesanRequestSchema,
  TandaiDibacaRequestSchema, TokenPushRequestSchema,
} from "@nearly/shared";
import type { PesanDeps } from "../ports";
import { pemanggilPesan, type RequestPesan } from "../pesan-auth";
import {
  ambilKunciLawan, daftarKunci, daftarPercakapan, kirimPesan, MAKS_HALAMAN_RIWAYAT,
  riwayatPercakapan, simpanTokenPush, tandaiPercakapanDibaca, totalBelumDibaca,
} from "../pesan-gate";
import { laporkanPesan } from "../pesan-laporan";
import { kirimPushPesan } from "../pesan-push";

const BUTUH_AUTENTIKASI = { code: "butuh_autentikasi" } as const;

/**
 * Badan dibaca sebagai TEKS satu kali — hash-nya masuk tanda tangan request —
 * lalu diurai dari teks yang sama. Mengurai lewat `c.req.json()` terpisah akan
 * membuka celah badan yang diverifikasi berbeda dari badan yang dipakai.
 */
async function bacaRequest(c: Context): Promise<RequestPesan> {
  const url = new URL(c.req.url);
  return {
    method: c.req.method,
    pathDenganQuery: url.pathname + url.search,
    badan: await c.req.text(),
    header: (nama) => c.req.header(nama),
  };
}

function uraiJson(teks: string): unknown {
  try { return JSON.parse(teks); } catch { return null; }
}

const terlaluBesar = (maxSize: number) =>
  bodyLimit({ maxSize, onError: (c) => c.json({ code: "terlalu_besar" }, 413) });

export function pesanRoutes(deps: PesanDeps) {
  const r = new Hono();

  // Satu-satunya endpoint pesan yang tidak memakai header Ed25519: di sini
  // kunci Ed25519-nya justru sedang didaftarkan, jadi yang membuktikan identitas
  // adalah tanda tangan EIP-712 dompet.
  r.post("/pesan/kunci", async (c) => {
    const parsed = DaftarKunciPesanRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    const b = parsed.data;
    const hasil = await daftarKunci({
      who: b.who as Address, kunciEnkripsi: b.kunciEnkripsi as Hex, kunciTanda: b.kunciTanda as Hex,
      expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.get("/pesan/kunci/:alamat", async (c) => {
    const pemanggil = await pemanggilPesan(await bacaRequest(c), deps);
    if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
    const lawan = c.req.param("alamat");
    if (!isAddress(lawan, { strict: false })) return c.json({ code: "invalid_address" }, 400);
    const hasil = await ambilKunciLawan(pemanggil, lawan as Address, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json(hasil.value);
  });

  r.post("/pesan", terlaluBesar(32 * 1024), async (c) => {
    const req = await bacaRequest(c);
    const pemanggil = await pemanggilPesan(req, deps);
    if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
    const parsed = KirimPesanRequestSchema.safeParse(uraiJson(req.badan));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    const b = parsed.data;

    const hasil = await kirimPesan(pemanggil, {
      id: b.id, penerima: b.penerima as Address, ciphertext: b.ciphertext, nonce: b.nonce as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);

    if (hasil.value.baru) {
      // TANPA await, dengan sengaja (spec 4c §7.1). kirimPushPesan dijamin
      // tidak pernah melempar; kirim ulang dengan id yang sama tidak memicu
      // push kedua.
      void kirimPushPesan(deps, {
        id: b.id.toLowerCase(), pengirim: pemanggil, penerima: b.penerima.toLowerCase() as Address,
      });
    }
    return c.json({ ok: true });
  });

  r.get("/pesan/percakapan", async (c) => {
    const pemanggil = await pemanggilPesan(await bacaRequest(c), deps);
    if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
    return c.json({ percakapan: await daftarPercakapan(pemanggil, deps) });
  });

  r.get("/pesan/dengan/:alamat", async (c) => {
    const pemanggil = await pemanggilPesan(await bacaRequest(c), deps);
    if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
    const lawan = c.req.param("alamat");
    if (!isAddress(lawan, { strict: false })) return c.json({ code: "invalid_address" }, 400);
    const q = c.req.query();
    const sebelumMs = q.sebelum && /^\d{1,15}$/.test(q.sebelum) ? Number(q.sebelum) : null;
    const batas = q.limit && /^\d{1,4}$/.test(q.limit) ? Number(q.limit) : MAKS_HALAMAN_RIWAYAT;
    const hasil = await riwayatPercakapan(pemanggil, lawan as Address, sebelumMs, batas, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ pesan: hasil.value });
  });

  r.post("/pesan/dengan/:alamat/dibaca", async (c) => {
    const req = await bacaRequest(c);
    const pemanggil = await pemanggilPesan(req, deps);
    if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
    const lawan = c.req.param("alamat");
    if (!isAddress(lawan, { strict: false })) return c.json({ code: "invalid_address" }, 400);
    const parsed = TandaiDibacaRequestSchema.safeParse(uraiJson(req.badan));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    const hasil = await tandaiPercakapanDibaca(pemanggil, lawan as Address, parsed.data.sampaiMs, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.get("/pesan/belum-dibaca", async (c) => {
    const pemanggil = await pemanggilPesan(await bacaRequest(c), deps);
    if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
    return c.json({ total: await totalBelumDibaca(pemanggil, deps) });
  });

  r.post("/pesan/token-push", async (c) => {
    const req = await bacaRequest(c);
    const pemanggil = await pemanggilPesan(req, deps);
    if (!pemanggil) return c.json(BUTUH_AUTENTIKASI, 401);
    const parsed = TokenPushRequestSchema.safeParse(uraiJson(req.badan));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    await simpanTokenPush(pemanggil, parsed.data.token, deps);
    return c.json({ ok: true });
  });

  // Tanpa header Ed25519: identitas pelapor dibuktikan tanda tangan `Report`
  // dompet, persis POST /report — gerbang anti-brigading bergantung padanya.
  r.post("/pesan/laporan", terlaluBesar(64 * 1024), async (c) => {
    const parsed = LaporanPesanRequestSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    const { laporan: l, bukti } = parsed.data;
    const hasil = await laporkanPesan({
      laporan: {
        reporter: l.reporter as Address, subject: l.subject as Address, reason: l.reason,
        evidence: l.evidence, expiresAt: BigInt(l.expiresAt), sig: l.sig as Hex,
      },
      bukti: bukti.map((b) => ({ pesanId: b.pesanId, isi: b.isi, dikirimMs: b.dikirimMs, tanda: b.tanda as Hex })),
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true, status: "diterima" });
  });

  return r;
}
