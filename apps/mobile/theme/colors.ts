/**
 * Palet B2 "Seimbang" (spec desain UI §3.1, keputusan #7 dan #16B).
 *
 * SATU-SATUNYA berkas TypeScript yang boleh memuat warna literal (dijaga
 * test/tema.test.ts). Nearly selalu gelap (keputusan #2): objek `light` dan
 * `dark` adalah palet yang SAMA, sehingga skema apa pun yang terbaca oleh
 * salinan BNA tidak pernah menghasilkan warna terang.
 *
 * Kunci bawaan BNA yang tidak ada di tabel spec dipetakan ke token B2 terdekat
 * (komentar per baris). Tidak ada nilai baru di luar palet selain turunan
 * transparansi dari nilai yang sama dan gradasi avatar (spec §6).
 */
const palet = {
  // Dasar (spec §3.1)
  background: "#07090f",
  foreground: "#e6edf7",
  card: "#0f1420",
  cardForeground: "#e6edf7",
  popover: "#0f1420", // = card
  popoverForeground: "#e6edf7",
  primary: "#f3ba2f",
  primaryForeground: "#07090f",
  secondary: "#0f1420", // = card
  secondaryForeground: "#e6edf7",
  muted: "#1d2638", // = border: latar skeleton
  mutedForeground: "#8a96ad",
  accent: "#0f1420", // = card
  accentForeground: "#e6edf7",
  destructive: "#f06a6a",
  destructiveForeground: "#f06a6a",
  border: "#1d2638",
  input: "#0b0f19", // latar isian dan tab bar (spec §3.4)
  ring: "#f3ba2f", // = primary: fokus isian
  text: "#e6edf7",
  textMuted: "#8a96ad",

  // Kunci lama BNA
  tint: "#f3ba2f", // = primary
  icon: "#8a96ad", // = textMuted
  tabIconDefault: "#8a96ad", // = textMuted
  tabIconSelected: "#f3ba2f", // = primary

  // Warna sistem iOS milik BNA → token B2 terdekat
  blue: "#f3ba2f", // tautan dan tombol bawaan → primary
  green: "#37d6a8", // → verified
  red: "#f06a6a", // → destructive
  orange: "#f3ba2f", // → primary
  yellow: "#f3ba2f", // → primary
  pink: "#f06a6a", // → destructive
  purple: "#8a96ad", // → textMuted
  teal: "#37d6a8", // → verified
  indigo: "#8a96ad", // → textMuted

  // Keadaan semantik BNA
  success: "#37d6a8", // → verified
  successForeground: "#07090f",
  warning: "#f3ba2f", // → primary
  warningForeground: "#07090f",
  info: "#e6edf7", // → text
  infoForeground: "#07090f",
  error: "#f06a6a", // → destructive
  errorForeground: "#07090f",

  // Kunci Nearly (spec §3.1, §3.4, §6)
  verified: "#37d6a8",
  segmentEmpty: "#56627d",
  placeholder: "#6b778e",
  avatarAwal: "#2a3550",
  selubung: "rgba(7,9,15,0.70)",
  spandukLatar: "rgba(243,186,47,0.10)",
  spandukGaris: "rgba(243,186,47,0.40)",
  destruktifLatar: "rgba(240,106,106,0.12)",
  destruktifGaris: "rgba(240,106,106,0.35)",
} as const;

export const lightColors = palet;
export const darkColors = palet;
export const Colors = { light: lightColors, dark: darkColors };

export type ColorKeys = keyof typeof palet;
