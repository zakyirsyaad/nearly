/**
 * Judul header untuk setiap rute, didaftarkan di app/_layout.tsx.
 *
 * Didaftarkan di layout — bukan lewat <Stack.Screen> di dalam layar — karena
 * yang di dalam layar baru berlaku setelah layar selesai memuat; selama spinner
 * tampil, header dan tombol kembali layar berikutnya memakai nama rute mentah
 * seperti "events/new". test/judul-layar.test.ts membuat layar baru yang lupa
 * didaftarkan di sini langsung merah.
 */
export const JUDUL_LAYAR: Record<string, string> = {
  index: "Nearly",
  qr: "QR salaman",
  scan: "Pindai",
  connections: "Koneksi",
  "profile/[address]": "Profil",
  "profil-saya": "Profil saya",
  kecocokan: "Kecocokan",
  blokir: "Diblokir",
  "events/index": "Acara",
  "events/new": "Buat acara",
  "events/[id]": "Detail acara",
  "events/[id]/host-qr": "QR check-in",
  "radar/[eventId]": "Radar",
  "feed/index": "Feed",
  "feed/new": "Unggahan baru",
  "pesan/index": "Pesan",
  "pesan/[address]": "Percakapan",
  "pesan/lapor/[address]": "Lapor",
};
