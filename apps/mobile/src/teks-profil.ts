import { jamak, pasanganJamak } from "./jamak";
import { formatTanggal } from "./waktu";

/**
 * Bentuk kawat dua medan baru GET /profile/:address (spec desain UI §8.1,
 * §8.2) dan setiap kalimat layar Profil orang (§6.3). Tipe dan kalimat yang
 * membacanya sengaja satu berkas: keduanya bisa diuji tanpa merender apa pun
 * (Ruling B1-8).
 *
 * Kedua medan hanya ada di cabang TERBUKTI, dan ABSEN (bukan 0/null) bila
 * store di server gagal — absen berarti "tidak diketahui", dan mengarang
 * angka dari kegagalan adalah kebohongan tentang orang lain.
 */

export type AcaraPertemuan = { eventId: string; title: string; venueLabel: string };
/** `startsAt` = detik unix sebagai string, bentuk yang sama dengan acara lain di API. */
export type AcaraBersama = AcaraPertemuan & { startsAt: string };

export type Pertemuan = {
  salaman: { atMs: number; acara: AcaraPertemuan | null };
  /** Maks. 10, terbaru dulu, TANPA acara salaman di atas. */
  acaraBersama: AcaraBersama[];
  jumlahAcaraBersama: number;
};

export const JUDUL_TRUST = "Trust";
export const JUDUL_PERTEMUAN = "Meetings";
export const JUDUL_ONCHAIN = "On-chain details";

/**
 * R8: "jumlah kali" adalah jumlah acara yang KALIAN BERDUA hadiri. Acara
 * tempat salaman terjadi sengaja tidak masuk `acaraBersama`, jadi menghitung
 * panjang larik saja akan kehilangan satu (Ruling B1-9).
 */
export function jumlahAcaraBersamaTotal(p: Pertemuan): number {
  return p.jumlahAcaraBersama + (p.salaman.acara ? 1 : 0);
}

/** Ekor lencana "✓ met in person · N events together"; tanpa acara → tanpa ekor. */
export function ekorLencanaPertemuan(p: Pertemuan | null | undefined): string | undefined {
  if (!p) return undefined;
  const n = jumlahAcaraBersamaTotal(p);
  return n < 1 ? undefined : ` · ${jamak(n, "event together", "events together")}`;
}

/**
 * Baris salaman di kartu Meetings. Tempat hanya nama acara + venueLabel yang
 * ditulis host (R7) — sel lokasi tidak pernah dikirim ke HP.
 */
export function barisSalaman(p: Pertemuan, sekarang: Date): { judul: string; tanggal: string } {
  const a = p.salaman.acara;
  const tempat = a?.venueLabel.trim() ?? "";
  return {
    judul: a ? `Handshake at ${a.title}${tempat ? ` · ${tempat}` : ""}` : "Met in person",
    tanggal: formatTanggal(new Date(p.salaman.atMs), sekarang),
  };
}

export function barisAcaraBersama(a: AcaraBersama, sekarang: Date): string {
  const tanggal = formatTanggal(new Date(Number(a.startsAt) * 1000), sekarang);
  return `Both attended · ${a.title} · ${tanggal}`;
}

/**
 * Spec §8.2. `undefined` (store gagal) dan `0` sama-sama tidak menampilkan
 * baris: nol bukan fakta yang perlu dipamerkan, dan absen bukan nol.
 */
export function teksDijaminKenalan(jumlah: number | undefined): string | null {
  if (jumlah === undefined || jumlah < 1) return null;
  return `Vouched for by ${jamak(jumlah, "person you know", "people you know")}`;
}

/** Kartu On-chain details: nilai lebih keras dari labelnya (§7.1, #16A). */
export function pasanganKoneksi(n: number): { angka: string; kata: string } {
  return pasanganJamak(n, "connection", "connections");
}

export function pasanganTransaksi(n: number): { angka: string; kata: string } {
  return pasanganJamak(n, "on-chain transaction", "on-chain transactions");
}

/* Kalimat layar — terjemahan 1:1 kalimat yang sudah ada di app/profile/[address].tsx. */

export const TEKS_GAGAL_MUAT_PROFIL =
  "Couldn't load this profile. Check your connection, then try again.";

export const TEKS_SALING_INGIN_BERTEMU = "You both want to meet.";

export const TEKS_KIRIM_PESAN = "Send message";

export const TEKS_GAGAL_MENANDAI = "Couldn't save that. Try again.";

/**
 * Tandanya SUDAH tersimpan di server pada titik ini — kegagalan memuat ulang
 * adalah kegagalan yang BERBEDA, dan kalimatnya tidak boleh mengaku aksinya
 * gagal.
 */
export const TEKS_TANDA_TERSIMPAN_GAGAL_MUAT =
  "Your mark was saved, but the profile failed to reload. Reload this screen to see the latest numbers.";

export function teksGagalBlokir(akanMencabut: boolean): string {
  return akanMencabut ? "Couldn't unblock." : "Couldn't block.";
}

export function teksBlokirTersimpanGagalMuat(akanMencabut: boolean): string {
  return akanMencabut
    ? "The block was removed, but the profile failed to reload. Reload this screen to see the latest status."
    : "This person is blocked, but the profile failed to reload. Reload this screen to see the latest status.";
}

export const TEKS_CATATAN_DIBLOKIR =
  "You blocked this person. You won't appear in each other's feed, and you can't mark each other.";

export const TEKS_VOUCH = "Vouch";

/** Server-lah yang tahu sisa kuota; layar hanya menyebut batasnya. */
export const TEKS_KUOTA_VOUCH = "Up to 3 vouches a day.";

export function labelKirimVouch(sibuk: boolean): string {
  return sibuk ? "Sending…" : "Send vouch";
}

export const TEKS_VOUCH_TERKIRIM = "Vouch sent.";

export const TEKS_LAPOR = "Report";
export const TEKS_LABEL_ALASAN = "Reason for the report";
export const TEKS_SELESAI = "Done";
export const TEKS_PLACEHOLDER_ALASAN = "Tell us what happened";

export function labelKirimLaporan(sibuk: boolean): string {
  return sibuk ? "Sending…" : "Send report";
}

/**
 * Bukan hiasan: kalimat ini mencegah pengguna mengira Report adalah senjata
 * yang menurunkan skor orang lain (spec induk §6).
 */
export const TEKS_LAPORAN_DITERIMA =
  "Report received. Reports don't lower anyone's score — they trigger a review.";
