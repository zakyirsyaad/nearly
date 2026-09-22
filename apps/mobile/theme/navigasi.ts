import { Colors } from "./colors";
import { FONT } from "./globals";
import { TAB_BAWAH } from "../src/judul-layar";

const warna = Colors.dark;

/**
 * `screenOptions` setiap Stack (spec desain UI §3.2): header, judul, dan latar
 * isi dari token. Latar isi gelap kini bawaan — sejak Rencana B2 setiap layar
 * bertampilan baru (Ruling A2 selesai, Ruling B2-16). Garis bawah header
 * memakai garis sistem native-stack — native-stack tidak menerima warna garis.
 */
export const OPSI_STACK = {
  headerStyle: { backgroundColor: warna.background },
  headerTintColor: warna.text,
  // Warna judul EKSPLISIT: expo-router 57 tidak memakai headerTintColor untuk
  // judul besar, dan warna label sistem iOS hitam saat iPhone bertampilan
  // terang — judul besar tak terlihat di latar gelap (uji iPhone 2026-09-22).
  headerTitleStyle: { fontFamily: FONT.semibold, color: warna.text },
  headerLargeStyle: { backgroundColor: warna.background },
  headerLargeTitleStyle: { fontFamily: FONT.bold, color: warna.text },
  contentStyle: { backgroundColor: warna.background },
};

/** Tanpa header: Beranda (sapaan besar menggantikannya) dan Mulai (logo "n") — spec §4.7, §3.7. */
const TANPA_HEADER: ReadonlySet<string> = new Set(["(tabs)/(beranda)/index", "mulai"]);

/** Layar akar tab selain Beranda: header besar dengan judul di atas (spec §4.7). */
const AKAR_TAB_JUDUL_BESAR: ReadonlySet<string> = new Set(
  TAB_BAWAH.filter((t) => t.grup !== "(beranda)").map((t) => `(tabs)/${t.grup}/${t.layarAwal}`),
);

export type OpsiTampilan = { headerShown?: false; headerLargeTitle?: true };

/**
 * Opsi tambahan per layar, berkunci kunci JUDUL_LAYAR. Judul besar iOS hanya
 * memberi ruang yang benar bila isi layarnya ScrollView/FlatList dengan
 * contentInsetAdjustmentBehavior "automatic" (dijaga test/judul-layar.test.ts).
 */
export function opsiTampilan(kunci: string): OpsiTampilan {
  return {
    ...(TANPA_HEADER.has(kunci) ? { headerShown: false as const } : {}),
    ...(AKAR_TAB_JUDUL_BESAR.has(kunci) ? { headerLargeTitle: true as const } : {}),
  };
}
