import { describe, expect, it } from "vitest";
import {
  CATATAN_NAMA, LABEL_NAMA_TAMPILAN, LABEL_TERLIHAT, LABEL_TERSEMBUNYI, LABEL_VISIBILITAS,
  PLACEHOLDER_NAMA, TAUTAN_BLOKIR, TAUTAN_DOMPET, TAUTAN_KECOCOKAN, TAUTAN_KONEKSI,
  TEKS_GAGAL_MUAT_PROFIL_SAYA, TEKS_GAGAL_SIMPAN, TEKS_TERSIMPAN,
  KOSONG_KECOCOKAN, LENCANA_SALING_INGIN_BERTEMU, TEKS_GAGAL_KECOCOKAN,
  CATATAN_ALAMAT, KOSONG_BLOKIR, labelGantiDompet, LABEL_12_KATA, LABEL_ALAMAT,
  TEKS_BLOKIR_DICABUT_GAGAL_MUAT, TEKS_GAGAL_MUAT_BLOKIR, TEKS_HAPUS_DOMPET,
} from "../src/teks-akun";

// Istilah terkunci spec desain UI §7.4 (keputusan #15).
describe("teks grup tab Profile", () => {
  it("Visible / Hidden, bukan terjemahan lain", () => {
    expect(LABEL_VISIBILITAS).toBe("Visibility");
    expect(LABEL_TERLIHAT).toBe("Visible");
    expect(LABEL_TERSEMBUNYI).toBe("Hidden");
  });

  it("daftar tautan memakai istilah terkunci", () => {
    expect(TAUTAN_KONEKSI).toBe("Connections");
    expect(TAUTAN_KECOCOKAN).toBe("You both want to meet");
    expect(TAUTAN_BLOKIR).toBe("Blocked");
    expect(TAUTAN_DOMPET).toBe("Address, 12-word recovery phrase, and switch wallet");
  });

  it("kalimat isian nama tidak kosong dan bukan nama kunci", () => {
    for (const t of [LABEL_NAMA_TAMPILAN, PLACEHOLDER_NAMA, CATATAN_NAMA, TEKS_TERSIMPAN,
      TEKS_GAGAL_MUAT_PROFIL_SAYA, TEKS_GAGAL_SIMPAN]) {
      expect(t.length).toBeGreaterThan(0);
      expect(t).not.toMatch(/_/);
    }
  });

  it("placeholder nama memakai kata yang sama dengan kartu orang tanpa nama", async () => {
    const { namaKartuRadar } = await import("../src/messages");
    expect(PLACEHOLDER_NAMA).toBe(namaKartuRadar(""));
  });
});

describe("teks Koneksi dan Kecocokan", () => {
  it("lencana kecocokan memakai istilah terkunci, tanpa titik", () => {
    expect(LENCANA_SALING_INGIN_BERTEMU).toBe("You both want to meet");
  });

  it("kalimat kosong kecocokan mengajak menandai, bukan sekadar menyatakan kosong", () => {
    expect(KOSONG_KECOCOKAN.toLowerCase()).toContain("mark");
    expect(TEKS_GAGAL_KECOCOKAN.length).toBeGreaterThan(0);
  });
});

describe("teks Dompet dan Diblokir", () => {
  it("istilah dompet terkunci", () => {
    expect(LABEL_ALAMAT).toBe("Address");
    expect(LABEL_12_KATA).toBe("12-word recovery phrase");
    expect(labelGantiDompet(false)).toBe("Switch wallet");
    expect(labelGantiDompet(true)).toBe("Deleting…");
  });

  it("catatan alamat tetap menegaskan apa yang TIDAK boleh dibagikan", () => {
    expect(CATATAN_ALAMAT).toContain("12-word recovery phrase");
    expect(TEKS_HAPUS_DOMPET.toLowerCase()).toContain("delete");
  });

  it("kalimat daftar blokir membedakan gagal memuat dari gagal mencabut", () => {
    expect(KOSONG_BLOKIR.length).toBeGreaterThan(0);
    expect(TEKS_GAGAL_MUAT_BLOKIR).not.toBe(TEKS_BLOKIR_DICABUT_GAGAL_MUAT);
    // Pencabutannya SUDAH tersimpan; kalimatnya tidak boleh mengaku gagal.
    expect(TEKS_BLOKIR_DICABUT_GAGAL_MUAT.toLowerCase()).not.toContain("couldn't unblock");
  });
});

