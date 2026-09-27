import { Hono } from "hono";
import { sapuLokasiAman } from "../penyapu-lokasi";
import type { RadarStore } from "../ports";

/**
 * Tugas terjadwal (2026-09-27).
 *
 * Di proses Node, sapuan lokasi ikut jalan saat API mulai (`src/index.ts`).
 * Serverless tidak punya "mulai": instans lahir dan mati per permintaan, jadi
 * janji retensi 24 jam (spec 4b+5 §4.5, R3) butuh pemicu terjadwal — cron
 * Vercel memanggil rute ini, dan `vercel.json` mendaftarkannya.
 *
 * Ini GET karena cron Vercel hanya mengirim GET, walau efeknya menulis.
 */
export function tugasRoutes(deps: {
  radar: RadarStore;
  nowMs: () => number;
  /** Tidak diisi = rute ini tidak ada. Lihat alasannya di bawah. */
  cronSecret?: string;
}) {
  const r = new Hono();

  r.get("/tugas/sapu-lokasi", async (c) => {
    // Gagal TERTUTUP, dan menjawab 404 — bukan 401 — baik saat rahasia belum
    // dikonfigurasi maupun saat tokennya salah: 401 memberi tahu penyerang
    // bahwa rute ini ada dan hanya perlu token yang benar.
    if (!deps.cronSecret) return c.body(null, 404);
    if (c.req.header("authorization") !== `Bearer ${deps.cronSecret}`) return c.body(null, 404);

    // `sapuLokasiAman` sengaja tidak pernah melempar: gagalnya sapuan bukan
    // alasan cron dianggap error dan diulang terus oleh penyedia.
    await sapuLokasiAman(deps.radar, deps.nowMs());
    return c.json({ ok: true });
  });

  return r;
}
