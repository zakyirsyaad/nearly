import { MIN_ALASAN_LAPORAN } from "./pesan/pesan-actions";
import { hariSama } from "./waktu";

/**
 * Teks layar Pesan (spec desain UI §6.5, §7.4): terjemahan 1:1 kalimat yang
 * sudah ada di pesan/index, pesan/[address], dan pesan/lapor/[address].
 * Teks baru hanya "🔒 end-to-end encrypted" dan label "More options" (§7.3).
 */

/* Daftar Pesan — app/(tabs)/(pesan)/pesan/index.tsx */

export const KOSONG_PESAN =
  "No conversations yet. Messages can only be sent to people you've met — open a connection's profile to start.";
export const TEKS_PESAN_TIDAK_TERVERIFIKASI = "This message can't be verified";
export const TEKS_GAGAL_MUAT_DAFTAR_PESAN = "Couldn't load conversations.";

/* Percakapan — app/(tabs)/(pesan)/pesan/[address].tsx */

export const TEKS_GAGAL_MUAT_PERCAKAPAN = "Couldn't load the conversation.";
export const TEKS_GAGAL_KIRIM_PESAN = "Couldn't send the message.";
export const JUDUL_DIALOG_BLOKIR = "Block this person?";
export const ISI_DIALOG_BLOKIR =
  "Report them first if needed — after blocking, their messages can't be selected until you unblock them.";
export const TEKS_BLOKIR = "Block";
export const PLACEHOLDER_PESAN = "Write a message";
/** Fakta spec 4c (§6.5, §7.3). */
export const TEKS_TERENKRIPSI = "🔒 end-to-end encrypted";
/** Label aksesibilitas menu ⋯ (§3.7, §7.3). */
export const LABEL_OPSI_LAIN = "More options";

/**
 * Pemisah hari di atas pesan TERLAMA pada harinya. `daftar` terbaru dulu (FlatList
 * `inverted`), jadi pesan sesudahnya di larik adalah pesan yang lebih lama.
 */
export function perluPemisahHari(daftar: readonly { createdAtMs: number }[], i: number): boolean {
  const ini = daftar[i];
  if (!ini) return false;
  const lebihLama = daftar[i + 1];
  if (!lebihLama) return true;
  return !hariSama(new Date(ini.createdAtMs), new Date(lebihLama.createdAtMs));
}

/* Lapor — app/(tabs)/(pesan)/pesan/lapor/[address].tsx */

export const PERINGATAN_LAPOR_PESAN =
  "The messages you select will be readable by reviewers. Other messages stay encrypted.";

export function labelPilihBukti(maks: number): string {
  return `Select 1–${maks} messages as evidence`;
}

export const KOSONG_BUKTI = "There are no incoming messages that can be used as evidence.";

export function placeholderAlasanLapor(): string {
  return `Reason (at least ${MIN_ALASAN_LAPORAN} characters)`;
}

export const TEKS_GAGAL_MUAT_BUKTI = "Couldn't load messages.";
export const TEKS_GAGAL_KIRIM_LAPORAN = "Couldn't send the report.";

/** Dialog tetap Alert.alert (spec §7.2, Ruling B2-7). */
export const JUDUL_LAPORAN_TERKIRIM = "Report sent";
export const ISI_LAPORAN_TERKIRIM = "Your report will be reviewed. Block this person too?";
export const TEKS_NANTI = "Later";

/** Laporannya SUDAH terkirim — jangan katakan sebaliknya. */
export function teksLaporanTerkirimGagalBlokir(alasan: string | null): string {
  return alasan ? `Report sent, but blocking failed: ${alasan}` : "Report sent, but blocking failed.";
}
