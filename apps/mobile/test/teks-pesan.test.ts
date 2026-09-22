import { describe, expect, it } from "vitest";
import { MIN_ALASAN_LAPORAN } from "../src/pesan/pesan-actions";
import {
  labelPilihBukti, perluPemisahHari, placeholderAlasanLapor, teksLaporanTerkirimGagalBlokir,
} from "../src/teks-pesan";

describe("teks Pesan (spec §6.5, §7.4)", () => {
  it("label pilih bukti menyebut batasnya", () => {
    expect(labelPilihBukti(5)).toBe("Select 1–5 messages as evidence");
  });

  it("placeholder alasan menyebut batas minimal dari konstanta yang sama dengan server", () => {
    expect(placeholderAlasanLapor()).toBe(`Reason (at least ${MIN_ALASAN_LAPORAN} characters)`);
  });

  // Laporannya SUDAH terkirim — kalimat ini tidak boleh mengaku sebaliknya.
  it("laporan terkirim tapi blokir gagal: dengan dan tanpa alasan", () => {
    expect(teksLaporanTerkirimGagalBlokir(null)).toBe("Report sent, but blocking failed.");
    expect(teksLaporanTerkirimGagalBlokir("You can't block yourself.")).toBe(
      "Report sent, but blocking failed: You can't block yourself.",
    );
  });
});

describe("perluPemisahHari (Ruling B2-11)", () => {
  // Daftar terbaru dulu (FlatList `inverted`): pemisah tampil di atas pesan
  // TERLAMA pada harinya, yaitu bila pesan sesudahnya di larik berbeda hari.
  const ms = (h: number, j: number) => new Date(2026, 8, h, j).getTime();
  const daftar = [{ createdAtMs: ms(21, 10) }, { createdAtMs: ms(21, 9) }, { createdAtMs: ms(20, 22) }];

  it("pesan terlama pada harinya mendapat pemisah; yang lain tidak", () => {
    expect(perluPemisahHari(daftar, 0)).toBe(false);
    expect(perluPemisahHari(daftar, 1)).toBe(true);
    expect(perluPemisahHari(daftar, 2)).toBe(true);
  });

  it("indeks di luar larik tidak mendapat pemisah", () => {
    expect(perluPemisahHari(daftar, 3)).toBe(false);
  });
});
