import { describe, expect, it } from "vitest";
import { baca, kodeTampilanBaru, semuaBerkas, tanpaKomentar } from "./support/berkas";

const SKALA_JARAK = new Set([0, 4, 8, 12, 16, 24, 32]);
const POLA_JARAK = /\b(margin\w*|padding\w*|gap|rowGap|columnGap)\s*:\s*(-?\d+(?:\.\d+)?)\b/g;

// Penjaga murah spec desain UI §3.7 dan §10.1. Target sentuh, pembungkusan
// teks, Reduce Motion, dan safe area diuji tangan di iPhone (§10.3).
describe("aksesibilitas — penjaga baca-kode", () => {
  it("allowFontScaling tidak pernah dimatikan di app/ dan components/", () => {
    const berkas = [...semuaBerkas("app"), ...semuaBerkas("components")];
    const salah = berkas.filter((b) => /allowFontScaling\s*(=\s*\{\s*false\s*\}|:\s*false)/.test(baca(b)));
    expect(salah).toEqual([]);
  });

  it("tidak ada bobot 500 (Inter atau JetBrains Mono Medium) di mana pun", () => {
    const berkas = ["app", "components", "hooks", "theme", "src"].flatMap((d) => semuaBerkas(d));
    const salah = berkas.filter((b) => /Inter_500Medium|JetBrainsMono_500Medium/.test(baca(b)));
    expect(salah).toEqual([]);
  });

  it("tidak ada fontSize literal di luar theme/ dan components/ui/", () => {
    const salah = kodeTampilanBaru()
      .filter((b) => !b.startsWith("theme/"))
      .filter((b) => /\bfontSize\s*:\s*\d/.test(tanpaKomentar(baca(b))));
    expect(salah).toEqual([]);
  });

  // Nilai mutlak: tumpang tindih avatar (-16) sah (Ruling A14).
  it("jarak literal hanya dari skala 4/8/12/16/24/32", () => {
    const salah = kodeTampilanBaru()
      .filter((b) => !b.startsWith("theme/"))
      .flatMap((b) => [...tanpaKomentar(baca(b)).matchAll(POLA_JARAK)]
        .filter((m) => !SKALA_JARAK.has(Math.abs(Number(m[2]))))
        .map((m) => `${b}: ${m[0]}`));
    expect(salah).toEqual([]);
  });
});
