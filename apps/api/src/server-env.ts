/**
 * Pembacaan env server yang cukup rawan untuk diuji sendiri (spec 6 §4.6, §4.7).
 * Murni: menerima nilai mentah, tidak membaca `process.env` sendiri.
 */

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
 * `WEB_ORIGINS` dipisah koma. Spasi dan garis miring penutup dibuang: header
 * `Origin` dari browser tidak pernah berakhiran `/`, jadi
 * `https://nearly.vercel.app/` yang tersalin dari bilah alamat tidak akan
 * pernah cocok — dan kegagalannya senyap (CORS mati tanpa pesan di server).
 */
export function bacaWebOrigins(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim().replace(/\/+$/, "")).filter((s) => s.length > 0);
}
