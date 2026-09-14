/**
 * Jeda polling dan coba ulang (spec 6 §6.2): 3 detik saat sehat; setelah
 * kegagalan beruntun 3 → 6 → 12 detik, maksimal 12; kembali 3 begitu berhasil.
 */

export const JEDA_POLLING_MS = 3_000;
export const JEDA_MAKS_MS = 12_000;

/** `gagalBeruntun` 0 berarti permintaan terakhir berhasil. */
export function jedaBerikutnya(gagalBeruntun: number): number {
  if (gagalBeruntun <= 0) return JEDA_POLLING_MS;
  return Math.min(JEDA_POLLING_MS * 2 ** (gagalBeruntun - 1), JEDA_MAKS_MS);
}
