// Helper bersama tes baca-kode. BUKAN berkas tes (hanya "test/**/*.test.ts"
// yang dikumpulkan vitest).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { LAYAR_TERMIGRASI } from "../../src/judul-layar";

export const MOBILE = join(__dirname, "..", "..");

/** Semua berkas di bawah `folder` (relatif akar apps/mobile), dengan garis miring "/". */
export function semuaBerkas(folder: string, pola: RegExp = /\.(ts|tsx)$/): string[] {
  const akar = join(MOBILE, folder);
  if (!existsSync(akar)) return [];
  const jalan = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const jalur = join(dir, e.name);
      if (e.isDirectory()) return jalan(jalur);
      return pola.test(e.name) ? [relative(MOBILE, jalur).split(sep).join("/")] : [];
    });
  return jalan(akar);
}

export const baca = (berkas: string): string => readFileSync(join(MOBILE, berkas), "utf8");

/** Buang komentar, supaya catatan seperti "keputusan #16B" tidak terbaca sebagai warna. */
export function tanpaKomentar(isi: string): string {
  return isi.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

/**
 * Komponen yang dipindah apa adanya dari app/ dan belum dimigrasi ke tampilan
 * baru (Ruling A4). Rencana B mengosongkan himpunan ini.
 */
export const KOMPONEN_BELUM_DIMIGRASI: ReadonlySet<string> = new Set<string>([
  // app/qr.tsx dan app/scan.tsx dipindah apa adanya (Ruling A10) — Rencana B 5(a).
  "components/salaman/mode-qr.tsx",
  "components/salaman/mode-pindai.tsx",
]);

/**
 * Kode bertampilan baru selain salinan BNA: wajib token, skala jarak, dan
 * komponen teks BNA (spec desain UI §3.7, §10.1).
 */
export function kodeTampilanBaru(): string[] {
  return [
    ...semuaBerkas("components").filter(
      (b) => !b.startsWith("components/ui/") && !KOMPONEN_BELUM_DIMIGRASI.has(b),
    ),
    ...semuaBerkas("hooks"),
    ...semuaBerkas("theme"),
    ...layoutApp(),
    ...layarTermigrasi(),
  ];
}

/** Semua _layout.tsx di app/ — ditulis dengan komponen BNA sejak Rencana A. */
export function layoutApp(): string[] {
  return semuaBerkas("app").filter((b) => b.endsWith("/_layout.tsx"));
}

/** Berkas layar yang sudah dimigrasi Rencana B (kunci LAYAR_TERMIGRASI → berkas). */
export function layarTermigrasi(): string[] {
  return [...LAYAR_TERMIGRASI].map((k) => `app/${k}.tsx`);
}

/** Berkas yang dilarang memuat literal warna (spec §10.1). */
export function berkasTanpaWarna(): string[] {
  return [
    ...semuaBerkas("components").filter((b) => !KOMPONEN_BELUM_DIMIGRASI.has(b)),
    ...semuaBerkas("hooks"),
    ...semuaBerkas("theme").filter((b) => b !== "theme/colors.ts"),
    // src/warna.ts dihapus Rencana B bersama <TextInput> lama terakhir (Ruling A3).
    ...semuaBerkas("src").filter((b) => b !== "src/warna.ts"),
    ...layoutApp(),
    ...layarTermigrasi(),
  ];
}
