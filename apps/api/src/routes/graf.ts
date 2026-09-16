import { Hono } from "hono";
import type { Hex } from "viem";
import { buatCacheSingkat } from "../cache-singkat";
import { corsGraf } from "../cors-graf";
import {
  alamatDiSisi, BATAS_DAFTAR_ACARA, BATAS_HALAMAN, bacaEventId, bacaSejakId, hitungHadir,
  jendelaAcaraDidukung, keAcaraPublik, keSisiPublik, potongHalaman, sisiAcara, susunSimpul,
  type AcaraPublik, type HalamanAcara, type HalamanGraf,
} from "../graf";
import type { AcaraGraf, GrafDeps, KoneksiGraf, ProfilRingkas } from "../ports";

/** Umur cache per kunci (spec 6 §4.5). */
export const UMUR_CACHE_GRAF_MS = 2000;

type Jawaban = { status: 200; body: HalamanGraf | { acara: AcaraPublik[] } };

/**
 * Hasil berat satu acara, TANPA `sejakId`: sisi acara lengkap, hitungan hadir,
 * dan profil semua alamatnya. Isinya sama untuk setiap `sejakId`, jadi
 * disimpan per `eventId` saja dan dipotong per permintaan di atasnya.
 */
type HasilAcara =
  | { jenis: "tidak-ada" }
  | { jenis: "jendela-tak-didukung" }
  | { jenis: "ada"; acara: AcaraGraf; sisi: KoneksiGraf[]; hadir: number; profil: Map<string, ProfilRingkas> };

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
  // Terpisah dari `cache` dan dikunci `eventId` saja (spec 6 §4.5): kunci per
  // `sejakId` membuat siapa pun bisa memaksa satu perhitungan penuh — acara,
  // acara beririsan, seluruh check-in, seluruh koneksi di jendela — untuk
  // setiap nilai sejakId=0..999 yang ia putar.
  const cacheAcara = buatCacheSingkat<HasilAcara>(deps.nowMs, UMUR_CACHE_GRAF_MS);

  async function hitungAcara(eventId: Hex): Promise<HasilAcara> {
    const ev = await deps.graf.acara(eventId);
    if (!ev) return { jenis: "tidak-ada" };
    // Sebelum kueri berat apa pun.
    if (!jendelaAcaraDidukung(ev)) return { jenis: "jendela-tak-didukung" };

    const beririsan = await deps.graf.acaraBeririsan(ev.startsAt, ev.endsAt);
    const acara = beririsan.some((e) => e.eventId === ev.eventId) ? beririsan : [ev, ...beririsan];
    const [checkins, koneksi] = await Promise.all([
      deps.graf.checkInAcara(acara.map((e) => e.eventId as Hex)),
      deps.graf.koneksiDalamJendela(ev.startsAt * 1000, ev.endsAt * 1000),
    ]);

    const sisi = sisiAcara(ev.eventId, koneksi, acara, checkins);
    const alamat = alamatDiSisi(sisi);
    const profil = alamat.length === 0 ? new Map<string, ProfilRingkas>() : await deps.meet.profilRingkas(alamat);
    return { jenis: "ada", acara: ev, sisi, hadir: hitungHadir(ev.eventId, checkins), profil };
  }

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

    const hasil = await cacheAcara.ambil(`acara/${eventId}`, () => hitungAcara(eventId));
    c.header("Cache-Control", "public, max-age=2");
    if (hasil.jenis === "tidak-ada") return c.json({ code: "event_not_found" }, 404);
    // 404, bukan 4xx lain: sama seperti id berbentuk salah, acara ini memang
    // tidak tersedia sebagai layar graf, dan layar /live berhenti mencoba ulang.
    if (hasil.jenis === "jendela-tak-didukung") return c.json({ code: "event_window_unsupported" }, 404);

    // Dipotong di atas hasil bersama — tanpa kueri per sejakId.
    const potong = potongHalaman(hasil.sisi.filter((k) => k.id > sejakId), sejakId);
    const body: HalamanAcara = {
      simpul: susunSimpul(alamatDiSisi(potong.sisi), hasil.profil),
      sisi: potong.sisi.map(keSisiPublik),
      kursor: potong.kursor,
      lengkap: potong.lengkap,
      acara: keAcaraPublik(hasil.acara, Math.floor(deps.nowMs() / 1000)),
      hitungan: { hadir: hasil.hadir, salaman: hasil.sisi.length },
    };
    return c.json(body, 200);
  });

  return r;
}
