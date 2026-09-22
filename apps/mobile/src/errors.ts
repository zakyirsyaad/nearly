import { GALAT_JARINGAN } from "./messages";

/**
 * Kode kegagalan mentah dari server (spec §11.1, vouch-gate.ts dan report.ts di
 * apps/api) TIDAK PERNAH boleh mencapai layar apa adanya — snake_case Inggris
 * tidak memberi tahu pengguna apa yang terjadi atau apa yang harus dilakukan.
 * Satu tempat memetakan setiap kode ke kalimat Inggris yang bisa ditindaklanjuti.
 */
const PESAN_GAGAL: Record<string, string> = {
  ...GALAT_JARINGAN,
  quota_exceeded: "You've used up today's vouches.",
  not_connected: "You can only vouch for someone you've met in person.",
  already_vouched: "You've already vouched for this person.",
  not_vouched: "You haven't vouched for this person.",
  bad_signature: "Your signature isn't valid. Try again.",
  chain_error: "The network is congested. Try again in a moment.",
  self_vouch: "You can't vouch for yourself.",
  expired: "This request has expired. Try again.",
  invalid_body: "Something was wrong with the request. Try again.",
};

/** Kode yang tidak dikenal tetap dapat kalimat, bukan nama field mentah. */
export function pesanGagal(code: string): string {
  return PESAN_GAGAL[code] ?? "Something went wrong. Try again.";
}
