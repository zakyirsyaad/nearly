import { neighborCells } from "./geohash";

/**
 * Sel geohash7 ≈153 m; pusat + 8 tetangga membentuk kotak 3x3 ≈460 m.
 * Angka ini muncul di layar buat-event, jadi ia hidup di satu tempat saja.
 */
export const GEOFENCE_SPAN_M = 460;

/**
 * Geofence sebuah event: sel tempat host berdiri, plus cincin pertama.
 *
 * Cincin pertama diikutkan karena alasan yang sama seperti di colocation.ts —
 * dua orang berdiri berdampingan bisa jatuh di sel berbeda kalau kebetulan
 * persis di garis batas. Tanpa toleransi ini, check-in akan gagal secara acak
 * bagi orang yang berdiri di pinggir ruangan.
 */
export function geofenceCells(centerCell: string): string[] {
  return [centerCell, ...neighborCells(centerCell)];
}

export function isInsideGeofence(centerCell: string, deviceCell: string): boolean {
  return geofenceCells(centerCell).includes(deviceCell);
}

/**
 * `startsAt`/`endsAt` unix DETIK (satuan yang sama dengan kontrak), `atMs`
 * MILIDETIK. Konversinya eksplisit di sini supaya tidak ada pemanggil yang
 * perlu memikirkannya.
 *
 * Kedua ujung INKLUSIF, sama dengan penjagaan di AttendanceRegistry.checkIn.
 */
export function isEventLive(startsAt: bigint, endsAt: bigint, atMs: number): boolean {
  const atSec = Math.floor(atMs / 1000);
  return atSec >= Number(startsAt) && atSec <= Number(endsAt);
}
