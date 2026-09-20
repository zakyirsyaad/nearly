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
