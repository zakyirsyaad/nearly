import { describe, expect, it } from "vitest";
import { feedErrorMessage, meetErrorMessage, meetSuccessMessage } from "../src/messages";

describe("meetErrorMessage", () => {
  it("menerjemahkan setiap kode gerbang meet ke kalimat Inggris", () => {
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
      "Marked. If they mark you back, you'll both know.",
    );
  });

  it("kalimat mencabut berbeda dari kalimat menandai, dan bukan kalimat kosong", () => {
    const dicabut = meetSuccessMessage(false);
    expect(dicabut).not.toBe(meetSuccessMessage(true));
    expect(dicabut.length).toBeGreaterThan(10);
  });
});

describe("meetErrorMessage: terblokir", () => {
  // `terblokir` (403) datang dari POST /meet ketika penanda tangan dan
  // target punya hubungan blokir. Tanpa entri sendiri, layar penanda jatuh
  // ke kalimat cadangan "Gagal. Coba lagi sebentar." — yang mengundang orang
  // mengetuk tombol yang sama lagi, padahal aksi itu tidak akan pernah
  // berhasil selama blokirnya masih ada.
  it("punya pesan sendiri, bukan kalimat cadangan", () => {
    expect(meetErrorMessage("terblokir")).toBe("You can't mark this person.");
  });
});

describe("feedErrorMessage: image_unavailable", () => {
  it("punya pesan sendiri, bukan kalimat cadangan", () => {
    const pesan = feedErrorMessage("image_unavailable");
    expect(pesan).not.toBe(feedErrorMessage("kode-yang-tidak-ada"));
    expect(pesan).toContain("aren't available");
  });

  // Mencoba ulang tidak menolong sampai servernya dikonfigurasi; menyuruhnya
  // akan membuat pengguna mengetuk tombol yang tidak bisa berhasil.
  it("TIDAK menyuruh coba lagi", () => {
    expect(feedErrorMessage("image_unavailable").toLowerCase()).not.toContain("coba lagi");
  });
});
