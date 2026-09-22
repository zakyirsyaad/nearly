/**
 * Token bentuk, jarak, dan huruf (spec desain UI §3.3, §3.4, §3.7).
 *
 * HEIGHT, FONT_SIZE, BORDER_RADIUS, CORNERS, dan SPACING adalah nama yang
 * diimpor salinan BNA di components/ui — namanya dipertahankan, nilainya
 * mengikuti spec (radius 8, bukan pil).
 */
export const HEIGHT = 48;
export const FONT_SIZE = 15;
export const BORDER_RADIUS = 8;
export const CORNERS = 8;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

/** Skala jarak Nearly: tepi layar 16, isi kartu 16, antarbutir 8–12, antarbagian 24–32. */
export const jarak = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/** Berkas font yang dimuat di app/_layout.tsx. Tidak ada 500 (keputusan #16E). */
export const FONT = {
  regular: "Inter_400Regular",
  semibold: "Inter_600SemiBold",
  bold: "Inter_700Bold",
  mono: "JetBrainsMono_400Regular",
} as const;

export type VarianHuruf = "heading" | "title" | "body" | "caption" | "label" | "mono";

export type GayaHuruf = { fontSize: number; lineHeight: number; fontFamily: string; redup: boolean };

/** 30 / 18 / 15 / 13 / 11; mono 13. Paling banyak 4 ukuran per layar. */
export const HURUF: Record<VarianHuruf, GayaHuruf> = {
  heading: { fontSize: 30, lineHeight: 36, fontFamily: FONT.bold, redup: false },
  title: { fontSize: 18, lineHeight: 24, fontFamily: FONT.semibold, redup: false },
  body: { fontSize: 15, lineHeight: 22, fontFamily: FONT.regular, redup: false },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: FONT.regular, redup: true },
  label: { fontSize: 11, lineHeight: 14, fontFamily: FONT.semibold, redup: false },
  mono: { fontSize: 13, lineHeight: 18, fontFamily: FONT.mono, redup: true },
};

export const RADIUS = {
  kartu: 8,
  salaman: 14,
  gelembung: 12,
  gelembungSudut: 4,
  lencana: 5,
  sheet: 12,
  pelatQr: 12,
  batang: 3,
} as const;

/** Ukuran komponen — bukan jarak, tidak terikat skala jarak (spec §3.7). */
export const UKURAN = {
  sentuh: 48,
  tombolSalaman: 52,
  naikSalaman: 26,
  cincinSalaman: 5,
  avatarKartu: 42,
  avatarSheet: 56,
  avatarKepala: 64,
  qr: 260,
  tombolKirim: 40,
  logoMulai: 96,
  batangTrust: 6,
  batangTrustKecil: 5,
  celahRuas: 2,
  tinggiIsiTabBar: 56,
  tinggiKerangka: 72,
} as const;

/** Batas pembesaran label tab bar dan lencana (spec §3.7). */
export const MAKS_SKALA_HURUF_KECIL = 1.3;
