/**
 * Judul header untuk setiap layar, didaftarkan di layout: Stack akar lewat
 * layarMenurutDompet (app/_layout.tsx), setiap Stack tab lewat layarDalam
 * (components/stack-tab.tsx).
 *
 * Didaftarkan di layout — bukan lewat <Stack.Screen> di dalam layar — karena
 * yang di dalam layar baru berlaku setelah layar selesai memuat; selama spinner
 * tampil, header dan tombol kembali layar berikutnya memakai nama rute mentah
 * seperti "events/new". test/judul-layar.test.ts membuat layar baru yang lupa
 * didaftarkan di sini langsung merah.
 *
 * Kunci = jalur berkas relatif app/ tanpa .tsx, TERMASUK nama grup; nilai
 * berbahasa Inggris (spec desain UI §4.7, keputusan #15).
 */
export const JUDUL_LAYAR: Record<string, string> = {
  mulai: "Get started",
  "profile/[address]": "Profile",
  "(tabs)/(beranda)/index": "Home",
  "(tabs)/(beranda)/feed/index": "Feed",
  "(tabs)/(beranda)/feed/new": "New post",
  "(tabs)/(acara)/events/index": "Events",
  "(tabs)/(acara)/events/new": "Create event",
  "(tabs)/(acara)/events/[id]": "Event details",
  "(tabs)/(acara)/events/[id]/host-qr": "Check-in QR",
  "(tabs)/(acara)/radar/[eventId]": "Radar",
  "(tabs)/(salaman)/salaman": "Handshake",
  "(tabs)/(pesan)/pesan/index": "Messages",
  "(tabs)/(pesan)/pesan/[address]": "Conversation",
  "(tabs)/(pesan)/pesan/lapor/[address]": "Report",
  "(tabs)/(profil)/profil-saya": "Profile",
  "(tabs)/(profil)/connections": "Connections",
  "(tabs)/(profil)/kecocokan": "Matches",
  "(tabs)/(profil)/dompet": "Wallet",
  "(tabs)/(profil)/blokir": "Blocked",
};

/**
 * Layar Stack akar, dalam urutan ini (spec §4.2). `(tabs)` harus layar pertama
 * sisi dompet: expo-router menuju layar pertama yang diizinkan saat penjaga
 * berubah.
 */
export const LAYAR_AKAR = ["(tabs)", "mulai", "profile/[address]"] as const;

/**
 * Rute yang HANYA bisa dibuka saat HP belum punya dompet. Semua layar akar lain
 * hanya bisa dibuka saat dompet siap (gerbang Stack.Protected di app/_layout.tsx).
 */
export const RUTE_TANPA_DOMPET: readonly string[] = ["mulai"];

export type OpsiLayarAkar = { title: string } | { headerShown: false };

/**
 * Pasangan [layar, opsi] Stack akar untuk satu sisi gerbang dompet. `(tabs)`
 * adalah grup, bukan berkas: tanpa judul, tanpa header (header datang dari
 * Stack tiap tab).
 */
export function layarMenurutDompet(punyaDompet: boolean): [string, OpsiLayarAkar][] {
  return LAYAR_AKAR
    .filter((nama) => RUTE_TANPA_DOMPET.includes(nama) !== punyaDompet)
    .map((nama): [string, OpsiLayarAkar] => {
      if (nama === "(tabs)") return [nama, { headerShown: false }];
      const judul = JUDUL_LAYAR[nama];
      if (judul === undefined) throw new Error(`judul untuk ${nama} tidak ada`);
      return [nama, { title: judul }];
    });
}

export type NamaIkonTab = "House" | "CalendarDays" | "ArrowLeftRight" | "MessageCircle" | "CircleUser";

export type TabBawah = { grup: string; label: string; ikon: NamaIkonTab; layarAwal: string };

/**
 * Lima tab bawah (spec §4.3) — satu sumber untuk urutan, label Inggris, ikon
 * lucide, dan layar akar setiap tab (initialRouteName Stack-nya).
 */
export const TAB_BAWAH = [
  { grup: "(beranda)", label: "Home", ikon: "House", layarAwal: "index" },
  { grup: "(acara)", label: "Events", ikon: "CalendarDays", layarAwal: "events/index" },
  { grup: "(salaman)", label: "Handshake", ikon: "ArrowLeftRight", layarAwal: "salaman" },
  { grup: "(pesan)", label: "Messages", ikon: "MessageCircle", layarAwal: "pesan/index" },
  { grup: "(profil)", label: "Profile", ikon: "CircleUser", layarAwal: "profil-saya" },
] as const satisfies readonly TabBawah[];

export type GrupTab = (typeof TAB_BAWAH)[number]["grup"];

/**
 * Pasangan [nama relatif terhadap layout, judul] untuk satu _layout.tsx.
 * Layout pemilik sebuah kunci adalah folder _layout.tsx terdalam yang menjadi
 * awalan kuncinya (spec §4.7) — di pohon ini, Stack tab `(tabs)/(grup)`.
 */
export function layarDalam(induk: string): [string, string][] {
  const awalan = `${induk}/`;
  return Object.entries(JUDUL_LAYAR)
    .filter(([kunci]) => kunci.startsWith(awalan))
    .map(([kunci, judul]): [string, string] => [kunci.slice(awalan.length), judul]);
}

/**
 * Kunci JUDUL_LAYAR yang layarnya sudah dimigrasi ke tampilan baru (Rencana B).
 * Hanya layar ini yang mendapat latar isi gelap dari Stack (Ruling A2), dan
 * hanya layar ini yang dijaga penjaga tampilan baru (test/support/berkas.ts).
 * Rencana A: kosong.
 */
export const LAYAR_TERMIGRASI: ReadonlySet<string> = new Set<string>([
  // Rencana B1 kelompok (a) — Handshake (spec §9 langkah 5a).
  "(tabs)/(salaman)/salaman",
  // Rencana B1 kelompok (b) — Beranda (spec §9 langkah 5b).
  "(tabs)/(beranda)/index",
  // Rencana B1 kelompok (c) — Profil orang (spec §9 langkah 5c).
  "profile/[address]",
  // Rencana B1 kelompok (d) — Profil sendiri (spec §9 langkah 5d).
  "(tabs)/(profil)/profil-saya",
  "(tabs)/(profil)/connections",
  "(tabs)/(profil)/kecocokan",
  "(tabs)/(profil)/dompet",
  "(tabs)/(profil)/blokir",
  // Rencana B2 kelompok (d) — Acara (spec §9 langkah 5d).
  "(tabs)/(acara)/events/index",
  "(tabs)/(acara)/events/[id]",
]);
