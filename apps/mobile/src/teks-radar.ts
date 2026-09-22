import { jamak, pasanganJamak } from "./jamak";
import type { KeadaanRadar } from "./messages";
import { waktuRelatif } from "./waktu";

/**
 * Teks BARU layar Radar (spec desain UI §6.4, §7.3, keputusan #10). Kalimat
 * keadaan radar yang lama tetap di src/messages.ts (KALIMAT_RADAR).
 */

/** Pil kepala: radar hanya tampil bagi pemanggil yang Terlihat (gerbang spec 4b+5). */
export const PIL_TERLIHAT = "● Visible";

/**
 * "N people visible here" dari `jumlah` respons (#10e) — BUKAN "Kamu terlihat
 * oleh N orang": server hanya tahu siapa yang terlihat olehmu.
 */
export function pasanganTerlihatDiSini(n: number): { angka: string; kata: string } {
  return pasanganJamak(n, "person visible here", "people visible here");
}

/** Jam HP saat getRadar terakhir berhasil (§6.4). */
export function teksDiperbarui(t: Date, sekarang: Date): string {
  return `Updated ${waktuRelatif(t, sekarang)}`;
}

/** #10d: setiap kartu radar memang hadir dalam 15 menit terakhir; jam detak tidak pernah dikirim. */
export const TEKS_HADIR_SEKARANG = "here now";

/** #10c: hanya angka, tanpa nama; absen atau < 1 → tidak ada teks. */
export function teksKoneksiBersama(n: number | undefined): string | null {
  if (n === undefined || n < 1) return null;
  return jamak(n, "mutual connection", "mutual connections");
}

/** Keterangan redup kartu radar: "here now" (+ " · N mutual connections" untuk yang belum ditemui). */
export function keteranganKartuRadar(k: { pernahBertemu: boolean; koneksiBersama?: number }): string {
  const bersama = k.pernahBertemu ? null : teksKoneksiBersama(k.koneksiBersama);
  return bersama ? `${TEKS_HADIR_SEKARANG} · ${bersama}` : TEKS_HADIR_SEKARANG;
}

export const JUDUL_KONEKSI_DI_SINI = "Your connections here";
export const JUDUL_BELUM_DITEMUI = "Not met yet";
export const TEKS_HANDSHAKE_KARTU = "Handshake ›";
/** Keadaan Tersembunyi → tab Profil (spec §5, dulu "Buka Profil saya"). */
export const TEKS_BUKA_PROFIL_SAYA = "Open your profile";

/** Dua bagian dari urutan server, TANPA mengurutkan ulang (§6.4). */
export function pisahKartuRadar<K extends { pernahBertemu: boolean }>(
  kartu: readonly K[],
): { koneksi: K[]; belum: K[] } {
  return {
    koneksi: kartu.filter((k) => k.pernahBertemu),
    belum: kartu.filter((k) => !k.pernahBertemu),
  };
}

const BISA_DICOBA_LAGI: ReadonlySet<KeadaanRadar> = new Set<KeadaanRadar>([
  "gagal", "server_tak_terjangkau", "sesi_tidak_sah", "izin_lokasi",
]);

/**
 * Keadaan yang mendapat "Try again" (§7.2). Keadaan lain (Tersembunyi, di luar
 * area, belum check-in, acara selesai) bukan galat — mencoba lagi tidak
 * mengubah apa pun sampai penggunanya bertindak.
 */
export function radarBisaDicobaLagi(keadaan: KeadaanRadar): boolean {
  return BISA_DICOBA_LAGI.has(keadaan);
}
