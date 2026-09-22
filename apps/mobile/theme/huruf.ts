import { FONT } from "./globals";

/**
 * React Native tidak memilih berkas font dari `fontWeight` untuk font kustom
 * (spec desain UI §3.3). Berat diterjemahkan ke keluarga Inter yang dimuat;
 * 500 tidak dimuat (#16E) dan jatuh ke 600 (Ruling A13). Mono selalu
 * JetBrains Mono 400. Berat yang tidak dikenal memakai keluarga dasar.
 */
export function keluargaUntuk(dasar: string, berat: string | number | undefined): string {
  if (dasar === FONT.mono || berat === undefined) return dasar;
  const n = berat === "bold" ? 700 : berat === "normal" ? 400 : Number(berat);
  if (!Number.isFinite(n)) return dasar;
  if (n >= 700) return FONT.bold;
  if (n >= 500) return FONT.semibold;
  return FONT.regular;
}
