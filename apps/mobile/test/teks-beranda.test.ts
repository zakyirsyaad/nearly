import { describe, expect, it } from "vitest";
import {
  KOSONG_KONEKSI,
  TEKS_GAGAL_MUAT_KONEKSI,
  LABEL_SALIN_ALAMAT,
  pasanganCheckIn,
  TEKS_AKSI_HANDSHAKE,
  TEKS_ALAMAT_DISALIN,
  TEKS_BUKA_ACARA,
  TEKS_BUKA_DOMPET,
  TEKS_BUKA_RADAR,
  TEKS_LIHAT_SEMUA,
  TEKS_LIVE,
  TEKS_SALIN,
  TEKS_SUDAH_CHECK_IN,
  JUDUL_FEED,
  JUDUL_RECENTLY_MET,
} from "../src/teks-beranda";

// Teks baru yang diizinkan spec desain UI §7.3 — tidak ada yang lain.
describe("teks Beranda", () => {
  it("judul bagian dan tautan persis seperti daftar §7.3", () => {
    expect(JUDUL_RECENTLY_MET).toBe("Recently met");
    expect(JUDUL_FEED).toBe("Feed");
    expect(TEKS_LIHAT_SEMUA).toBe("See all ›");
    expect(TEKS_BUKA_RADAR).toBe("Open radar ›");
    expect(TEKS_BUKA_ACARA).toBe("Open event ›");
    expect(TEKS_BUKA_DOMPET).toBe("Open Wallet ›");
    expect(TEKS_LIVE).toBe("● LIVE");
    expect(TEKS_SUDAH_CHECK_IN).toBe("You're checked in");
  });

  it("jumlah check-in memisahkan angka dari katanya supaya angkanya lebih keras (§7.1)", () => {
    expect(pasanganCheckIn(12)).toEqual({ angka: "12", kata: "checked in" });
    expect(pasanganCheckIn(1)).toEqual({ angka: "1", kata: "checked in" });
    expect(pasanganCheckIn(0)).toEqual({ angka: "0", kata: "checked in" });
  });

  it("tombol Copy punya label aksesibilitas yang menyebut apa yang disalin (#16C)", () => {
    expect(TEKS_SALIN).toBe("Copy");
    expect(LABEL_SALIN_ALAMAT).toBe("Copy address");
    expect(TEKS_ALAMAT_DISALIN).toBe("Address copied");
  });

  it("keadaan kosong koneksi adalah terjemahan kalimat yang sudah ada", () => {
    expect(KOSONG_KONEKSI).toBe(
      "No connections yet. Connections can only be made by meeting in person.",
    );
    expect(TEKS_AKSI_HANDSHAKE).toBe("Handshake");
  });

  it("gagal memuat koneksi punya kalimatnya sendiri, bukan keadaan kosong (review B1 #I3)", () => {
    expect(TEKS_GAGAL_MUAT_KONEKSI).toBe("Couldn't load your connections.");
    expect(TEKS_GAGAL_MUAT_KONEKSI).not.toBe(KOSONG_KONEKSI);
  });
});
