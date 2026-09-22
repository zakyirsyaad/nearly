import { describe, expect, it } from "vitest";
import { baca, tanpaKomentar } from "./support/berkas";

const koneksi = () => tanpaKomentar(baca("app/(tabs)/(profil)/connections.tsx"));
const kecocokan = () => tanpaKomentar(baca("app/(tabs)/(profil)/kecocokan.tsx"));

describe("layar Koneksi (spec §7.1 pola daftar)", () => {
  it("daftar menyesuaikan inset supaya judul besar bekerja (§4.7)", () => {
    expect(koneksi()).toContain('contentInsetAdjustmentBehavior="automatic"');
  });

  it("baris menampilkan alamat, bukan nama karangan (§11 batas #9)", () => {
    const isi = koneksi();
    expect(isi).toContain("variant=\"mono\"");
    expect(isi).not.toContain("<KartuOrang");
  });

  it("keadaan kosong memakai kalimat bersama dan mengajak Handshake (§7.2)", () => {
    const isi = koneksi();
    expect(isi).toContain("KOSONG_KONEKSI");
    expect(isi).toContain("TEKS_AKSI_HANDSHAKE");
  });

  it("keadaan memuat memakai kerangka, bukan teks Memuat…", () => {
    const isi = koneksi();
    expect(isi).toContain("<KerangkaDaftar");
    expect(isi).not.toContain("Memuat");
  });
});

describe("layar Kecocokan (spec §7.1, §7.2)", () => {
  it("kartu memakai KartuOrang dengan lencana dan tier", () => {
    const isi = kecocokan();
    expect(isi).toContain("<KartuOrang");
    expect(isi).toContain("LENCANA_SALING_INGIN_BERTEMU");
    expect(isi).toContain("tier={k.tier}");
  });

  it("daftar kosong DI SAMPING galat tetap bukan keadaan kosong", () => {
    const isi = kecocokan();
    expect(isi).toContain("pesan ? null : (");
  });

  it("lencana tab dimuat ulang setelah kecocokan ditandai dilihat (§4.4)", () => {
    expect(kecocokan()).toContain("muatUlangLencana();");
  });

  it("tidak lagi merender TIER_LABELS lewat labelTier di JSX — batang trust menggantikannya", () => {
    expect(kecocokan()).not.toContain("labelTier(");
  });
});
