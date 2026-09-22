import { describe, expect, it } from "vitest";
import { baca, tanpaKomentar } from "./support/berkas";

const radar = () => tanpaKomentar(baca("app/(tabs)/(acara)/radar/[eventId].tsx"));

describe("Radar (spec §6.4, keputusan #10)", () => {
  it("siklus detak 60 dtk / radar 10 dtk hanya selama fokus tetap", () => {
    const x = radar();
    expect(x).toContain("const JEDA_DETAK_MS = 60_000;");
    expect(x).toContain("const JEDA_RADAR_MS = 10_000;");
    expect(x).toContain("useFocusEffect(useCallback(() => {");
    expect(x).toContain("clearInterval(tDetak); clearInterval(tRadar);");
  });

  it("N people visible here dari `jumlah` respons, bukan jumlah kartu (#10e)", () => {
    const x = radar();
    expect(x).toContain("pasanganTerlihatDiSini(radar.jumlah)");
    expect(x).toContain("setRadar({ kartu: r.kartu, jumlah: r.jumlah, pada: new Date() });");
    expect(x).toContain("teksDiperbarui(radar.pada, kini)");
  });

  it("dua bagian dari urutan server, kartu memakai KartuOrang + batang dari tierDariLabel (#10f)", () => {
    const x = radar();
    expect(x).toContain("pisahKartuRadar(radar ? radar.kartu : [])");
    expect(x).toContain("<BagianRadar judul={JUDUL_KONEKSI_DI_SINI} kartu={koneksi} />");
    expect(x).toContain("<BagianRadar judul={JUDUL_BELUM_DITEMUI} kartu={belum} />");
    expect(x).toContain("tier={tierDariLabel(k.tierLabel)}");
    // Label tier kawat bahasa Indonesia tidak pernah dirender (spec §7.4).
    expect(x).not.toContain("{k.tierLabel}");
  });

  it("koneksi bersama dan Handshake › hanya untuk yang belum ditemui; tidak ada tombol pesan", () => {
    const x = radar();
    expect(x).toContain("keterangan={keteranganKartuRadar(k)}");
    expect(x).toMatch(/\{!k\.pernahBertemu \? \(\s*<TautanKecil label=\{TEKS_HANDSHAKE_KARTU\}/);
    // Jalur impor src/pesan/… sah; yang dilarang adalah NAVIGASI ke pesan.
    expect(x).not.toMatch(/router\.(push|navigate|replace)\([`"]\/pesan/);
  });

  it("keadaan: kosong berikon, galat yang bisa pulih punya Try again yang memasang ulang efek", () => {
    const x = radar();
    expect(x).toContain('<KeadaanKosong Ikon={IkonRadar} kalimat={kalimatRadar("kosong")} />');
    expect(x).toContain("radarBisaDicobaLagi(keadaan)");
    expect(x).toContain("onCobaLagi={() => setPercobaan((n) => n + 1)}");
    expect(x).toContain("}, [eventId, signer, percobaan]));");
  });

  it("Tersembunyi mengarah ke tab Profile lewat navigate lintas tab", () => {
    expect(radar()).toContain('router.navigate("/profil-saya")');
  });
});
