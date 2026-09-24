import { Hono } from "hono";
import { isAddress, type Address } from "viem";
import type { FeedDeps } from "../ports";

/**
 * Proksi avatar ENS (2026-09-24).
 *
 * Aplikasi TIDAK memuat URL avatar langsung dari HP. URL itu menunjuk ke
 * server orang lain — gateway IPFS, host pribadi, apa pun yang ditulis pemilik
 * nama ENS — dan memuatnya langsung membocorkan IP setiap penonton ke host itu,
 * yang membuat gambar profil berfungsi sebagai pelacak. Jadi gambarnya diambil
 * server, lalu dikirim ulang dari sini.
 *
 * Batas-batasnya ketat karena VPS ini kecil dan dipakai bersama proyek lain:
 * satu permintaan keluar dengan timeout, ukuran dibatasi, hanya tipe gambar
 * raster, dan cache di memori dengan jumlah entri terbatas.
 */

/** Cukup besar untuk foto profil, cukup kecil untuk tidak membebani RAM. */
export const MAKS_BAIT_AVATAR = 256 * 1024;
export const MAKS_ENTRI_CACHE = 64;
export const UMUR_CACHE_MS = 6 * 60 * 60 * 1000;
export const TIMEOUT_AMBIL_MS = 5_000;

/** SVG sengaja TIDAK diterima: ia bisa memuat skrip dan sumber daya jauh. */
const TIPE_DIIZINKAN = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

type Entri = { sampai: number; bait: Uint8Array | null; tipe: string };

export function avatarRoutes(deps: FeedDeps & { identity: { ensAvatar(a: Address): Promise<string | null> } }) {
  const r = new Hono();
  // Map biasa dipakai sebagai LRU sederhana: menyisipkan ulang memindahkan
  // kunci ke akhir, jadi entri terlama ada di awal iterasi.
  const cache = new Map<string, Entri>();

  function simpan(kunci: string, entri: Entri) {
    cache.delete(kunci);
    cache.set(kunci, entri);
    while (cache.size > MAKS_ENTRI_CACHE) {
      const terlama = cache.keys().next().value;
      if (terlama === undefined) break;
      cache.delete(terlama);
    }
  }

  r.get("/avatar/:address", async (c) => {
    const raw = c.req.param("address");
    if (!isAddress(raw)) return c.body(null, 404);
    const addr = raw.toLowerCase() as Address;

    const tersimpan = cache.get(addr);
    const kini = deps.nowMs();
    if (tersimpan && tersimpan.sampai > kini) {
      // Ketiadaan avatar ikut di-cache: tanpa itu setiap kartu orang tanpa ENS
      // memicu panggilan RPC mainnet berulang kali.
      if (!tersimpan.bait) return c.body(null, 404);
      return c.body(tersimpan.bait as unknown as ArrayBuffer, 200, {
        "content-type": tersimpan.tipe,
        "cache-control": "public, max-age=21600",
      });
    }

    const kosong = (): Response => {
      simpan(addr, { sampai: kini + UMUR_CACHE_MS, bait: null, tipe: "" });
      return c.body(null, 404);
    };

    let url: string | null = null;
    try {
      url = await deps.identity.ensAvatar(addr);
    } catch {
      // RPC mainnet tersendat bukan alasan menulis "tidak punya avatar" ke
      // cache panjang — jawab 404 sekali, biarkan permintaan berikutnya coba lagi.
      return c.body(null, 404);
    }
    if (!url || !/^https:\/\//i.test(url)) return kosong();

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_AMBIL_MS),
        redirect: "follow",
      });
      if (!res.ok) return kosong();

      const tipe = (res.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
      if (!(TIPE_DIIZINKAN as readonly string[]).includes(tipe)) return kosong();

      const panjang = Number(res.headers.get("content-length"));
      if (Number.isFinite(panjang) && panjang > MAKS_BAIT_AVATAR) return kosong();

      const bait = new Uint8Array(await res.arrayBuffer());
      // Host boleh berbohong soal content-length, jadi ukurannya diperiksa
      // lagi SETELAH badan diterima.
      if (bait.byteLength > MAKS_BAIT_AVATAR) return kosong();

      simpan(addr, { sampai: kini + UMUR_CACHE_MS, bait, tipe });
      return c.body(bait as unknown as ArrayBuffer, 200, {
        "content-type": tipe,
        "cache-control": "public, max-age=21600",
      });
    } catch {
      return c.body(null, 404);
    }
  });

  return r;
}
