import type { Tier } from "./types";

/**
 * Ambang atas RASIO terhadap skor tertinggi di graf, bukan atas skor mentah.
 *
 * Skor PageRank bersifat relatif — totalnya selalu 1. Ambang absolut pada skor
 * mentah akan menurunkan tier semua peserta serentak begitu populasi bertambah,
 * padahal tidak ada yang berubah pada mereka. Lihat test "populasi naik" di
 * compute.test.ts, yang mengunci perilaku ini.
 */
export const TIER_THRESHOLDS = [0.02, 0.15, 0.45] as const;
export const TIER_LABELS = ["Baru", "Dikenal", "Terpercaya", "Inti"] as const;

export function tierOf(ratio: number): Tier {
  if (!Number.isFinite(ratio) || ratio < TIER_THRESHOLDS[0]) return 0;
  if (ratio < TIER_THRESHOLDS[1]) return 1;
  if (ratio < TIER_THRESHOLDS[2]) return 2;
  return 3;
}
