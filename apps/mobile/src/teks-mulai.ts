/**
 * Teks layar Mulai (spec desain UI §7.1 "Mulai", keputusan #11, #15). Tiga
 * teks baru: kalimat pembuka dan dua tombol utama; sisanya terjemahan 1:1.
 * Peringatan 12 kata tetap di src/dompet/teks-dompet.ts.
 */
export const KALIMAT_MULAI = "Know the people you've actually met";
export const TEKS_BUAT_DOMPET = "Create a new wallet";
export const TEKS_PAKAI_DOMPET = "Use an existing wallet";

/** Khusus pengembangan: tombolnya hanya dirender saat __DEV__ (spec dompet R5). */
export const TEKS_IMPOR_KUNCI_DEV = "Import private key (development only)";

/** Label sibuk semua tombol: menurunkan kunci bisa beberapa detik di HP. */
export const TEKS_MENYIAPKAN_DOMPET = "Setting up wallet…";

export const PLACEHOLDER_12_KATA = "word1 word2 word3 …";
export const TEKS_PAKAI_DOMPET_INI = "Use this wallet";
export const TEKS_KEMBALI = "Back";

export const LABEL_KUNCI_DEV = "Private key (development only)";
export const PERINGATAN_KUNCI_DEV =
  "Only for disposable test wallets. This option doesn't exist in production builds.";
export const TEKS_PAKAI_KUNCI_INI = "Use this key";
