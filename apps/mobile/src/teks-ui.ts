/**
 * Teks antarmuka BARU yang dipakai bersama (spec desain UI §7.3), berbahasa
 * Inggris (§7.4). Kalimat lama tetap di modul asalnya dan diterjemahkan oleh
 * Rencana B.
 */

/** Tombol keadaan galat (§7.2, §7.3). */
export const TEKS_COBA_LAGI = "Try again";

/** Lencana "✓ terverifikasi" (keputusan #1, #15, R9): kamu dan orang ini sudah salaman. */
export const LENCANA_BERTEMU = "✓ met in person";

/** Lencana ringkas untuk kartu koneksi di radar (spec §6.4). */
export const LENCANA_RINGKAS = "✓";

/**
 * Huruf avatar (spec §6): huruf pertama nama yang di-trim (huruf besar); tanpa
 * nama, karakter pertama setelah "0x" (huruf besar). Array.from supaya huruf
 * di luar BMP tidak terbelah.
 */
export function hurufAvatar(nama: string | null, alamat: string): string {
  const n = nama?.trim() ?? "";
  if (n) return (Array.from(n)[0] ?? "").toUpperCase();
  const sisa = /^0x/i.test(alamat) ? alamat.slice(2) : alamat;
  return (sisa[0] ?? "?").toUpperCase();
}
