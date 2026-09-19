import { Colors } from "./colors";
import { FONT } from "./globals";
import { LAYAR_TERMIGRASI, TAB_BAWAH } from "../src/judul-layar";

const warna = Colors.dark;

/**
 * `screenOptions` setiap Stack (spec desain UI §3.2): header dan judul dari
 * token. Garis bawah header memakai garis sistem native-stack — native-stack
 * tidak menerima warna garis.
 */
export const OPSI_STACK = {
  headerStyle: { backgroundColor: warna.background },
  headerTintColor: warna.text,
  headerTitleStyle: { fontFamily: FONT.semibold },
  headerLargeStyle: { backgroundColor: warna.background },
  headerLargeTitleStyle: { fontFamily: FONT.bold },
};

const KUNCI_BERANDA = "(tabs)/(beranda)/index";

/** Layar akar tab selain Beranda: header besar dengan judul di atas (spec §4.7). */
const AKAR_TAB_JUDUL_BESAR: ReadonlySet<string> = new Set(
  TAB_BAWAH.filter((t) => t.grup !== "(beranda)").map((t) => `(tabs)/${t.grup}/${t.layarAwal}`),
);

export type OpsiTampilan = {
  headerShown?: false;
  headerLargeTitle?: true;
  contentStyle?: { backgroundColor: string };
};

/**
 * Opsi tambahan per layar, berkunci kunci JUDUL_LAYAR: Beranda yang sudah
 * dimigrasi tanpa header (sapaan besar menggantikannya), layar akar tab lain berjudul besar, dan
 * latar isi gelap hanya untuk layar yang sudah dimigrasi (Ruling A2) — layar
 * lama memakai teks hitam bawaan yang tidak terbaca di atas `background`.
 */
export function opsiTampilan(
  kunci: string,
  termigrasi: ReadonlySet<string> = LAYAR_TERMIGRASI,
): OpsiTampilan {
  // Beranda baru kehilangan header hanya setelah dimigrasi: Beranda lama tidak
  // punya jarak aman dari status bar, jadi tanpa header isinya naik ke area jam
  // dan ikon status bar terang tidak terbaca di latar terangnya (uji iPhone
  // 2026-09-19).
  const tampilanBaru = termigrasi.has(kunci);
  return {
    ...(kunci === KUNCI_BERANDA && tampilanBaru ? { headerShown: false as const } : {}),
    // Judul besar hanya untuk layar yang sudah dimigrasi: iOS memberi ruang
    // yang benar hanya bila isinya ScrollView (contentInsetAdjustmentBehavior
    // "automatic"); layar lama akan tertutup di bagian atasnya.
    ...(AKAR_TAB_JUDUL_BESAR.has(kunci) && tampilanBaru ? { headerLargeTitle: true as const } : {}),
    ...(tampilanBaru ? { contentStyle: { backgroundColor: warna.background } } : {}),
  };
}
