import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Penjaga token (aturan frontend-kit "tokens over hex", diadaptasi ke CSS biasa):
 * warna hanya boleh ditulis sekali di blok :root, sisanya memakai var(). Tanpa
 * penjaga ini palet web perlahan menyimpang dari aplikasi seperti yang terjadi
 * sebelum redesain (landing terang, /live gelap dengan nilai berbeda lagi).
 */
const CSS = readFileSync(join(__dirname, "..", "src", "gaya.css"), "utf8");

const AWAL_ROOT = CSS.indexOf(":root {");
const AKHIR_ROOT = CSS.indexOf("}", AWAL_ROOT);
const ROOT = CSS.slice(AWAL_ROOT, AKHIR_ROOT);
const SISANYA = CSS.slice(AKHIR_ROOT);

/** Token yang wajib ada; nilainya harus sama dengan apps/mobile/theme/colors.ts. */
const TOKEN_WAJIB: Record<string, string> = {
  "--latar": "#07090f",
  "--kartu": "#0f1420",
  "--garis": "#1d2638",
  "--teks": "#e6edf7",
  "--teks-redup": "#8a96ad",
  "--primer": "#f3ba2f",
  "--primer-teks": "#07090f",
  "--sukses": "#37d6a8",
  "--bahaya": "#f06a6a",
};

describe("gaya.css", () => {
  it(":root memuat token palet aplikasi dengan nilai yang sama", () => {
    expect(AWAL_ROOT).toBeGreaterThan(-1);
    for (const [token, nilai] of Object.entries(TOKEN_WAJIB)) {
      expect(ROOT, token).toContain(`${token}: ${nilai}`);
    }
  });

  it("tidak ada warna literal di luar :root", () => {
    const hex = SISANYA.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
    expect(hex, `hex di luar :root: ${hex.join(", ")}`).toEqual([]);

    const fungsiWarna = SISANYA.match(/\b(rgba?|hsla?|oklch)\(/g) ?? [];
    expect(fungsiWarna, `fungsi warna di luar :root: ${fungsiWarna.join(", ")}`).toEqual([]);
  });

  it("landing dan live sama-sama memakai token latar yang sama", () => {
    expect(CSS).toMatch(/body\s*{[^}]*background:\s*var\(--latar\)/);
    expect(CSS).toMatch(/\.live\s*{[^}]*background:\s*var\(--latar\)/);
  });

  it("ada keadaan fokus keyboard dan penghormatan reduced motion", () => {
    expect(CSS).toContain(":focus-visible");
    expect(CSS).toContain("prefers-reduced-motion");
  });
});
