import { TIER_LABELS } from "@nearly/trust";

export type TrustEvidenceView = {
  connections: number;
  occasions: number;
  regions: number;
  vouches: number;
};

export type TierView = { label: string; evidenceLine: string };

/** Spec induk §7.3: tag itu deskriptif dan positif-saja. Tidak ada tag negatif. */
export const SUGGESTED_TAGS = [
  "real builder",
  "solid dev",
  "paham zk",
  "desainer",
  "riset",
] as const;

/**
 * Tier SELALU tampil bersama buktinya (spec induk §8). Angka peringkat telanjang
 * menghidupkan lagi kecemasan ala Nosedive; fakta konkret lebih jujur dan lebih
 * berguna bagi orang yang sedang memutuskan apakah akan bicara dengan seseorang.
 */
export function tierView(tier: number, evidence: TrustEvidenceView): TierView {
  const label = TIER_LABELS[tier] ?? TIER_LABELS[0];

  const bagian: string[] = [];
  if (evidence.connections > 0) bagian.push(`${evidence.connections} koneksi`);
  if (evidence.occasions > 0) bagian.push(`${evidence.occasions} occasion`);
  if (evidence.regions > 0) bagian.push(`${evidence.regions} wilayah`);
  if (evidence.vouches > 0) bagian.push(`${evidence.vouches} vouch`);

  // "0 vouch" terbaca seperti tuduhan. Pengguna baru cukup dibilang apa adanya.
  return { label, evidenceLine: bagian.length > 0 ? bagian.join(" · ") : "belum ada koneksi" };
}
