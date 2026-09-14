/** Tanpa pustaka router: dua halaman tidak butuh satu (spec 6 §5). */

export type Halaman = "landing" | "live";

export function pilihHalaman(pathname: string): Halaman {
  return /^\/live\/?$/.test(pathname) ? "live" : "landing";
}

/** `?acara=<eventId>` — hanya 0x + 64 hex, dinormalkan huruf kecil. Selain itu null. */
export function bacaParamAcara(search: string): string | null {
  const nilai = new URLSearchParams(search).get("acara");
  return nilai && /^0x[0-9a-fA-F]{64}$/.test(nilai) ? nilai.toLowerCase() : null;
}
