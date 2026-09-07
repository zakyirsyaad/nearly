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

const FEED_MESSAGES: Record<string, string> = {
  post_exists: "Unggahan dengan id itu sudah ada. Coba tulis ulang.",
  post_not_found: "Unggahan ini sudah tidak ada.",
  not_author: "Hanya penulisnya yang bisa mengubah unggahan ini.",
  image_slot_taken: "Unggahan ini sudah punya gambar. Satu gambar per unggahan.",
  image_too_large: "Gambarnya terlalu besar. Maksimal 2 MB.",
  bad_signature: "Tanda tangan tidak cocok. Coba lagi.",
  expired: "Permintaannya sudah kedaluwarsa. Coba lagi.",
  invalid_body: "Ada isian yang belum benar.",
};

export function feedErrorMessage(code: string): string {
  return FEED_MESSAGES[code] ?? "Gagal. Coba lagi sebentar.";
}

/**
 * Baris alasan di setiap kartu feed (spec §10.3). Spec induk §8 memegang
 * prinsip bahwa peringkat tidak pernah tampil telanjang — selalu bersama
 * buktinya. Feed yang tidak bisa menjelaskan dirinya melanggar prinsip itu.
 */
export function alasanMuncul(hop: 0 | 1 | 2 | null, displayName: string): string {
  // 0 berarti unggahanmu sendiri. Tanpa cabang ini, unggahan sendiri tiba
  // dengan hop null dan kartunya memberi tahu penulisnya bahwa unggahannya
  // sendiri berada di luar jaringannya sendiri.
  if (hop === 0) return "Unggahanmu.";
  const nama = displayName.trim() || "orang ini";
  if (hop === 1) return `Kamu pernah bertemu ${nama}.`;
  if (hop === 2) return `Kenalanmu pernah bertemu ${nama}.`;
  return "Di luar jaringanmu.";
}
