// Helper bersama tes baca-kode. BUKAN berkas tes (hanya "test/**/*.test.ts"
// yang dikumpulkan vitest).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

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
 * Kode bertampilan baru selain salinan BNA: wajib token, skala jarak, dan
 * komponen teks BNA (spec desain UI §3.7, §10.1). Sejak Rencana B2 mencakup
 * SELURUH app/ (Ruling B2-16).
 */
export function kodeTampilanBaru(): string[] {
  return [
    ...semuaBerkas("components").filter((b) => !b.startsWith("components/ui/")),
    ...semuaBerkas("hooks"),
    ...semuaBerkas("theme"),
    ...semuaBerkas("app"),
  ];
}

/** Semua _layout.tsx di app/. */
export function layoutApp(): string[] {
  return semuaBerkas("app").filter((b) => b.endsWith("/_layout.tsx"));
}

/** Berkas yang dilarang memuat literal warna (spec §10.1). */
export function berkasTanpaWarna(): string[] {
  return [
    ...semuaBerkas("components"),
    ...semuaBerkas("hooks"),
    ...semuaBerkas("theme").filter((b) => b !== "theme/colors.ts"),
    ...semuaBerkas("src"),
    ...semuaBerkas("app"),
  ];
}
