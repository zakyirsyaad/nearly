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

/* Koneksi dan Kecocokan — app/(tabs)/(profil)/{connections,kecocokan}.tsx */

/** Terjemahan lencana `lencanaKartuRadar` yang ada, tanpa titik (teks lencana). */
export const LENCANA_SALING_INGIN_BERTEMU = "You both want to meet";

export const KOSONG_KECOCOKAN =
  "No one has matched with you yet. Mark the people you want to meet — if they mark you back, you'll both know.";

export const TEKS_GAGAL_KECOCOKAN = "Couldn't load your matches.";

/* Dompet — app/(tabs)/(profil)/dompet.tsx */

export const LABEL_ALAMAT = "Address";
export const TEKS_BAGIKAN_ALAMAT = "Share address";
export const CATATAN_ALAMAT =
  "Your address is safe to share, for example with organizers for a seed list. What you must never share with anyone is your 12-word recovery phrase.";

export const LABEL_12_KATA = "12-word recovery phrase";
export const TEKS_LIHAT_12_KATA = "Show 12-word recovery phrase";
export const TEKS_SUDAH_DICATAT = "I've written them down";
export const TEKS_CATATAN_TERSIMPAN = "Saved. Keep your note somewhere safe and offline.";

export const LABEL_GANTI_DOMPET = "Switch wallet";
export const CATATAN_GANTI_DOMPET =
  "Deletes this wallet from the phone, then returns to the Get started screen.";

export function labelGantiDompet(sibuk: boolean): string {
  return sibuk ? "Deleting…" : LABEL_GANTI_DOMPET;
}

/** Dialog konfirmasi tetap Alert.alert (spec §7.2); hanya kalimatnya diterjemahkan. */
export const JUDUL_DIALOG_12_KATA = "Show your 12-word recovery phrase?";
export const JUDUL_DIALOG_GANTI = "Switch wallet?";
export const TEKS_BATAL = "Cancel";
export const TEKS_TAMPILKAN = "Show";
export const TEKS_HAPUS_DOMPET = "Delete wallet from this phone";

/* Diblokir — app/(tabs)/(profil)/blokir.tsx */

export const KOSONG_BLOKIR =
  "You haven't blocked anyone. You can block someone from their profile.";
export const TEKS_GAGAL_MUAT_BLOKIR = "Couldn't load your block list.";
/** Pencabutannya SUDAH tersimpan — kalimat ini tidak boleh mengaku aksinya gagal. */
export const TEKS_BLOKIR_DICABUT_GAGAL_MUAT =
  "The block was removed, but the list failed to reload.";

