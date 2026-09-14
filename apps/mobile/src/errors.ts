import { GALAT_JARINGAN } from "./messages";

/**
 * Kode kegagalan mentah dari server (spec §11.1, vouch-gate.ts dan report.ts di
 * apps/api) TIDAK PERNAH boleh mencapai layar apa adanya — snake_case Inggris
 * tidak memberi tahu pengguna apa yang terjadi atau apa yang harus dilakukan.
 * Satu tempat memetakan setiap kode ke kalimat Indonesia yang bisa ditindaklanjuti.
 */
const PESAN_GAGAL: Record<string, string> = {
  ...GALAT_JARINGAN,
  quota_exceeded: "Jatah vouch hari ini sudah habis",
  not_connected: "Vouch hanya bisa untuk orang yang sudah pernah bertemu langsung denganmu.",
  already_vouched: "Kamu sudah pernah vouch untuk orang ini.",
  not_vouched: "Belum ada vouch dari kamu untuk orang ini.",
  bad_signature: "Tanda tanganmu tidak sah. Coba lagi.",
  chain_error: "Jaringan sedang tersendat. Coba lagi sebentar.",
  self_vouch: "Tidak bisa vouch untuk dirimu sendiri.",
  expired: "Permintaan ini sudah kedaluwarsa. Coba lagi.",
  invalid_body: "Ada yang salah dengan permintaannya. Coba lagi.",
};

/** Kode yang tidak dikenal tetap dapat kalimat, bukan nama field mentah. */
export function pesanGagal(code: string): string {
  return PESAN_GAGAL[code] ?? "Terjadi kesalahan. Coba lagi.";
}
