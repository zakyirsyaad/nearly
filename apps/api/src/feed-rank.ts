import type { Address } from "viem";
import { SCORE_SCALE } from "./trust/recompute";
import { imageUrlOf, type FeedCandidate, type FeedRow } from "./ports";

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

/**
 * `0` berarti unggahan penonton sendiri, dan ia mendapat JARAK_1_HOP —
 * pengali yang sama dengan orang yang benar-benar kamu temui. Kalau ia jatuh
 * ke JARAK_LUAR, unggahan seseorang diperlakukan sebagai berasal dari luar
 * jaringannya sendiri.
 */
export function faktorJarak(hop: 0 | 1 | 2 | null): number {
  if (hop === 0 || hop === 1) return JARAK_1_HOP;
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

export const FEED_LIMIT = 30;
export const AMBANG_LAPORAN = 3;
export const SLOT_PENDATANG = [5, 12, 20] as const;
export const UMUR_PENDATANG_MS = 48 * MS_PER_JAM;

/**
 * Tahap 2 pipeline (spec §7): TERPISAH dari penilaian, bukan skor rendah.
 * Kalau visibilitas dicampur ke skor, pelaku cukup meraih skor cukup tinggi
 * untuk muncul kembali.
 */
export function terlihat(c: FeedCandidate, viewer: Address | null): boolean {
  // Menghapus harus berarti menghapus — termasuk bagi penulisnya sendiri.
  if (c.deleted) return false;

  const milikSendiri =
    viewer !== null && c.author.toLowerCase() === viewer.toLowerCase();
  // Menyembunyikan unggahan dari penulisnya sendiri hanya membingungkan
  // tanpa melindungi siapa pun.
  if (milikSendiri) return true;

  if (c.authorSlashed) return false;
  if (c.reportCount >= AMBANG_LAPORAN) return false;
  return true;
}

/**
 * Tahap 5 (spec §6.6). Batas bawah 1 koneksi WAJIB: posting terbuka untuk
 * siapa pun dan akun bot punya nol koneksi, jadi syarat "kurang dari 3" saja
 * akan menjadikan slot ini jalur cepat bagi bot.
 *
 * Ini PEMINDAHAN, bukan penyalinan. Kandidat pendatang diambil dari luar
 * top-K (indeks ≥ FEED_LIMIT), dicabut dari posisi aslinya, lalu disisipkan
 * di 5/12/20. Hasilnya permutasi dari masukan: himpunan dan panjangnya
 * persis sama.
 *
 * Bentuk lama menyalin pendatang ke depan lalu memangkas ekornya. Selama
 * feed hanya satu halaman itu tidak terlihat, tapi paginasi membuatnya
 * merusak: unggahan yang terdorong keluar hilang dari SEMUA halaman, dan
 * pendatang yang disalin muncul dua kali. Spec §11.5 mengakui pergeseran
 * urutan akibat kebaruan yang meluruh — ia tidak mengakui yang ini.
 *
 * Karena slotnya berada di indeks < FEED_LIMIT, pendatang dengan sendirinya
 * hanya muncul di halaman pertama, tanpa perlu rute tahu-menahu soal halaman.
 */
export function sisipkanPendatang(
  peringkat: FeedCandidate[], nowMs: number,
): FeedCandidate[] {
  const layak = peringkat
    .slice(FEED_LIMIT)
    .filter(
      (c) => c.authorConnections >= 1
        && c.authorConnections < 3
        && nowMs - c.createdAtMs < UMUR_PENDATANG_MS,
    )
    .slice(0, SLOT_PENDATANG.length);
  if (layak.length === 0) return peringkat;

  const dipromosikan = new Set(layak.map((c) => c.postId));
  const hasil = peringkat.filter((c) => !dipromosikan.has(c.postId));

  let i = 0;
  for (const posisi of SLOT_PENDATANG) {
    if (i >= layak.length) break;
    if (posisi > hasil.length) break;
    hasil.splice(posisi, 0, layak[i]!);
    i += 1;
  }
  return hasil;
}

function keRow(c: FeedCandidate, spEndpoint: string, viewer: Address | null): FeedRow {
  return {
    postId: c.postId,
    author: c.author,
    displayName: c.displayName,
    tier: c.authorTier,
    body: c.body,
    imageUrl: c.imageStatus === "ready"
      ? imageUrlOf(spEndpoint, c.imageBucket, c.imageObject)
      : null,
    imageStatus: c.imageStatus,
    likeCount: c.likeCount,
    sudahSuka: viewer === null ? false : c.sudahSuka,
    hop: viewer === null ? null : c.hop,
    createdAtMs: c.createdAtMs,
  };
}

/** Pemecah seri deterministik — tanpa ini urutan tidak bisa diuji. */
function bandingkan(a: { skor: number; c: FeedCandidate }, b: { skor: number; c: FeedCandidate }) {
  if (b.skor !== a.skor) return b.skor - a.skor;
  return a.c.postId.localeCompare(b.c.postId);
}

export function rankFeed(
  candidates: FeedCandidate[],
  opts: { nowMs: number; viewer: Address | null; spEndpoint: string; limit?: number },
): FeedRow[] {
  const limit = opts.limit ?? FEED_LIMIT;

  const lolos = candidates.filter((c) => terlihat(c, opts.viewer));

  const praDiversitas = lolos
    .map((c) => ({ c, skor: skorAwal(c, opts.nowMs) }))
    .sort(bandingkan);

  // `k` dihitung dari urutan PRA-diversitas, seperti author_pool_counts di
  // ranking_scorer.rs milik X: berapa unggahan penulis yang sama yang sudah
  // berada lebih tinggi SEBELUM peluruhan diterapkan.
  const terlihatKe = new Map<string, number>();
  const akhir = praDiversitas
    .map(({ c, skor }) => {
      const kunci = c.author.toLowerCase();
      const k = terlihatKe.get(kunci) ?? 0;
      terlihatKe.set(kunci, k + 1);
      return { c, skor: skor * pengaliDiversitas(k) };
    })
    .sort(bandingkan);

  // Slot pendatang disisipkan ke SELURUH peringkat lebih dulu, baru
  // dipotong. `limit` di sini hanya membatasi panjang keluaran; batas top-K
  // untuk kelayakan pendatang tetap FEED_LIMIT (spec §6.6), bukan `limit`.
  // Kalau keduanya dicampur, jendela pendatang ikut berubah tiap halaman —
  // dan itulah yang dulu menjatuhkan serta menggandakan unggahan.
  return sisipkanPendatang(akhir.map((x) => x.c), opts.nowMs)
    .slice(0, limit)
    .map((c) => keRow(c, opts.spEndpoint, opts.viewer));
}
