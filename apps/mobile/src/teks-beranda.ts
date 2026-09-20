import { pasanganJamak } from "./jamak";

/**
 * Teks Beranda (spec desain UI §6.1). Seluruhnya ada di daftar teks baru yang
 * diizinkan §7.3, kecuali KOSONG_KONEKSI yang merupakan terjemahan kalimat
 * kosong yang sudah ada di layar Koneksi.
 */

export const JUDUL_RECENTLY_MET = "Recently met";
export const JUDUL_FEED = "Feed";

export const TEKS_LIHAT_SEMUA = "See all ›";
export const TEKS_BUKA_RADAR = "Open radar ›";
export const TEKS_BUKA_ACARA = "Open event ›";
export const TEKS_BUKA_DOMPET = "Open Wallet ›";

export const TEKS_LIVE = "● LIVE";
export const TEKS_SUDAH_CHECK_IN = "You're checked in";

/**
 * "N checked in" dengan angka terpisah dari katanya: nilai tampil lebih keras
 * daripada labelnya (§7.1, #16A). Bentuk tunggal dan jamaknya sama — "1
 * checked in" sudah benar dalam bahasa Inggris.
 */
export function pasanganCheckIn(n: number): { angka: string; kata: string } {
  return pasanganJamak(n, "checked in", "checked in");
}

/** Tombol Copy alamat sendiri (#16C). Labelnya menyebut APA yang disalin (§3.7). */
export const TEKS_SALIN = "Copy";
export const LABEL_SALIN_ALAMAT = "Copy address";
export const TEKS_ALAMAT_DISALIN = "Address copied";

/**
 * Terjemahan kalimat kosong layar Koneksi yang sudah ada. Dipakai Beranda
 * (bagian "Recently met") DAN layar Koneksi — satu kalimat, dua tempat, supaya
 * keduanya tidak mulai mengajarkan hal yang berbeda tentang cara berkoneksi.
 */
export const KOSONG_KONEKSI =
  "No connections yet. Connections can only be made by meeting in person.";

/** Aksi keadaan kosong itu: membuka tab Handshake (§7.2). */
export const TEKS_AKSI_HANDSHAKE = "Handshake";
