import { describe, expect, it } from "vitest";
import { labelKirimPesan, pesanErrorMessage, petunjukLaporan, sisaKarakterPesan } from "../src/messages";
import { laporanSiapDikirim } from "../src/pesan/pesan-actions";

const FALLBACK = "Something went wrong. Try again in a moment.";

describe("pesanErrorMessage", () => {
  it("setiap kode yang dikembalikan rute pesan punya kalimatnya sendiri", () => {
    for (const code of [
      "tidak_terhubung", "terblokir", "belum_siap", "terlalu_cepat", "terlalu_besar", "pesan_diri",
      "butuh_autentikasi", "bukti_tidak_sah", "lapor_diri", "expired", "bad_signature", "invalid_body",
    ]) {
      expect(pesanErrorMessage(code)).not.toBe(FALLBACK);
    }
  });

  it("kode tak dikenal jatuh ke kalimat umum", () => {
    expect(pesanErrorMessage("entah")).toBe(FALLBACK);
  });

  // Sama seperti R8 Fase 4a: benar untuk blokir satu arah ke arah mana pun,
  // tidak mengatakan siapa memblokir siapa.
  it("terblokir netral", () => {
    const teks = pesanErrorMessage("terblokir");
    expect(teks).not.toMatch(/saling|memblokirmu|kamu blokir/i);
    expect(teks).not.toMatch(/blocked you|you blocked|each other/i);
  });
});

describe("labelKirimPesan dan sisaKarakterPesan", () => {
  it("label mengikuti keadaan sibuk", () => {
    expect(labelKirimPesan(false)).toBe("Send");
    expect(labelKirimPesan(true)).toBe("Sending…");
  });

  it("sisa karakter dari batas 2000", () => {
    expect(sisaKarakterPesan("")).toBe(2000);
    expect(sisaKarakterPesan("x".repeat(2001))).toBe(-1);
  });
});

// Di iPhone, pemilik project tidak bisa menekan "Kirim laporan" dan tidak tahu
// kenapa: syarat minimal 10 karakter hanya ada di placeholder, yang hilang
// begitu mulai mengetik. Petunjuk harus selalu menyebut syarat yang kurang.
describe("petunjukLaporan", () => {
  it("belum memilih bukti", () => {
    expect(petunjukLaporan(0, "alasan yang cukup panjang")).toBe("Select at least 1 message as evidence.");
  });

  it("alasan kosong menyebut batas minimalnya", () => {
    expect(petunjukLaporan(1, "   ")).toBe("Write a reason, at least 10 characters.");
  });

  it("alasan kurang menyebut sisa karakternya, tanpa menghitung spasi di tepi", () => {
    expect(petunjukLaporan(1, "  spam  ")).toBe("The reason needs 6 more characters.");
    expect(petunjukLaporan(1, "123456789")).toBe("The reason needs 1 more character.");
  });

  it("dua syarat yang kurang disebut keduanya", () => {
    expect(petunjukLaporan(0, "")).toBe(
      "Select at least 1 message as evidence. Write a reason, at least 10 characters.",
    );
  });

  it("terlalu banyak bukti", () => {
    expect(petunjukLaporan(6, "alasan yang cukup panjang")).toBe("At most 5 messages as evidence.");
  });

  // Petunjuk dan tombol tidak boleh saling bertentangan: tombol mati tanpa
  // petunjuk mengulang bug yang sama, petunjuk saat tombol aktif membingungkan.
  it("null jika dan hanya jika laporan siap dikirim", () => {
    for (const jumlah of [0, 1, 3, 5, 6, 10]) {
      for (const alasan of ["", " ", "123456789", "1234567890", "  1234567890  ", "x".repeat(50)]) {
        expect(petunjukLaporan(jumlah, alasan) === null).toBe(laporanSiapDikirim(jumlah, alasan));
      }
    }
  });
});
