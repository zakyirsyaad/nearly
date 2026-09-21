import { describe, expect, it } from "vitest";
import { baca, tanpaKomentar } from "./support/berkas";

// Butir Minor review menyeluruh Rencana B1 (docs/superpowers/plans/
// 2026-09-21-catatan-minor-untuk-b2.md). Tes baca-kode: repo tidak punya
// harness render RN.

/** Potongan dari `awal` sampai `akhir` (keduanya harus ada). */
export function potong(isi: string, awal: string, akhir: string): string {
  const i = isi.indexOf(awal);
  const j = isi.indexOf(akhir, i + 1);
  expect(i, awal).toBeGreaterThan(-1);
  expect(j, akhir).toBeGreaterThan(i);
  return isi.slice(i, j);
}

describe("Profil orang: vouch dan laporan menolak ketukan ganda (M2)", () => {
  const isi = () => tanpaKomentar(baca("app/profile/[address].tsx"));

  it.each([
    ["handleVouch", "vouchBerjalan"],
    ["handleReport", "laporBerjalan"],
  ])("%s dijaga ref %s sebelum await pertama, dan dilepas di finally", (fungsi, ref) => {
    const badan = potong(isi(), `async function ${fungsi}() {`, "\n  }\n");
    const sebelumAwait = badan.slice(0, badan.indexOf("await "));
    // Ref, bukan state: dua ketukan dalam satu frame sama-sama membaca state
    // lama dari closure render yang sama.
    expect(sebelumAwait).toContain(`${ref}.current) return;`);
    expect(sebelumAwait).toContain(`${ref}.current = true;`);
    expect(badan).toMatch(new RegExp(`finally \\{[\\s\\S]*${ref}\\.current = false;`));
  });
});

describe("Button membungkus teks pada huruf besar (M5)", () => {
  const isi = () => baca("components/ui/button.tsx");

  it("ukuran default, sm, dan lg memakai minHeight, bukan height tetap", () => {
    const x = isi();
    expect(x).toContain("{ minHeight: HEIGHT, paddingHorizontal: 16, paddingVertical: 8 }");
    expect(x).toContain("{ minHeight: HEIGHT, paddingHorizontal: 32, paddingVertical: 8 }");
    expect(x).toContain("{ minHeight: 54, paddingHorizontal: 36, paddingVertical: 8 }");
    expect(x).not.toMatch(/\bheight: (HEIGHT|54), paddingHorizontal/);
  });

  it("tombol ber-flex tidak dibatasi maxHeight", () => {
    expect(isi()).not.toContain("maxHeight");
  });

  it("teks tombol boleh menyusut dan membungkus di kedua jalur render", () => {
    const x = isi();
    expect(x).toContain("const TEKS_MEMBUNGKUS: TextStyle = { flexShrink: 1, textAlign: 'center' };");
    expect(x.match(/style=\{\[finalTextStyle, TEKS_MEMBUNGKUS, textStyle\]\}/g)?.length).toBe(2);
    expect(x.match(/style=\{BARIS_ISI\}/g)?.length).toBe(3);
  });
});

describe("Profil orang: tombol Done setinggi target sentuh (M6)", () => {
  it("Pressable Done memakai gaya selesai dengan minHeight UKURAN.sentuh", () => {
    const x = tanpaKomentar(baca("app/profile/[address].tsx"));
    expect(x).toMatch(/<Pressable onPress=\{\(\) => Keyboard\.dismiss\(\)\}[^>]*style=\{s\.selesai\}/);
    expect(x).toMatch(/selesai: \{ minHeight: UKURAN\.sentuh, justifyContent: "center" \}/);
  });
});
