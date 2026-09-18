import { describe, expect, it } from "vitest";
import { FONT, HURUF, jarak } from "../theme/globals";
import { keluargaUntuk } from "../theme/huruf";

describe("skala huruf (spec desain UI §3.3, §3.7)", () => {
  it("ukuran dan keluarga per varian persis spec", () => {
    expect(Object.fromEntries(Object.entries(HURUF).map(([v, h]) => [v, [h.fontSize, h.fontFamily, h.redup]])))
      .toEqual({
        heading: [30, FONT.bold, false],
        title: [18, FONT.semibold, false],
        body: [15, FONT.regular, false],
        caption: [13, FONT.regular, true],
        label: [11, FONT.semibold, false],
        mono: [13, FONT.mono, true],
      });
  });

  it("hanya heading yang memakai bobot 700", () => {
    const tebal = Object.entries(HURUF).filter(([, h]) => h.fontFamily === FONT.bold).map(([v]) => v);
    expect(tebal).toEqual(["heading"]);
  });

  it("tidak ada keluarga 500", () => {
    expect(Object.values(FONT).filter((f) => /500/.test(f))).toEqual([]);
  });

  it("jarak persis skala 4/8/12/16/24/32", () => {
    expect(jarak).toEqual({ xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 });
  });
});

describe("keluargaUntuk — berat → berkas font", () => {
  it("tanpa berat memakai keluarga dasar varian", () => {
    expect(keluargaUntuk(FONT.regular, undefined)).toBe(FONT.regular);
    expect(keluargaUntuk(FONT.bold, undefined)).toBe(FONT.bold);
  });

  it("600 dan 500 menjadi SemiBold (500 tidak dimuat)", () => {
    expect(keluargaUntuk(FONT.regular, "600")).toBe(FONT.semibold);
    expect(keluargaUntuk(FONT.regular, "500")).toBe(FONT.semibold);
    expect(keluargaUntuk(FONT.regular, 600)).toBe(FONT.semibold);
  });

  it("700 dan bold menjadi Bold; 400, normal, dan di bawahnya menjadi Regular", () => {
    expect(keluargaUntuk(FONT.regular, "700")).toBe(FONT.bold);
    expect(keluargaUntuk(FONT.regular, "bold")).toBe(FONT.bold);
    expect(keluargaUntuk(FONT.semibold, "400")).toBe(FONT.regular);
    expect(keluargaUntuk(FONT.semibold, "normal")).toBe(FONT.regular);
    expect(keluargaUntuk(FONT.semibold, "300")).toBe(FONT.regular);
  });

  it("mono selalu JetBrains Mono 400", () => {
    expect(keluargaUntuk(FONT.mono, "700")).toBe(FONT.mono);
  });

  it("berat yang tidak dikenal memakai keluarga dasar", () => {
    expect(keluargaUntuk(FONT.regular, "tebal")).toBe(FONT.regular);
  });
});
