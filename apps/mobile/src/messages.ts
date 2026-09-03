const PESAN: Record<string, string> = {
  expired: "QR-nya sudah kedaluwarsa. Minta QR baru, lalu pindai lagi.",
  offer_not_found: "QR ini tidak dikenali. Minta dia membuka layar QR lagi.",
  offer_consumed: "QR ini sudah dipakai. Minta QR baru.",
  bad_offer_signature: "QR ini tidak sah. Minta dia membuka layar QR lagi.",
  bad_accept_signature: "Tanda tanganmu tidak sah. Coba pindai ulang.",
  nonce_used: "QR ini sudah pernah dipakai. Minta QR baru.",
  already_connected: "Kalian sudah terkoneksi. Satu koneksi berlaku selamanya.",
  quota_exceeded: "Kamu sudah mencapai batas koneksi hari ini. Lanjut besok.",
  chain_error: "Jaringan sedang tersendat. Coba lagi sebentar.",
  invalid_body: "Ada yang salah dengan permintaannya. Coba pindai ulang.",
};

export function handshakeErrorMessage(code: string, reason?: string): string {
  if (code === "not_colocated") {
    return reason === "time_too_far"
      ? "Jaraknya oke, tapi selisih waktunya terlalu lama. Pindai ulang sekarang."
      : "Kalian terlalu jauh. Handshake hanya berhasil kalau kalian benar-benar berdekatan.";
  }
  return PESAN[code] ?? "Handshake gagal. Coba lagi.";
}
