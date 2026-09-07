import { SCORE_SCALE } from "./trust/recompute";
import type { FeedCandidate } from "./ports";

// Semua konstanta di bawah MENGIKAT ke spec §6.1 dan dikunci tes. Mengubah
// satu angka wajib disertai mengubah spec — bukan diam-diam.
export const BOBOT_TRUST = 0.5;
export const BOBOT_SUKA = 0.2;
export const BOBOT_BARU = 0.3;

export const JARAK_1_HOP = 1.0;
export const JARAK_2_HOP = 0.6;
export const JARAK_LUAR = 0.3;

export const PARUH_WAKTU_JAM = 24;
export const SUKA_JENUH = 50;

export const DIVERSITAS_PELURUHAN = 0.5;
export const DIVERSITAS_LANTAI = 0.25;

const MS_PER_JAM = 3_600_000;

/**
 * Dipakai memakai SCORE_SCALE yang SUDAH ADA (terkunci ke TrustAttestor.sol),
 * bukan konstanta baru. Pembaginya menormalkan hasil ke [0,1].
 */
const NORMALISASI = Math.log1p(SCORE_SCALE);

/**
 * Spec §6.3. Tanpa kompresi ini, peluruhan diversitas tidak berfungsi:
 * peluruhan bekerja secara perkalian, dan rasio PageRank timpang sampai
 * ribuan kali lipat, sehingga 0.5^5 pun tidak menurunkan penulis teratas.
 *
 * `log1p`, bukan `log`, supaya rasio nol menghasilkan nol dan bukan -Infinity.
 */
export function basisTrust(rasio: number): number {
  if (!Number.isFinite(rasio) || rasio <= 0) return 0;
  return Math.log1p(rasio * SCORE_SCALE) / NORMALISASI;
}

export function faktorJarak(hop: 1 | 2 | null): number {
  if (hop === 1) return JARAK_1_HOP;
  if (hop === 2) return JARAK_2_HOP;
  return JARAK_LUAR;
}

export function faktorKebaruan(createdAtMs: number, nowMs: number): number {
  // Jam perangkat bisa mundur; umur negatif tidak boleh meledakkan skor.
  const umurJam = Math.max(0, (nowMs - createdAtMs) / MS_PER_JAM);
  return Math.pow(0.5, umurJam / PARUH_WAKTU_JAM);
}

export function faktorSuka(likeCount: number): number {
  if (!Number.isFinite(likeCount) || likeCount <= 0) return 0;
  return Math.min(1, Math.log1p(likeCount) / Math.log1p(SUKA_JENUH));
}

export function skorAwal(c: FeedCandidate, nowMs: number): number {
  const isi =
    BOBOT_TRUST * basisTrust(c.authorRatio)
    + BOBOT_SUKA * faktorSuka(c.likeCount)
    + BOBOT_BARU * faktorKebaruan(c.createdAtMs, nowMs);
  return isi * faktorJarak(c.hop);
}

/**
 * Diambil dari home-mixer/scorers/ranking_scorer.rs milik X:
 * `(1 - lantai) * peluruhan^k + lantai`, dengan k = jumlah unggahan penulis
 * yang sama yang sudah berada lebih tinggi. Lantai menjaga penulis rajin
 * tidak dihilangkan — hanya tidak boleh menguasai.
 */
export function pengaliDiversitas(k: number): number {
  return (1 - DIVERSITAS_LANTAI) * Math.pow(DIVERSITAS_PELURUHAN, k) + DIVERSITAS_LANTAI;
}
