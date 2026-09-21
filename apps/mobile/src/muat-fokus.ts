/**
 * Batas pemuatan layar tab saat fokus (spec desain UI §4.6): paling sering
 * sekali per 30 detik. Terpisah dari batas lencana di
 * src/lencana/lencana-tab.ts meski nilainya sama — keduanya kebijakan yang
 * berbeda, dan menyatukannya membuat perubahan salah satu diam-diam mengubah
 * yang lain.
 */
export const JEDA_MUAT_FOKUS_MS = 30_000;

/** Murni. `terakhirMs` null berarti layar belum pernah memuat. */
export function bolehMuatFokus(terakhirMs: number | null, sekarangMs: number): boolean {
  return terakhirMs === null || sekarangMs - terakhirMs >= JEDA_MUAT_FOKUS_MS;
}

/**
 * Generasi data milik pengguna ini (review B1 M7, Ruling B2-3). Naik setiap
 * kali aksi mengubah data yang ditampilkan tab LAIN — salaman, check-in,
 * acara dibuat — supaya layar itu memuat ulang saat difokuskan walau belum
 * 30 detik. Status modul, bukan konteks React: pemanggilnya komponen di tab
 * yang berbeda, dan nilainya hanya dibaca saat fokus.
 */
let generasiData = 0;

export function tandaiDataBerubah(): void {
  generasiData += 1;
}

export function generasiDataKini(): number {
  return generasiData;
}

/** Murni. `generasiDimuat` null = layar belum pernah memuat. */
export function perluMuatUlang(
  terakhirMs: number | null,
  generasiDimuat: number | null,
  sekarangMs: number,
  generasiKini: number,
): boolean {
  return generasiDimuat !== generasiKini || bolehMuatFokus(terakhirMs, sekarangMs);
}
