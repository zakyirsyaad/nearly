import { Hono } from "hono";
import type { Hex } from "viem";
import { buatCacheSingkat } from "../cache-singkat";
import { corsGraf } from "../cors-graf";
import {
  alamatDiSisi, BATAS_DAFTAR_ACARA, BATAS_HALAMAN, bacaEventId, bacaSejakId, hitungHadir,
  keAcaraPublik, keSisiPublik, potongHalaman, sisiAcara, susunSimpul,
  type AcaraPublik, type HalamanAcara, type HalamanGraf,
} from "../graf";
import type { GrafDeps, KoneksiGraf } from "../ports";

/** Umur cache per kunci (spec 6 §4.5). */
export const UMUR_CACHE_GRAF_MS = 2000;

type Jawaban =
  | { status: 200; body: HalamanGraf | HalamanAcara | { acara: AcaraPublik[] } }
  | { status: 404; body: { code: "event_not_found" } };

/**
 * Graf publik, baca-saja, tanpa autentikasi (spec 6 §4, R4). Tidak memanggil
 * `onChanged`: tidak ada yang ditulis.
 *
 * `TrustStore.loadGraph` sengaja TIDAK dipakai — ia membawa sel, blokir,
 * slash, dan vouch. Store graf memilih kolomnya sendiri, dan setiap respons
 * disusun lewat penyaring kunci di graf.ts.
 */
export function grafRoutes(deps: GrafDeps) {
  const r = new Hono();
  const cache = buatCacheSingkat<Jawaban>(deps.nowMs, UMUR_CACHE_GRAF_MS);

  r.use("/graf/*", corsGraf(deps.webOrigins));

  async function halaman(sisi: KoneksiGraf[], sejakId: number): Promise<HalamanGraf> {
    const potong = potongHalaman(sisi, sejakId);
    const alamat = alamatDiSisi(potong.sisi);
    const profil = alamat.length === 0 ? new Map() : await deps.meet.profilRingkas(alamat);
    return {
      simpul: susunSimpul(alamat, profil),
      sisi: potong.sisi.map(keSisiPublik),
      kursor: potong.kursor,
      lengkap: potong.lengkap,
    };
  }

  r.get("/graf/jaringan", async (c) => {
    const sejakId = bacaSejakId(c.req.query("sejakId"));
    if (sejakId === null) return c.json({ code: "invalid_cursor" }, 400);

    const j = await cache.ambil(`jaringan?${sejakId}`, async () => {
      // Satu lebih dari batas: satu-satunya cara jujur tahu `lengkap`.
      const sisi = await deps.graf.koneksiSejak(sejakId, BATAS_HALAMAN + 1);
      return { status: 200 as const, body: await halaman(sisi, sejakId) };
    });
    c.header("Cache-Control", "public, max-age=2");
    return c.json(j.body, j.status);
  });

  r.get("/graf/acara", async (c) => {
    const j = await cache.ambil("acara", async () => {
      const nowDetik = Math.floor(deps.nowMs() / 1000);
      const daftar = await deps.graf.daftarAcara(nowDetik, BATAS_DAFTAR_ACARA);
      return { status: 200 as const, body: { acara: daftar.map((e) => keAcaraPublik(e, nowDetik)) } };
    });
    c.header("Cache-Control", "public, max-age=2");
    return c.json(j.body, j.status);
  });

  r.get("/graf/acara/:eventId", async (c) => {
    const sejakId = bacaSejakId(c.req.query("sejakId"));
    if (sejakId === null) return c.json({ code: "invalid_cursor" }, 400);
    // id yang bentuknya saja salah pasti bukan acara — tanpa kueri.
    const eventId = bacaEventId(c.req.param("eventId"));
    if (eventId === null) return c.json({ code: "event_not_found" }, 404);

    const j = await cache.ambil(`acara/${eventId}?${sejakId}`, async (): Promise<Jawaban> => {
      const ev = await deps.graf.acara(eventId);
      if (!ev) return { status: 404, body: { code: "event_not_found" } };

      const beririsan = await deps.graf.acaraBeririsan(ev.startsAt, ev.endsAt);
      const acara = beririsan.some((e) => e.eventId === ev.eventId) ? beririsan : [ev, ...beririsan];
      const [checkins, koneksi] = await Promise.all([
        deps.graf.checkInAcara(acara.map((e) => e.eventId as Hex)),
        deps.graf.koneksiDalamJendela(ev.startsAt * 1000, ev.endsAt * 1000),
      ]);

      const semua = sisiAcara(ev.eventId, koneksi, acara, checkins);
      const h = await halaman(semua.filter((k) => k.id > sejakId), sejakId);
      const nowDetik = Math.floor(deps.nowMs() / 1000);
      return {
        status: 200,
        body: {
          ...h,
          acara: keAcaraPublik(ev, nowDetik),
          hitungan: { hadir: hitungHadir(ev.eventId, checkins), salaman: semua.length },
        },
      };
    });
    c.header("Cache-Control", "public, max-age=2");
    return c.json(j.body, j.status);
  });

  return r;
}
