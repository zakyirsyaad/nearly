/**
 * Teks layar Feed dan Unggahan baru (spec desain UI §7.1, §7.4): terjemahan
 * 1:1 kalimat yang sudah ada, ditambah satu teks baru "Posted." (Ruling B2-6).
 */

/* Feed — app/(tabs)/(beranda)/feed/index.tsx */

export const TEKS_TULIS_SESUATU = "Write something";
export const KOSONG_FEED = "No posts yet.";
export const TEKS_GAGAL_MUAT_FEED = "Couldn't load the feed.";
export const TEKS_GAGAL_SUKA = "Couldn't like this post.";
export const TEKS_GAGAL_LAPOR_UNGGAHAN = "Couldn't report this post.";
export const TEKS_GAGAL_HAPUS_UNGGAHAN = "Couldn't delete this post.";
export const TEKS_IZIN_GALERI = "Nearly needs photo library access to attach an image.";
export const TEKS_GAGAL_UNGGAH_GAMBAR = "Couldn't upload the image.";
export const TEKS_GAMBAR_DIUNGGAH = "Uploading image…";
export const TEKS_GAMBAR_GAGAL = "The image failed to upload.";

/** Simbol + angka yang sudah ada; tidak ada kata baru. */
export function labelSuka(sudahSuka: boolean, jumlah: number): string {
  return `${sudahSuka ? "♥" : "♡"} ${jumlah}`;
}

/** Kartu feed SELALU menandai, tidak pernah mencabut (lihat komentar di layar). */
export function labelTandaFeed(sibuk: boolean): string {
  return sibuk ? "Marking…" : "Want to meet";
}

/** Hapus tidak bisa dibatalkan, jadi butuh dua ketukan. */
export function labelHapus(konfirmasi: boolean): string {
  return konfirmasi ? "Really delete?" : "Delete";
}

export const TEKS_PILIH_ULANG_GAMBAR = "Choose the image again";

/* Unggahan baru — app/(tabs)/(beranda)/feed/new.tsx */

export const PLACEHOLDER_TULIS = "What are you building?";

export function labelGambar(ada: boolean): string {
  return ada ? "Change image" : "Add image";
}

export function labelUnggah(sibuk: boolean): string {
  return sibuk ? "Sending…" : "Post";
}

export const TEKS_TERBIT_GAMBAR_GAGAL =
  "Your text is posted, but the image failed to send. Try attaching it again later.";
export const TEKS_GAGAL_UNGGAH = "Couldn't post.";
/** Teks BARU (Ruling B2-6): §7.2 mewajibkan toast untuk unggahan terkirim. */
export const TEKS_UNGGAHAN_TERKIRIM = "Posted.";
