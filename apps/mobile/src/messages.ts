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

const EVENT_MESSAGES: Record<string, string> = {
  not_rsvped: "RSVP dulu untuk bisa check-in di acara ini.",
  already_checked_in: "Kamu sudah check-in di acara ini.",
  already_rsvped: "Kamu sudah RSVP di acara ini.",
  event_not_live: "Check-in hanya bisa saat acara sedang berlangsung.",
  event_over: "Acara ini sudah selesai.",
  event_not_found: "Acara ini tidak ditemukan.",
  event_exists: "Acara dengan id itu sudah ada.",
  outside_geofence: "Kamu berada di luar lokasi acara. Check-in hanya bisa di venue.",
  offer_not_found: "QR check-in ini tidak dikenali. Minta host menampilkannya lagi.",
  offer_consumed: "QR check-in ini sudah terpakai. Minta host menampilkannya lagi.",
  nonce_used: "QR check-in ini sudah pernah dipakai.",
  not_host: "Hanya host acara yang bisa membuka check-in.",
  expired: "QR-nya sudah kedaluwarsa. Minta host menampilkannya lagi.",
  bad_signature: "Tanda tangan tidak cocok.",
  chain_error: "Jaringan sedang bermasalah. Coba lagi sebentar lagi.",
  invalid_body: "Ada isian yang belum benar.",
};

export function eventErrorMessage(code: string, reason?: string): string {
  if (code === "not_colocated") {
    return reason === "time_too_far"
      ? "Terlalu lama sejak QR ditampilkan. Minta host menampilkannya lagi."
      : "Kamu terlalu jauh dari host. Dekati orang yang menampilkan QR.";
  }
  return EVENT_MESSAGES[code] ?? "Gagal. Coba lagi.";
}
