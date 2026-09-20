import { describe, expect, it } from "vitest";
import {
  CATATAN_LOKASI_QR,
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
