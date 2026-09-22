/**
 * Pembacaan env server yang cukup rawan untuk diuji sendiri (spec 6 §4.6, §4.7).
 * Murni: menerima nilai mentah, tidak membaca `process.env` sendiri.
 */
import { isIP } from "node:net";

export const PORT_BAWAAN = 8787;

/** Kosong atau tidak ada → 8787. Selain bilangan bulat 1–65535 → melempar. */
export function bacaPort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return PORT_BAWAAN;
  const t = raw.trim();
  const n = Number(t);
  if (!/^\d+$/.test(t) || !Number.isInteger(n) || n < 1 || n > 65535) {
    throw new Error(`env PORT tidak sah: "${raw}" (harus bilangan bulat 1–65535)`);
  }
  return n;
}

/**
 * Antarmuka tempat API mendengarkan (spec distribusi D13). Kosong atau tidak ada
 * → undefined = semua antarmuka, supaya HP di Wi-Fi yang sama bisa menjangkau
 * laptop saat pengembangan. Di VPS bersama nilainya 127.0.0.1: hanya nginx di
 * mesin yang sama yang bisa memanggil API, tanpa bergantung pada firewall.
 * Selain alamat IP → melempar (nama host seperti "localhost" bisa berarti ::1
 * atau 127.0.0.1 tergantung sistem, jadi ditolak supaya tidak menebak).
 */
export function bacaHost(raw: string | undefined): string | undefined {
  if (raw === undefined || raw.trim() === "") return undefined;
  const t = raw.trim();
  if (isIP(t) === 0) throw new Error(`env HOST tidak sah: "${raw}" (harus alamat IP, mis. 127.0.0.1)`);
  return t;
}

/**
 * `WEB_ORIGINS` dipisah koma. Spasi dan garis miring penutup dibuang: header
 * `Origin` dari browser tidak pernah berakhiran `/`, jadi
 * `https://nearly.vercel.app/` yang tersalin dari bilah alamat tidak akan
 * pernah cocok — dan kegagalannya senyap (CORS mati tanpa pesan di server).
 */
export function bacaWebOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim().replace(/\/+$/, "")).filter((s) => s.length > 0);
}
