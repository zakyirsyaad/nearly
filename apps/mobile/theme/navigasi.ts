import { Colors } from "./colors";
import { FONT } from "./globals";
import { LAYAR_TERMIGRASI } from "../src/judul-layar";

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

/**
 * Opsi tambahan per layar, berkunci kunci JUDUL_LAYAR. Latar isi gelap hanya
 * untuk layar yang sudah dimigrasi (Ruling A2): layar lama memakai teks hitam
 * bawaan yang tidak terbaca di atas `background`.
 */
export function opsiTampilan(kunci: string): { contentStyle?: { backgroundColor: string } } {
  return LAYAR_TERMIGRASI.has(kunci) ? { contentStyle: { backgroundColor: warna.background } } : {};
}
