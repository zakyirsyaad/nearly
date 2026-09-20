import { jamak } from "./jamak";

/**
 * Teks layar Handshake (spec desain UI §6.2): terjemahan 1:1 kalimat yang ada
 * (R5) plus teks baru yang didaftar §7.3. Modul murni — diuji vitest, tidak
 * pernah ditulis langsung di JSX.
 */

/** Izin kamera — terjemahan kalimat app/scan.tsx yang ada. */
export const TEKS_IZIN_KAMERA = "Nearly needs the camera to scan the QR codes of people you meet.";
export const TEKS_TOMBOL_IZIN_KAMERA = "Allow camera";

/**
 * Teks baru §7.3, sejalan dengan NSLocationWhenInUseUsageDescription: mode QR
 * mengirim sel lokasi sendiri tiap siklus, dan itu harus terbaca di layar,
 * bukan hanya di dialog izin sistem.
 */
export const CATATAN_LOKASI_QR =
  "Approximate location is used only to confirm you're both in the same place.";

/** "Minta dia memindai ini. Berganti dalam N detik." (R5). */
export function teksHitungMundurQr(detik: number): string {
  return `Ask them to scan this. Changes in ${jamak(detik, "second", "seconds")}.`;
}

/** Galat useRotatingQr — satu-satunya kalimat yang dibuat hook itu sendiri. */
export const TEKS_GAGAL_SIAPKAN_QR = "Couldn't prepare the QR code.";

export const TEKS_BUKAN_QR_NEARLY = "This isn't a Nearly QR code.";
export const TEKS_QR_SENDIRI = "That's your own QR code.";

/**
 * Sepuluh karakter pertama + "…" — bentuk yang sudah dipakai layar pindai hari
 * ini. Bukan alamat: ini hash transaksi yang memang publik on-chain.
 */
export function potongTxHash(txHash: string): string {
  return `${txHash.slice(0, 10)}…`;
}

/** "Terkoneksi. 0x1234…" — kini baris redup di sheet berhasil (§6.2 butir 5). */
export function teksTerkoneksi(txHash: string): string {
  return `Connected. ${potongTxHash(txHash)}`;
}

/** "Check-in berhasil. 0x1234…" — tetap teks hasil di layar, bukan sheet (§6.2). */
export function teksCheckInBerhasil(txHash: string): string {
  return `Checked in. ${potongTxHash(txHash)}`;
}

export const TEKS_PINDAI_LAGI = "Scan again";

/** Tombol sheet berhasil (§7.3, #16D). */
export const TEKS_LIHAT_PROFIL = "View profile";
export const TEKS_PINDAI_ORANG_LAIN = "Scan someone else";

/** Cadangan saat galat bukan ApiError dan bukan Error — kalimat yang ada. */
export const TEKS_GAGAL_SALAMAN = "Handshake failed. Try again.";
export const TEKS_GAGAL_CHECK_IN = "Check-in failed.";
