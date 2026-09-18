/**
 * Bentuk jamak bahasa Inggris (spec desain UI §7.4): n === 1 → tunggal,
 * selainnya jamak (termasuk 0). Tidak ada aturan jamak lain, tidak ada
 * Intl.PluralRules.
 */

/** Angka dan kata terpisah, untuk pasangan nilai/label yang diberi gaya berbeda (§7.1). */
export function pasanganJamak(n: number, tunggal: string, banyak: string): { angka: string; kata: string } {
  return { angka: String(n), kata: n === 1 ? tunggal : banyak };
}

/** "12 connections", "1 connection". */
export function jamak(n: number, tunggal: string, banyak: string): string {
  const p = pasanganJamak(n, tunggal, banyak);
  return `${p.angka} ${p.kata}`;
}
