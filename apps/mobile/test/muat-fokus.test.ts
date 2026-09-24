import { describe, expect, it } from "vitest";
import {
  bolehMuatFokus, generasiDataKini, JEDA_MUAT_FOKUS_MS, perluMuatUlang, tandaiDataBerubah,
} from "../src/muat-fokus";

// Spec desain UI §4.6: layar tab memuat saat fokus, paling sering sekali per
// 30 detik — setara "satu tanda tangan per pembukaan beranda" hari ini.
describe("batas muat saat fokus", () => {
  it("pemuatan pertama selalu boleh", () => {
    expect(bolehMuatFokus(null, 1_000)).toBe(true);
  });

  it("pemuatan berikutnya ditahan sampai jeda terlewati", () => {
    expect(bolehMuatFokus(1_000, 1_000)).toBe(false);
    expect(bolehMuatFokus(1_000, 1_000 + JEDA_MUAT_FOKUS_MS - 1)).toBe(false);
    expect(bolehMuatFokus(1_000, 1_000 + JEDA_MUAT_FOKUS_MS)).toBe(true);
  });

  it("jedanya tiga puluh detik", () => {
    expect(JEDA_MUAT_FOKUS_MS).toBe(10_000);
  });
});

describe("perluMuatUlang (review B1 M7)", () => {
  it("layar yang belum pernah memuat selalu memuat", () => {
    expect(perluMuatUlang(null, null, 1_000, 0)).toBe(true);
  });

  it("dalam 30 detik dengan generasi yang sama tidak memuat", () => {
    expect(perluMuatUlang(1_000, 0, 1_000 + JEDA_MUAT_FOKUS_MS - 1, 0)).toBe(false);
  });

  it("data yang berubah (salaman, check-in, acara dibuat) memuat walau belum 30 detik", () => {
    expect(perluMuatUlang(1_000, 0, 1_001, 1)).toBe(true);
  });

  it("lewat 30 detik memuat", () => {
    expect(perluMuatUlang(1_000, 0, 1_000 + JEDA_MUAT_FOKUS_MS, 0)).toBe(true);
  });
});

describe("generasi data", () => {
  it("tandaiDataBerubah menaikkan generasi tepat satu", () => {
    const awal = generasiDataKini();
    tandaiDataBerubah();
    expect(generasiDataKini()).toBe(awal + 1);
  });
});
