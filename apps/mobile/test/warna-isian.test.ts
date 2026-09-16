import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const APP = join(__dirname, "..", "app");

function semuaBerkas(dir = APP): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const jalur = join(dir, e.name);
    return e.isDirectory() ? semuaBerkas(jalur) : e.name.endsWith(".tsx") ? [jalur] : [];
  });
}

// Warna bawaan placeholder hampir tak terbaca di latar terang (ditemukan di
// iPhone pada formulir Buat acara), dan aplikasi memakai userInterfaceStyle
// "automatic": di mode gelap teks ketikan bawaan ikut memutih di atas latar
// yang selalu terang. Setiap isian wajib menyetel keduanya secara eksplisit.
describe("warna isian teks", () => {
  const isian = semuaBerkas().flatMap((f) =>
    [...readFileSync(f, "utf8").matchAll(/<TextInput\b[\s\S]*?\/>/g)]
      .map((m) => ({ berkas: relative(APP, f), jsx: m[0] })));

  it("ada isian yang diperiksa", () => {
    expect(isian.length).toBeGreaterThan(0);
  });

  it("setiap TextInput menyetel placeholderTextColor dari WARNA", () => {
    const tanpa = isian.filter((i) => !/placeholderTextColor=\{WARNA\.placeholder\}/.test(i.jsx)).map((i) => i.berkas);
    expect(tanpa).toEqual([]);
  });

  it("setiap TextInput menyetel warna teks dari WARNA", () => {
    const tanpa = isian.filter((i) => !/WARNA\.teks/.test(i.jsx)).map((i) => i.berkas);
    expect(tanpa).toEqual([]);
  });
});
