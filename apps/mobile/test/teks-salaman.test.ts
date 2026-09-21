import { describe, expect, it } from "vitest";
import {
  CATATAN_LOKASI_QR,
  kalimatGagalLokal,
  TEKS_GAGAL_CHECK_IN,
  TEKS_GAGAL_SALAMAN,
  TEKS_GAGAL_SIAPKAN_QR,
  TEKS_IZIN_LOKASI,
  potongTxHash,
  teksCheckInBerhasil,
  teksHitungMundurQr,
  teksTerkoneksi,
  TEKS_BUKAN_QR_NEARLY,
  TEKS_LIHAT_PROFIL,
  TEKS_PINDAI_LAGI,
  TEKS_PINDAI_ORANG_LAIN,
  TEKS_QR_SENDIRI,
} from "../src/teks-salaman";

const TX = "0x1234567890abcdef1234567890abcdef12345678";

// Terjemahan 1:1 kalimat yang ada (spec desain UI §6.2, R5) + teks baru §7.3.
describe("teks layar Handshake", () => {
  it("hitung mundur QR memakai bentuk tunggal untuk satu detik", () => {
    expect(teksHitungMundurQr(30)).toBe("Ask them to scan this. Changes in 30 seconds.");
    expect(teksHitungMundurQr(1)).toBe("Ask them to scan this. Changes in 1 second.");
    expect(teksHitungMundurQr(0)).toBe("Ask them to scan this. Changes in 0 seconds.");
  });

  it("hasil pindai memotong tx hash pada sepuluh karakter", () => {
    expect(potongTxHash(TX)).toBe("0x12345678…");
    expect(teksTerkoneksi(TX)).toBe("Connected. 0x12345678…");
    expect(teksCheckInBerhasil(TX)).toBe("Checked in. 0x12345678…");
  });

  it("kalimat penolakan pindai adalah terjemahan kalimat yang ada", () => {
    expect(TEKS_BUKAN_QR_NEARLY).toBe("This isn't a Nearly QR code.");
    expect(TEKS_QR_SENDIRI).toBe("That's your own QR code.");
    expect(TEKS_PINDAI_LAGI).toBe("Scan again");
  });

  it("tombol sheet berhasil memakai teks baru yang didaftar spec §7.3", () => {
    expect(TEKS_LIHAT_PROFIL).toBe("View profile");
    expect(TEKS_PINDAI_ORANG_LAIN).toBe("Scan someone else");
  });

  it("catatan lokasi mode QR sejalan dengan teks izin lokasi", () => {
    expect(CATATAN_LOKASI_QR).toBe(
      "Approximate location is used only to confirm you're both in the same place.",
    );
  });
});

describe("teks-salaman.ts murni", () => {
  it("tidak ada konstanta teks yang kosong", async () => {
    const modul = await import("../src/teks-salaman");
    for (const [nama, nilai] of Object.entries(modul)) {
      if (typeof nilai === "string") expect(nilai.length, nama).toBeGreaterThan(0);
    }
  });
});

// Review B1 #I1: galat lokal (bukan ApiError) tidak boleh menampilkan
// Error.message mentah — LocationDeniedError berbahasa Indonesia.
describe("kalimat galat lokal Handshake", () => {
  it("izin lokasi ditolak menjadi kalimat Inggris", () => {
    const e = new Error("Izin lokasi ditolak");
    e.name = "LocationDeniedError";
    expect(kalimatGagalLokal(e, TEKS_GAGAL_SALAMAN)).toBe(TEKS_IZIN_LOKASI);
    expect(TEKS_IZIN_LOKASI).toBe("Handshake needs location access to confirm you're both in the same place.");
  });

  it("galat lain memakai kalimat cadangan, bukan message-nya", () => {
    expect(kalimatGagalLokal(new Error("gagal (500)"), TEKS_GAGAL_CHECK_IN)).toBe(TEKS_GAGAL_CHECK_IN);
    expect(kalimatGagalLokal("bukan Error", TEKS_GAGAL_SIAPKAN_QR)).toBe(TEKS_GAGAL_SIAPKAN_QR);
  });
});
