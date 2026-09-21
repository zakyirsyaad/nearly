import { isEventLive } from "@nearly/shared";

type BerWaktu = { startsAt: string; endsAt: string };

/** `startsAt`/`endsAt` = detik unix sebagai string (bentuk kawat EventSummary). */
export function acaraLive(a: BerWaktu, sekarangMs: number): boolean {
  return isEventLive(BigInt(a.startsAt), BigInt(a.endsAt), sekarangMs);
}

/**
 * Acara LIVE di atas daftar (spec desain UI §7.1). Urutan server dipertahankan
 * di dalam kedua kelompok — layar tidak mengarang urutan sendiri.
 */
export function liveDulu<T extends BerWaktu>(acara: readonly T[], sekarangMs: number): T[] {
  const live: T[] = [];
  const lain: T[] = [];
  for (const a of acara) (acaraLive(a, sekarangMs) ? live : lain).push(a);
  return [...live, ...lain];
}
