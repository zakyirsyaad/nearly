import { describe, expect, it } from "vitest";
import { labelKirimPesan, pesanErrorMessage, sisaKarakterPesan } from "../src/messages";

const FALLBACK = "Gagal. Coba lagi sebentar.";

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
  });
});

describe("labelKirimPesan dan sisaKarakterPesan", () => {
  it("label mengikuti keadaan sibuk", () => {
    expect(labelKirimPesan(false)).toBe("Kirim");
    expect(labelKirimPesan(true)).toBe("Mengirim…");
  });

  it("sisa karakter dari batas 2000", () => {
    expect(sisaKarakterPesan("")).toBe(2000);
    expect(sisaKarakterPesan("x".repeat(2001))).toBe(-1);
  });
});
