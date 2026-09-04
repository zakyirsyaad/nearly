import ngeohash from "ngeohash";

/** Presisi 7 ≈ 153 m x 153 m. Cukup kasar untuk melindungi privasi (spec §10.2). */
export const GEOHASH_PRECISION = 7 as const;

export function encodeCell(lat: number, lon: number): string {
  return ngeohash.encode(lat, lon, GEOHASH_PRECISION);
}

/**
 * 8 sel di sekeliling `cell`, tanpa `cell` itu sendiri.
 *
 * Ini penting: dua orang yang berdiri berdampingan bisa berada di sel yang
 * BERBEDA kalau mereka persis di batas sel. Tanpa toleransi tetangga,
 * handshake akan gagal secara acak di lapangan.
 */
export function neighborCells(cell: string): string[] {
  return ngeohash.neighbors(cell).filter((n) => n !== cell);
}
