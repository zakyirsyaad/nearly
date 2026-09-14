import { MAKS_ISI_PESAN } from "@nearly/shared";

/**
 * Kalimat untuk `server_tak_terjangkau` — dilempar `req` (src/http.ts) saat
 * server tidak menjawab dalam batas waktu atau jaringan gagal. Satu kalimat
 * untuk semua domain: masalahnya koneksi, bukan aksi yang sedang dilakukan,
 * jadi tiap layar tidak perlu mengarang versinya sendiri.
 */
export const KALIMAT_SERVER_TAK_TERJANGKAU =
  "Server Nearly tidak bisa dihubungi. Periksa koneksi internetmu, lalu coba lagi.";

/** Disebar ke setiap peta galat supaya tidak ada yang jatuh ke kalimat umum. */
export const GALAT_JARINGAN: Record<string, string> = {
  server_tak_terjangkau: KALIMAT_SERVER_TAK_TERJANGKAU,
};

const PESAN: Record<string, string> = {
  ...GALAT_JARINGAN,
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
  ...GALAT_JARINGAN,
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
  ...GALAT_JARINGAN,
  post_exists: "Unggahan dengan id itu sudah ada. Coba tulis ulang.",
  post_not_found: "Unggahan ini sudah tidak ada.",
  not_author: "Hanya penulisnya yang bisa mengubah unggahan ini.",
  image_slot_taken: "Unggahan ini sudah punya gambar. Satu gambar per unggahan.",
  image_too_large: "Gambarnya terlalu besar. Maksimal 2 MB.",
  // Bukan salah penulisnya, dan mencoba ulang tidak akan menolong sampai
  // servernya dikonfigurasi — jadi kalimatnya tidak menyuruh coba lagi.
  image_unavailable: "Lampiran gambar sedang tidak tersedia. Teksmu tetap terbit.",
  bad_signature: "Tanda tangan tidak cocok. Coba lagi.",
  expired: "Permintaannya sudah kedaluwarsa. Coba lagi.",
  invalid_body: "Ada isian yang belum benar.",
};

export function feedErrorMessage(code: string): string {
  return FEED_MESSAGES[code] ?? "Gagal. Coba lagi sebentar.";
}

const MEET_MESSAGES: Record<string, string> = {
  ...GALAT_JARINGAN,
  expired: "Permintaannya sudah kedaluwarsa. Coba lagi.",
  bad_signature: "Tanda tangan tidak cocok. Coba lagi.",
  tandai_diri: "Kamu tidak bisa menandai dirimu sendiri.",
  // Penandatanganan buktinya otomatis, jadi ini bukan salah pengguna — buktinya
  // hilang, kedaluwarsa, atau dibuat dari dompet yang berbeda dari yang
  // dipakai sekarang. Muat ulang layarnya memaksa bukti baru dibuat.
  butuh_bukti: "Buktinya belum ada, sudah kedaluwarsa, atau dari dompet yang berbeda. Muat ulang layar ini untuk mencoba lagi.",
  invalid_body: "Ada isian yang belum benar.",
  invalid_address: "Alamatnya tidak valid. Coba lagi dari layar sebelumnya.",
  // POST /meet mengembalikan ini (403) kalau penanda tangan dan target
  // punya hubungan blokir, arah mana pun. Kalimatnya sengaja netral: tidak
  // bilang siapa yang memblokir siapa, dan tidak bilang "saling memblokir"
  // (itu salah untuk blokir sepihak). Spec menerima bahwa orang yang
  // diblokir bisa MENYIMPULKAN adanya blokir dari sini — tapi tidak
  // memberitahunya secara eksplisit.
  terblokir: "Kamu tidak bisa menandai orang ini.",
};

export function meetErrorMessage(code: string): string {
  return MEET_MESSAGES[code] ?? "Gagal. Coba lagi sebentar.";
}

/**
 * Konfirmasi setelah `aksiTanda` TERSIMPAN di server. Kartu feed dan layar
 * profil menandai orang yang sama lewat fungsi yang sama (`aksiTanda`) — kalau
 * masing-masing mengarang kalimatnya sendiri, keduanya bisa diam-diam mulai
 * mengajarkan hal yang berbeda tentang aksi yang sama. Disatukan di sini
 * supaya hanya ada satu kalimat untuk tiap arah, dipakai oleh kedua layar.
 *
 * `sudahDitandai` adalah keadaan SETELAH toggle, bukan sebelum — `true`
 * berarti aksinya baru saja MENANDAI, `false` berarti baru saja MENCABUT.
 */
export function meetSuccessMessage(sudahDitandai: boolean): string {
  return sudahDitandai
    ? "Ditandai. Kalau dia menandaimu balik, kalian akan saling tahu."
    : "Dibatalkan. Dia tidak lagi tahu kamu menandainya.";
}

/**
 * Teks lencana kecocokan baru. `null` berarti tidak ada lencana sama sekali —
 * memamerkan "0" akan membuat beranda terasa seperti papan skor yang kosong,
 * padahal yang benar adalah tidak ada apa-apa untuk diberitahukan.
 */
export function teksLencana(baru: number): string | null {
  if (!Number.isFinite(baru) || baru <= 0) return null;
  return baru > 9 ? "9+" : String(baru);
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

/**
 * Baris "N orang ingin bertemu dia" di layar profil, atau `null` kalau tidak
 * ada yang boleh dikatakan.
 *
 * `undefined` BUKAN nol. Server menghilangkan kunci ini kalau store-nya gagal
 * menjawab (lihat GET /profile/:address) — dan pada saat itu "0 orang ingin
 * bertemu dia" adalah karangan tentang orang lain, bukan fakta. Nol
 * SUNGGUHAN tetap ditampilkan: itu angka yang benar-benar dikirim server.
 *
 * Diekstrak dari JSX supaya bisa diuji tanpa merender apa pun — gerbang ini
 * regresinya kelas Critical dan sebelumnya tidak dijaga tes mana pun.
 */
export function teksInginBertemuCount(jumlah: number | undefined): string | null {
  if (jumlah === undefined) return null;
  return `${jumlah} orang ingin bertemu dia`;
}

/**
 * Judul tombol ingin bertemu di layar profil, atau `null` kalau tombolnya
 * tidak boleh muncul sama sekali.
 *
 * `sudahKutandai` ABSEN berarti "tidak diketahui", BUKAN "belum kamu tandai":
 * server hanya menyertakan bendera itu untuk pemanggil yang buktinya
 * berhasil. Tombol dua-arah yang menebak akan menampilkan "Ingin bertemu"
 * untuk orang yang SUDAH ditandai — satu ketukan lalu mencabut tanda yang
 * dikira sedang dibuat. Karena itu absen = tidak ada tombol.
 */
export function tombolTandaLabel(
  sudahKutandai: boolean | undefined,
  opsi: { milikSendiri: boolean; sibuk: boolean },
): string | null {
  if (opsi.milikSendiri) return null;
  if (sudahKutandai === undefined) return null;
  if (opsi.sibuk) return "Mengirim…";
  return sudahKutandai ? "Batal ingin bertemu" : "Ingin bertemu";
}

/**
 * Baris "N orang yang ingin bertemu kamu sudah RSVP" di layar acara, atau
 * `null`.
 *
 * `undefined` di sini adalah keadaan NORMAL, bukan nol: server SENGAJA
 * menghilangkan angkanya di bawah ambang k-anonimitas (acara terlalu kecil,
 * atau angkanya sendiri terlalu kecil untuk tidak menunjuk orang tertentu).
 * Merendernya sebagai "0 orang" mengubah penyembunyian yang disengaja menjadi
 * klaim "tidak ada yang menandaimu" — yang bisa saja bohong, dan justru
 * kebalikan dari yang sedang dilindungi.
 */
export function teksPenandaHadir(jumlah: number | undefined): string | null {
  if (jumlah === undefined) return null;
  return `${jumlah} orang yang ingin bertemu kamu sudah RSVP.`;
}

/**
 * Baris pasangan di layar acara: berapa orang yang SALING ingin bertemu
 * denganmu sudah RSVP.
 *
 * Kalimatnya menyebut "saling" karena server memotong KECOCOKAN, bukan tanda
 * sepihak — versi sepihak dulu menjadikan angka ini oracle keanggotaan RSVP
 * (tandai siapa pun, lihat angkanya bergerak). Kalimat lama, "orang yang kamu
 * tandai", sekarang akan salah: orang yang kamu tandai tapi belum menandaimu
 * balik tidak pernah ikut terhitung.
 */
export function teksKutandaiHadir(jumlah: number | undefined): string | null {
  if (jumlah === undefined) return null;
  return `${jumlah} orang yang saling ingin bertemu denganmu sudah RSVP.`;
}

const BLOKIR_MESSAGES: Record<string, string> = {
  ...GALAT_JARINGAN,
  blokir_diri: "Kamu tidak bisa memblokir dirimu sendiri.",
  bad_signature: "Tanda tangan tidak cocok. Coba lagi.",
  expired: "Permintaannya sudah kedaluwarsa. Coba lagi.",
  // Sama seperti di layar kecocokan: bukan salah pengguna, dan yang menolong
  // adalah memuat ulang, bukan mengetuk tombol yang sama lagi.
  butuh_bukti: "Buktinya belum ada, sudah kedaluwarsa, atau dari dompet yang berbeda. Muat ulang layar ini untuk mencoba lagi.",
  invalid_body: "Ada isian yang belum benar.",
};

export function blokirErrorMessage(code: string): string {
  return BLOKIR_MESSAGES[code] ?? "Gagal. Coba lagi sebentar.";
}

/**
 * Label tombol blokir. Sengaja fungsi murni supaya bisa diuji tanpa merender
 * — repo ini tidak punya harness uji render React Native, dan pola yang sama
 * sudah dipakai `teksLencana` dan `tombolTandaLabel`.
 */
export function blokirTombolLabel(sudahDiblokir: boolean, sibuk: boolean): string {
  if (sibuk) return "Mengirim…";
  return sudahDiblokir ? "Cabut blokir" : "Blokir orang ini";
}

const PESAN_MESSAGES: Record<string, string> = {
  ...GALAT_JARINGAN,
  tidak_terhubung: "Pesan hanya bisa dikirim ke orang yang pernah kamu temui.",
  // Netral dengan sengaja, sama seperti `terblokir` di MEET_MESSAGES (Ruling R8
  // Fase 4a): benar untuk blokir satu arah, tidak mengatakan siapa memblokir.
  terblokir: "Kamu tidak bisa berkirim pesan dengan orang ini.",
  belum_siap: "Orang ini belum membuka pesan di Nearly. Coba lagi nanti.",
  terlalu_cepat: "Terlalu banyak pesan dalam waktu singkat. Tunggu sebentar.",
  terlalu_besar: "Pesannya terlalu panjang.",
  pesan_diri: "Kamu tidak bisa mengirim pesan ke dirimu sendiri.",
  butuh_autentikasi: "Sesi pesan tidak sah. Tutup lalu buka lagi layar ini.",
  bukti_tidak_sah: "Bukti pesan tidak bisa diverifikasi. Muat ulang percakapan lalu coba lagi.",
  lapor_diri: "Kamu tidak bisa melaporkan dirimu sendiri.",
  expired: "Permintaannya sudah kedaluwarsa. Coba lagi.",
  bad_signature: "Tanda tangan tidak cocok. Coba lagi.",
  invalid_body: "Ada isian yang belum benar.",
};

export function pesanErrorMessage(code: string): string {
  return PESAN_MESSAGES[code] ?? "Gagal. Coba lagi sebentar.";
}

/** Fungsi murni supaya layar percakapan tidak mengarang labelnya sendiri (Ruling R4). */
export function labelKirimPesan(sibuk: boolean): string {
  return sibuk ? "Mengirim…" : "Kirim";
}

export function sisaKarakterPesan(isi: string): number {
  return MAKS_ISI_PESAN - isi.length;
}

