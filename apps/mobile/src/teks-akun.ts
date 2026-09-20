/**
 * Kalimat grup tab Profile (spec desain UI §7.1): layar Profil, Koneksi,
 * Kecocokan, Dompet, dan Diblokir. Terjemahan 1:1 kalimat yang sudah ada,
 * memakai istilah terkunci §7.4.
 *
 * Bagian Koneksi/Kecocokan ditambahkan Rencana B1 Task 10, bagian
 * Dompet/Diblokir Task 11 — satu berkas supaya istilah grup ini tidak
 * bercabang antar-layar.
 */

/* Profil (tab) — app/(tabs)/(profil)/profil-saya.tsx */

export const LABEL_NAMA_TAMPILAN = "Display name";
/** Sama dengan nama yang dipakai kartu orang tanpa nama, supaya tidak ada dua kata untuk satu keadaan. */
export const PLACEHOLDER_NAMA = "Unnamed";
export const CATATAN_NAMA = "Names aren't unique. Your address always shows next to it.";

export const LABEL_VISIBILITAS = "Visibility";
export const LABEL_TERLIHAT = "Visible";
export const LABEL_TERSEMBUNYI = "Hidden";

export const TEKS_TERSIMPAN = "Saved.";
export const TEKS_GAGAL_MUAT_PROFIL_SAYA = "Couldn't load your profile.";
export const TEKS_GAGAL_SIMPAN = "Couldn't save. Try again.";

export const TAUTAN_KONEKSI = "Connections";
export const TAUTAN_KECOCOKAN = "You both want to meet";
export const TAUTAN_DOMPET = "Address, 12-word recovery phrase, and switch wallet";
export const TAUTAN_BLOKIR = "Blocked";
