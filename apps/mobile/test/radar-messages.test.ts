import { describe, expect, it } from "vitest";
import {
  alamatSingkat, KALIMAT_BATAS_TERSEMBUNYI, KALIMAT_SERVER_TAK_TERJANGKAU, kalimatRadar,
  kalimatVisibilitas, keadaanRadarDariDetak, keadaanRadarDariKode, labelSimpanProfil,
  lencanaKartuRadar, namaKartuRadar, pesanNamaTidakSah, profilErrorMessage, sisaKarakterNama,
  type KeadaanRadar,
} from "../src/messages";

const SEMUA_KEADAAN: KeadaanRadar[] = [
  "tersembunyi", "di_luar_area", "belum_check_in", "tidak_berlangsung", "tidak_ditemukan",
  "kosong", "izin_lokasi", "sesi_tidak_sah", "server_tak_terjangkau", "gagal",
];

describe("kalimatRadar — keadaan layar → kalimat (spec 4b+5 §8.2)", () => {
  it("kalimat spec persis", () => {
    expect(kalimatRadar("tersembunyi")).toBe("You're Hidden, so the radar can't be opened.");
    expect(kalimatRadar("di_luar_area")).toBe("You appear to be outside the event area.");
    expect(kalimatRadar("belum_check_in")).toBe("Check in first to open the radar.");
    expect(kalimatRadar("tidak_berlangsung")).toBe("The radar is only active while the event is running.");
    expect(kalimatRadar("kosong")).toBe("No one else is visible here yet.");
    expect(kalimatRadar("izin_lokasi")).toBe("The radar needs location access while the app is open.");
    expect(kalimatRadar("server_tak_terjangkau")).toBe(KALIMAT_SERVER_TAK_TERJANGKAU);
  });

  it("setiap keadaan punya kalimatnya sendiri", () => {
    const kalimat = SEMUA_KEADAAN.map(kalimatRadar);
    expect(new Set(kalimat).size).toBe(SEMUA_KEADAAN.length);
    for (const k of kalimat) expect(k.trim().length).toBeGreaterThan(0);
  });

  // Keputusan #7: "Tersembunyi", bukan "hantu"/"ghost".
  it("tidak ada istilah hantu atau ghost di salinan radar dan profil", () => {
    const salinan = [
      ...SEMUA_KEADAAN.map(kalimatRadar), kalimatVisibilitas("terlihat"), kalimatVisibilitas("tersembunyi"),
      KALIMAT_BATAS_TERSEMBUNYI, pesanNamaTidakSah("terlalu_panjang"), pesanNamaTidakSah("karakter_terlarang"),
    ];
    for (const s of salinan) expect(s).not.toMatch(/hantu|ghost/i);
  });
});

describe("keadaanRadarDariDetak", () => {
  it("hadir → null (lanjut ambil radar)", () => {
    expect(keadaanRadarDariDetak({ hadir: true })).toBeNull();
  });
  it("alasan tersembunyi dan di_luar_area", () => {
    expect(keadaanRadarDariDetak({ hadir: false, alasan: "tersembunyi" })).toBe("tersembunyi");
    expect(keadaanRadarDariDetak({ hadir: false, alasan: "di_luar_area" })).toBe("di_luar_area");
  });
});

describe("keadaanRadarDariKode", () => {
  it("setiap kode yang dikembalikan rute radar dipetakan", () => {
    expect(keadaanRadarDariKode("tersembunyi")).toBe("tersembunyi");
    expect(keadaanRadarDariKode("belum_hadir")).toBe("di_luar_area");
    expect(keadaanRadarDariKode("belum_check_in")).toBe("belum_check_in");
    expect(keadaanRadarDariKode("event_tidak_berlangsung")).toBe("tidak_berlangsung");
    expect(keadaanRadarDariKode("event_not_found")).toBe("tidak_ditemukan");
    expect(keadaanRadarDariKode("butuh_autentikasi")).toBe("sesi_tidak_sah");
    expect(keadaanRadarDariKode("server_tak_terjangkau")).toBe("server_tak_terjangkau");
  });
  it("terlalu_cepat bukan keadaan baru", () => {
    expect(keadaanRadarDariKode("terlalu_cepat")).toBeNull();
  });
  it("kode tak dikenal → gagal", () => {
    expect(keadaanRadarDariKode("entah")).toBe("gagal");
  });
});

describe("kartu radar", () => {
  it("lencana: saling dulu, lalu pernah bertemu; tanpa hubungan tanpa lencana", () => {
    expect(lencanaKartuRadar({ pernahBertemu: true, salingInginBertemu: true })).toBe("You both want to meet");
    expect(lencanaKartuRadar({ pernahBertemu: true, salingInginBertemu: false })).toBeNull();
    expect(lencanaKartuRadar({ pernahBertemu: false, salingInginBertemu: true })).toBe("You both want to meet");
    expect(lencanaKartuRadar({ pernahBertemu: false, salingInginBertemu: false })).toBeNull();
  });
  it("nama kosong → Unnamed", () => {
    expect(namaKartuRadar("  ")).toBe("Unnamed");
    expect(namaKartuRadar(" Budi ")).toBe("Budi");
  });
  it("alamat singkat", () => {
    expect(alamatSingkat("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
  });
});

describe("penghitung nama", () => {
  it("sisa dari 32 code point setelah trim; emoji dihitung satu", () => {
    expect(sisaKarakterNama("")).toBe(32);
    expect(sisaKarakterNama("  Budi  ")).toBe(28);
    expect(sisaKarakterNama("👍👍")).toBe(30);
    expect(sisaKarakterNama("a".repeat(33))).toBe(-1);
  });
  it("pesan nama tidak sah per alasan", () => {
    expect(pesanNamaTidakSah("terlalu_panjang")).toContain("32");
    expect(pesanNamaTidakSah("karakter_terlarang")).not.toBe(pesanNamaTidakSah("terlalu_panjang"));
  });
});

describe("profil", () => {
  it("setiap kode POST /profil punya kalimatnya sendiri", () => {
    for (const code of ["nama_tidak_sah", "expired", "bad_signature", "butuh_autentikasi", "invalid_body", "server_tak_terjangkau"]) {
      expect(profilErrorMessage(code)).not.toBe("Something went wrong. Try again in a moment.");
    }
  });
  it("kalimat visibilitas berbeda per mode dan menyebut timbal balik", () => {
    expect(kalimatVisibilitas("tersembunyi")).toMatch(/can't open the radar/);
    expect(kalimatVisibilitas("terlihat")).not.toBe(kalimatVisibilitas("tersembunyi"));
  });
  it("batas Tersembunyi menyebut on-chain", () => {
    expect(KALIMAT_BATAS_TERSEMBUNYI).toMatch(/on-chain/);
  });
  it("label simpan", () => {
    expect(labelSimpanProfil(false)).toBe("Save");
    expect(labelSimpanProfil(true)).toBe("Saving…");
  });
});
