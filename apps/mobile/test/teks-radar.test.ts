import { describe, expect, it } from "vitest";
import {
  keteranganKartuRadar, pasanganTerlihatDiSini, pisahKartuRadar, radarBisaDicobaLagi,
  teksDiperbarui, teksKoneksiBersama,
} from "../src/teks-radar";

describe("teks Radar (spec §6.4, §7.3, keputusan #10)", () => {
  it("N people visible here — tunggal dan jamak, angka terpisah dari kata (§7.1)", () => {
    expect(pasanganTerlihatDiSini(1)).toEqual({ angka: "1", kata: "person visible here" });
    expect(pasanganTerlihatDiSini(4)).toEqual({ angka: "4", kata: "people visible here" });
  });

  it("Updated memakai waktu relatif", () => {
    const kini = new Date(2026, 8, 21, 10, 0, 30);
    expect(teksDiperbarui(new Date(2026, 8, 21, 10, 0, 10), kini)).toBe("Updated just now");
    expect(teksDiperbarui(new Date(2026, 8, 21, 9, 58, 0), kini)).toBe("Updated 2 minutes ago");
  });

  it("koneksi bersama: absen atau 0 → tidak ada teks; 1 tunggal; N jamak", () => {
    expect(teksKoneksiBersama(undefined)).toBeNull();
    expect(teksKoneksiBersama(0)).toBeNull();
    expect(teksKoneksiBersama(1)).toBe("1 mutual connection");
    expect(teksKoneksiBersama(3)).toBe("3 mutual connections");
  });

  it("keterangan kartu: here now, plus koneksi bersama hanya untuk yang belum ditemui (#10c)", () => {
    expect(keteranganKartuRadar({ pernahBertemu: false })).toBe("here now");
    expect(keteranganKartuRadar({ pernahBertemu: false, koneksiBersama: 2 })).toBe("here now · 2 mutual connections");
    // Kartu koneksi tidak pernah membawa angka ini (spec §8.3); kalau pun ada, tidak ditampilkan.
    expect(keteranganKartuRadar({ pernahBertemu: true, koneksiBersama: 2 })).toBe("here now");
  });

  it("dua bagian tanpa mengubah urutan server (§6.4)", () => {
    const k = [
      { id: "a", pernahBertemu: false }, { id: "b", pernahBertemu: true },
      { id: "c", pernahBertemu: false }, { id: "d", pernahBertemu: true },
    ];
    const { koneksi, belum } = pisahKartuRadar(k);
    expect(koneksi.map((x) => x.id)).toEqual(["b", "d"]);
    expect(belum.map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("Try again hanya untuk keadaan yang bisa pulih dengan mencoba lagi", () => {
    for (const k of ["gagal", "server_tak_terjangkau", "sesi_tidak_sah", "izin_lokasi"] as const) {
      expect(radarBisaDicobaLagi(k), k).toBe(true);
    }
    for (const k of ["tersembunyi", "di_luar_area", "belum_check_in", "tidak_berlangsung", "tidak_ditemukan", "kosong"] as const) {
      expect(radarBisaDicobaLagi(k), k).toBe(false);
    }
  });
});
