import { Colors } from "./colors";
import { FONT } from "./globals";

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
  // Warna judul EKSPLISIT, tidak bergantung pada label sistem iOS (hitam saat
  // iPhone bertampilan terang). Tidak ada judul besar: iOS 26 tidak
  // menggambarnya untuk ScrollView di dalam tab (amandemen §4.7, 2026-09-22).
  headerTitleStyle: { fontFamily: FONT.semibold, color: warna.text },
  contentStyle: { backgroundColor: warna.background },
};

/** Tanpa header: Beranda (sapaan besar menggantikannya) dan Mulai (logo "n") — spec §4.7, §3.7. */
const TANPA_HEADER: ReadonlySet<string> = new Set(["(tabs)/(beranda)/index", "mulai"]);

export type OpsiTampilan = { headerShown?: false };

/**
 * Opsi tambahan per layar, berkunci kunci JUDUL_LAYAR. Layar akar tab memakai
 * header biasa, bukan judul besar iOS: di iOS 26 judul besar tidak tergambar
 * untuk ScrollView di dalam tab — header kosong sampai digulir
 * (react-native-screens #3100, expo #40717; keputusan pemilik 2026-09-22,
 * amandemen spec §4.7).
 */
export function opsiTampilan(kunci: string): OpsiTampilan {
  return TANPA_HEADER.has(kunci) ? { headerShown: false } : {};
}
