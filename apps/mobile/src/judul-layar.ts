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
  mulai: "Mulai",
  dompet: "Dompet",
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
  // SEMENTARA (Rencana A Task 1) — dihapus bersama app/spike-bna.tsx di Task 8.
  "spike-bna": "Spike BNA",
};

/**
 * Rute yang HANYA bisa dibuka saat HP belum punya dompet. Semua rute lain
 * hanya bisa dibuka saat dompet siap (gerbang Stack.Protected di
 * app/_layout.tsx).
 */
export const RUTE_TANPA_DOMPET: readonly string[] = ["mulai"];

/** Pasangan [rute, judul] untuk satu sisi gerbang dompet, urutan JUDUL_LAYAR dipertahankan. */
export function layarMenurutDompet(punyaDompet: boolean): [string, string][] {
  return Object.entries(JUDUL_LAYAR)
    .filter(([rute]) => RUTE_TANPA_DOMPET.includes(rute) !== punyaDompet);
}

/**
 * Kunci JUDUL_LAYAR yang layarnya sudah dimigrasi ke tampilan baru (Rencana B).
 * Hanya layar ini yang mendapat latar isi gelap dari Stack (Ruling A2), dan
 * hanya layar ini yang dijaga penjaga tampilan baru (test/support/berkas.ts).
 * Rencana A: kosong.
 */
export const LAYAR_TERMIGRASI: ReadonlySet<string> = new Set<string>([]);

