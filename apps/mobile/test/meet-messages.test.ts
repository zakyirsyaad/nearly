import { describe, expect, it } from "vitest";
import { meetErrorMessage, meetSuccessMessage } from "../src/messages";

describe("meetErrorMessage", () => {
  it("menerjemahkan setiap kode gerbang meet ke bahasa Indonesia", () => {
    for (const kode of ["expired", "bad_signature", "tandai_diri", "butuh_bukti", "invalid_body"]) {
      const pesan = meetErrorMessage(kode);
      expect(pesan).not.toContain("_");
      expect(pesan.length).toBeGreaterThan(10);
    }
  });

  it("kode tak dikenal tetap menghasilkan kalimat, bukan kode mentah", () => {
    expect(meetErrorMessage("kode_aneh_dari_masa_depan")).not.toContain("kode_aneh");
  });
});

describe("meetSuccessMessage", () => {
  /**
   * Kartu feed dan layar profil harus mengucapkan kalimat yang SAMA persis
   * untuk aksi "menandai" — ini kunci temuan #7 (dua layar tidak boleh
   * mengajarkan dua hal berbeda tentang aksi yang sama).
   */
  it("kalimat menandai sama persis dengan yang dipakai kartu feed", () => {
    expect(meetSuccessMessage(true)).toBe(
      "Ditandai. Kalau dia menandaimu balik, kalian akan saling tahu.",
    );
  });

  it("kalimat mencabut berbeda dari kalimat menandai, dan bukan kalimat kosong", () => {
    const dicabut = meetSuccessMessage(false);
    expect(dicabut).not.toBe(meetSuccessMessage(true));
    expect(dicabut.length).toBeGreaterThan(10);
  });
});
