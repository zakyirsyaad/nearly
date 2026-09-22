import { TIER_LABELS } from "@nearly/trust";
import { jamak } from "./jamak";

export type TrustEvidenceView = {
  connections: number;
  occasions: number;
  regions: number;
  vouches: number;
};

export type TierView = { label: string; evidenceLine: string };

/**
 * Label tier yang TAMPIL (spec desain UI §7.4, keputusan #15). `TIER_LABELS`
 * bahasa Indonesia di packages/trust tetap nilai kawat API (`tierLabel`) dan
 * kunci graf /live — kode internal, tidak pernah dirender. Hanya berkas ini
 * yang mengimpornya (dijaga test/tier.test.ts).
 */
export const LABEL_TIER_EN = ["New", "Known", "Trusted", "Core"] as const;
export type LabelTierEn = (typeof LABEL_TIER_EN)[number];

/** Jumlah ruas batang trust (spec §6, keputusan #10f). */
export const JUMLAH_RUAS_TRUST = 4;

/** Tier 0–3 → label Inggris; di luar jangkauan → "New". */
export function labelTier(tier: number): LabelTierEn {
  return LABEL_TIER_EN[tier] ?? "New";
}

/** Label kawat Indonesia (radar, Pesan) → tier. Tak dikenal → 0. */
export function tierDariLabel(label: string): number {
  const i = (TIER_LABELS as readonly string[]).indexOf(label);
  return i < 0 ? 0 : i;
}

/** Label aksesibilitas BatangTrust: "Trust: Trusted" (spec §3.7, §6). */
export function labelAksesTrust(tier: number): string {
  return `Trust: ${labelTier(tier)}`;
}

/** Ruas terisi: New = 1, Known = 2, Trusted = 3, Core = 4. */
export function ruasTerisiTrust(tier: number): number {
  return LABEL_TIER_EN.indexOf(labelTier(tier)) + 1;
}

/**
 * Spec induk §7.3: tag itu deskriptif dan positif-saja. Tidak ada tag negatif.
 * Tag adalah isi yang ditandatangani (`tagsHash`): tag lama yang tercatat
 * tampil apa adanya (spec desain UI §7.4, §11 batas #15).
 */
export const SUGGESTED_TAGS = [
  "real builder",
  "solid dev",
  "knows zk",
  "designer",
  "research",
] as const;

/**
 * Tier SELALU tampil bersama buktinya (spec induk §8). Angka peringkat telanjang
 * menghidupkan lagi kecemasan ala Nosedive; fakta konkret lebih jujur dan lebih
 * berguna bagi orang yang sedang memutuskan apakah akan bicara dengan seseorang.
 */
export function tierView(tier: number, evidence: TrustEvidenceView): TierView {
  const bagian: string[] = [];
  if (evidence.connections > 0) bagian.push(jamak(evidence.connections, "connection", "connections"));
  if (evidence.occasions > 0) bagian.push(jamak(evidence.occasions, "occasion", "occasions"));
  if (evidence.regions > 0) bagian.push(jamak(evidence.regions, "region", "regions"));
  if (evidence.vouches > 0) bagian.push(jamak(evidence.vouches, "vouch", "vouches"));

  // "0 vouches" terbaca seperti tuduhan. Pengguna baru cukup dibilang apa adanya.
  return { label: labelTier(tier), evidenceLine: bagian.length > 0 ? bagian.join(" · ") : "no connections yet" };
}
