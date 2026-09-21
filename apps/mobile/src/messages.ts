import { MAKS_ISI_PESAN } from "@nearly/shared";
import { jamak } from "./jamak";
import { LENCANA_SALING_INGIN_BERTEMU } from "./teks-akun";
import { MAKS_BUKTI_LAPORAN, MIN_ALASAN_LAPORAN } from "./pesan/pesan-actions";
import { MAKS_NAMA_TAMPILAN, panjangNamaTampilan, type Visibilitas } from "@nearly/shared";

/**
 * Kalimat untuk `server_tak_terjangkau` — dilempar `req` (src/http.ts) saat
 * server tidak menjawab dalam batas waktu atau jaringan gagal. Satu kalimat
 * untuk semua domain: masalahnya koneksi, bukan aksi yang sedang dilakukan,
 * jadi tiap layar tidak perlu mengarang versinya sendiri.
 */
export const KALIMAT_SERVER_TAK_TERJANGKAU =
  "Nearly's server can't be reached. Check your internet connection, then try again.";

/** Disebar ke setiap peta galat supaya tidak ada yang jatuh ke kalimat umum. */
export const GALAT_JARINGAN: Record<string, string> = {
  server_tak_terjangkau: KALIMAT_SERVER_TAK_TERJANGKAU,
};

const PESAN: Record<string, string> = {
  ...GALAT_JARINGAN,
  expired: "That QR code has expired. Ask for a new one, then scan again.",
  offer_not_found: "This QR code isn't recognized. Ask them to open their QR screen again.",
  offer_consumed: "This QR code has already been used. Ask for a new one.",
  bad_offer_signature: "This QR code isn't valid. Ask them to open their QR screen again.",
  bad_accept_signature: "Your signature isn't valid. Try scanning again.",
  nonce_used: "This QR code has been used before. Ask for a new one.",
  already_connected: "You're already connected. One connection lasts forever.",
  quota_exceeded: "You've reached today's connection limit. Continue tomorrow.",
  chain_error: "The network is congested. Try again in a moment.",
  invalid_body: "Something was wrong with the request. Try scanning again.",
};

export function handshakeErrorMessage(code: string, reason?: string): string {
  if (code === "not_colocated") {
    return reason === "time_too_far"
      ? "You're close enough, but too much time has passed. Scan again now."
      : "You're too far apart. A handshake only works when you're really next to each other.";
  }
  return PESAN[code] ?? "Handshake failed. Try again.";
}

const EVENT_MESSAGES: Record<string, string> = {
  ...GALAT_JARINGAN,
  not_rsvped: "RSVP first to check in at this event.",
  already_checked_in: "You've already checked in at this event.",
  already_rsvped: "You've already RSVP'd to this event.",
  event_not_live: "Check-in is only open while the event is running.",
  event_over: "This event is over.",
  event_not_found: "This event wasn't found.",
  event_exists: "An event with that id already exists.",
  outside_geofence: "You're outside the event's location. Check-in only works at the venue.",
  offer_not_found: "This check-in QR code isn't recognized. Ask the host to show it again.",
  offer_consumed: "This check-in QR code has already been used. Ask the host to show it again.",
  nonce_used: "This check-in QR code has been used before.",
  not_host: "Only the event host can open check-in.",
  expired: "That QR code has expired. Ask the host to show it again.",
  bad_signature: "The signature doesn't match.",
  chain_error: "The network is having trouble. Try again in a moment.",
  invalid_body: "Some of the details aren't right yet.",
};

export function eventErrorMessage(code: string, reason?: string): string {
  if (code === "not_colocated") {
    return reason === "time_too_far"
      ? "Too much time has passed since the QR code was shown. Ask the host to show it again."
      : "You're too far from the host. Move closer to the person showing the QR code.";
  }
  return EVENT_MESSAGES[code] ?? "Something went wrong. Try again.";
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
  expired: "This request has expired. Try again.",
  bad_signature: "The signature doesn't match. Try again.",
  tandai_diri: "You can't mark yourself.",
  // Penandatanganan buktinya otomatis, jadi ini bukan salah pengguna — buktinya
  // hilang, kedaluwarsa, atau dibuat dari dompet yang berbeda dari yang
  // dipakai sekarang. Muat ulang layarnya memaksa bukti baru dibuat.
  butuh_bukti: "The proof is missing, expired, or from a different wallet. Reload this screen to try again.",
  invalid_body: "Some of the details aren't right yet.",
  invalid_address: "That address isn't valid. Try again from the previous screen.",
  // POST /meet mengembalikan ini (403) kalau penanda tangan dan target
  // punya hubungan blokir, arah mana pun. Kalimatnya sengaja netral: tidak
  // bilang siapa yang memblokir siapa, dan tidak bilang "saling memblokir"
  // (itu salah untuk blokir sepihak). Spec menerima bahwa orang yang
  // diblokir bisa MENYIMPULKAN adanya blokir dari sini — tapi tidak
  // memberitahunya secara eksplisit.
  terblokir: "You can't mark this person.",
};

export function meetErrorMessage(code: string): string {
  return MEET_MESSAGES[code] ?? "Something went wrong. Try again in a moment.";
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
    ? "Marked. If they mark you back, you'll both know."
    : "Undone. They no longer know you marked them.";
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
  return jamak(jumlah, "person wants to meet them", "people want to meet them");
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
  if (opsi.sibuk) return "Sending…";
  return sudahKutandai ? "Undo want to meet" : "Want to meet";
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
  return jamak(jumlah, "person who wants to meet you has RSVP'd.", "people who want to meet you have RSVP'd.");
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
  return jamak(jumlah, "person you both want to meet has RSVP'd.", "people you both want to meet have RSVP'd.");
}

const BLOKIR_MESSAGES: Record<string, string> = {
  ...GALAT_JARINGAN,
  blokir_diri: "You can't block yourself.",
  bad_signature: "The signature doesn't match. Try again.",
  expired: "This request has expired. Try again.",
  // Sama seperti di layar kecocokan: bukan salah pengguna, dan yang menolong
  // adalah memuat ulang, bukan mengetuk tombol yang sama lagi.
  butuh_bukti: "The proof is missing, expired, or from a different wallet. Reload this screen to try again.",
  invalid_body: "Some of the details aren't right yet.",
};

export function blokirErrorMessage(code: string): string {
  return BLOKIR_MESSAGES[code] ?? "Something went wrong. Try again in a moment.";
}

/**
 * Label tombol blokir. Sengaja fungsi murni supaya bisa diuji tanpa merender
 * — repo ini tidak punya harness uji render React Native, dan pola yang sama
 * sudah dipakai `teksLencana` dan `tombolTandaLabel`.
 */
export function blokirTombolLabel(sudahDiblokir: boolean, sibuk: boolean): string {
  if (sibuk) return "Sending…";
  return sudahDiblokir ? "Unblock" : "Block this person";
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


/**
 * Syarat laporan yang BELUM terpenuhi, atau `null` kalau siap dikirim — tepat
 * kebalikan `laporanSiapDikirim`, dari konstanta yang sama.
 *
 * Tombol "Kirim laporan" yang abu-abu tanpa penjelasan membuat pengguna
 * mengira tombolnya rusak: syarat minimal alasan hanya ada di placeholder,
 * dan placeholder hilang begitu pengguna mulai mengetik.
 */
export function petunjukLaporan(jumlahDipilih: number, alasan: string): string | null {
  const kurang: string[] = [];
  if (jumlahDipilih < 1) kurang.push("Pilih minimal 1 pesan sebagai bukti.");
  if (jumlahDipilih > MAKS_BUKTI_LAPORAN) kurang.push(`Maksimal ${MAKS_BUKTI_LAPORAN} pesan sebagai bukti.`);
  const panjang = alasan.trim().length;
  if (panjang === 0) kurang.push(`Tulis alasan, minimal ${MIN_ALASAN_LAPORAN} karakter.`);
  else if (panjang < MIN_ALASAN_LAPORAN) kurang.push(`Alasan kurang ${MIN_ALASAN_LAPORAN - panjang} karakter lagi.`);
  return kurang.length > 0 ? kurang.join(" ") : null;
}

export type KeadaanRadar =
  | "tersembunyi"
  | "di_luar_area"
  | "belum_check_in"
  | "tidak_berlangsung"
  | "tidak_ditemukan"
  | "kosong"
  | "izin_lokasi"
  | "sesi_tidak_sah"
  | "server_tak_terjangkau"
  | "gagal";

const KALIMAT_RADAR: Record<KeadaanRadar, string> = {
  tersembunyi: "You're Hidden, so the radar can't be opened.",
  di_luar_area: "You appear to be outside the event area.",
  belum_check_in: "Check in first to open the radar.",
  tidak_berlangsung: "The radar is only active while the event is running.",
  tidak_ditemukan: "This event wasn't found.",
  kosong: "No one else is visible here yet.",
  izin_lokasi: "The radar needs location access while the app is open.",
  sesi_tidak_sah: "Your session isn't valid. Close this screen, then open it again.",
  server_tak_terjangkau: KALIMAT_SERVER_TAK_TERJANGKAU,
  gagal: "The radar failed to load. Try again in a moment.",
};

export function kalimatRadar(keadaan: KeadaanRadar): string {
  return KALIMAT_RADAR[keadaan];
}

export function keadaanRadarDariDetak(
  jawaban: { hadir: true } | { hadir: false; alasan: "tersembunyi" | "di_luar_area" },
): KeadaanRadar | null {
  if (jawaban.hadir) return null;
  return jawaban.alasan === "tersembunyi" ? "tersembunyi" : "di_luar_area";
}

export function keadaanRadarDariKode(code: string): KeadaanRadar | null {
  switch (code) {
    case "terlalu_cepat":
      return null;
    case "tersembunyi":
      return "tersembunyi";
    case "belum_hadir":
      return "di_luar_area";
    case "belum_check_in":
      return "belum_check_in";
    case "event_tidak_berlangsung":
      return "tidak_berlangsung";
    case "event_not_found":
      return "tidak_ditemukan";
    case "butuh_autentikasi":
      return "sesi_tidak_sah";
    case "server_tak_terjangkau":
      return "server_tak_terjangkau";
    default:
      return "gagal";
  }
}

/**
 * Lencana teks kartu radar (spec §6.4, Ruling B2-8). "Pernah bertemu" tidak
 * lagi berupa teks: kartu koneksi memakai lencana ✓ ringkas, dan bagiannya
 * ("Your connections here") sudah mengatakannya.
 */
export function lencanaKartuRadar(k: {
  pernahBertemu: boolean;
  salingInginBertemu: boolean;
}): string | null {
  return k.salingInginBertemu ? LENCANA_SALING_INGIN_BERTEMU : null;
}

export function namaKartuRadar(displayName: string): string {
  return displayName.trim() || "Unnamed";
}

export function alamatSingkat(address: string): string {
  return address.length <= 12 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function sisaKarakterNama(nama: string): number {
  return MAKS_NAMA_TAMPILAN - panjangNamaTampilan(nama);
}

export function kalimatVisibilitas(v: Visibilitas): string {
  return v === "terlihat"
    ? "Other people at the same event can see you on the radar, and you can open the radar."
    : "You don't show up on the radar and you don't trigger proximity notifications — but you can't open the radar either.";
}

export const KALIMAT_BATAS_TERSEMBUNYI =
  "Hidden doesn't hide handshakes and check-ins: both stay recorded publicly on-chain.";

export function pesanNamaTidakSah(alasan: "terlalu_panjang" | "karakter_terlarang"): string {
  return alasan === "terlalu_panjang"
    ? `Names can be at most ${MAKS_NAMA_TAMPILAN} characters.`
    : "Your name contains invisible or text-direction characters. Remove them, then try again.";
}

const PROFIL_MESSAGES: Record<string, string> = {
  ...GALAT_JARINGAN,
  nama_tidak_sah: "That name isn't valid. Check its length and characters.",
  expired: "This request has expired. Try again.",
  bad_signature: "The signature doesn't match. Try again.",
  butuh_autentikasi: "Your session isn't valid. Close this screen, then open it again.",
  invalid_body: "Some of the details aren't right yet.",
};

export function profilErrorMessage(code: string): string {
  return PROFIL_MESSAGES[code] ?? "Something went wrong. Try again in a moment.";
}

export function labelSimpanProfil(sibuk: boolean): string {
  return sibuk ? "Saving…" : "Save";
}

/**
 * Awalan judul, dipisah supaya sheet bisa merender alamat singkat dengan
 * varian `mono` (spec §6.2 butir 3) tanpa memecah kalimatnya sendiri di JSX.
 */
export const AWALAN_SHEET_BERTEMU = "You met ";

export function judulSheetBertemu(nama: string | null, alamat: string): string {
  const n = nama?.trim() ?? "";
  return `${AWALAN_SHEET_BERTEMU}${n || alamatSingkat(alamat)}`;
}
