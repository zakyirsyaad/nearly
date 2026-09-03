import { neighborCells } from "./geohash.js";

/** Toleransi waktu ko-lokasi (spec §7.1 langkah 4): ±120 detik. */
export const COLOCATION_WINDOW_MS = 120_000;

export type LocationClaim = { cell: string; at: number };

export type ColocationResult =
  | { ok: true }
  | { ok: false; reason: "cell_too_far" | "time_too_far" };

/**
 * Apakah dua klaim lokasi cukup untuk menyimpulkan kedua orang berada di
 * tempat yang sama? Ini penentu tunggal untuk seluruh premis produk (spec §2).
 *
 * Sel tetangga diterima karena dua orang yang berdiri berdampingan bisa jatuh
 * di sel geohash yang berbeda saat mereka persis di batas sel.
 */
export function verifyColocation(a: LocationClaim, b: LocationClaim): ColocationResult {
  const sameArea = a.cell === b.cell || neighborCells(a.cell).includes(b.cell);
  if (!sameArea) return { ok: false, reason: "cell_too_far" };

  if (Math.abs(a.at - b.at) > COLOCATION_WINDOW_MS) {
    return { ok: false, reason: "time_too_far" };
  }
  return { ok: true };
}
