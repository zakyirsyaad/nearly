/**
 * Hanya dua format yang benar-benar didukung ujung ke ujung: skema server
 * membatasi `mime` ke keduanya, dan `mime` ikut ditandatangani tipe
 * `LampirGambar` justru supaya tidak bisa diselewengkan.
 *
 * Berkas ini SENGAJA tidak mengimpor expo-image-picker: ia murni, jadi bisa
 * diuji tanpa modul native.
 */
export const MIME_DIDUKUNG = ["image/jpeg", "image/png"] as const;

export type MimeGambar = (typeof MIME_DIDUKUNG)[number];

/**
 * Mengembalikan mime yang boleh dikirim, atau null kalau formatnya tidak
 * didukung. TIDAK melabeli ulang.
 *
 * Bentuk lamanya `aset.mimeType === "image/png" ? "image/png" : "image/jpeg"`,
 * yang mengirim HEIC atau WebP dari galeri berlabel image/jpeg — byte-nya
 * naik, tapi gambarnya tidak akan pernah tampil. Ironisnya `mime` diikat
 * tanda tangan supaya tidak bisa diselewengkan, lalu kliennya sendiri yang
 * menyelewengkan.
 */
export function mimeGambarDiterima(mimeType: string | null | undefined): MimeGambar | null {
  const rapi = (mimeType ?? "").trim().toLowerCase();
  return (MIME_DIDUKUNG as readonly string[]).includes(rapi) ? (rapi as MimeGambar) : null;
}

export const PESAN_FORMAT_TIDAK_DIDUKUNG =
  "Format gambar itu belum didukung. Pilih berkas JPEG atau PNG.";
