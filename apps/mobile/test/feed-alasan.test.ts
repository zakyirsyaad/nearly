import { describe, expect, it } from "vitest";
import { alasanMuncul } from "../src/messages";

describe("alasanMuncul", () => {
  it("1 lompatan menyebut pertemuan langsung", () => {
    expect(alasanMuncul(1, "Andi")).toBe("You've met Andi.");
  });

  it("2 lompatan menyebut perantara tanpa mengaku kamu bertemu dia", () => {
    expect(alasanMuncul(2, "Andi")).toBe("Someone you know has met Andi.");
  });

  /**
   * hop 0 berarti unggahanmu sendiri. Tanpa cabang ini, unggahan sendiri
   * jatuh ke cabang terakhir dan kartunya memberi tahu penulisnya bahwa
   * unggahannya sendiri berada di luar jaringannya sendiri.
   */
  it("unggahan sendiri disebut milikmu, bukan luar jaringan", () => {
    expect(alasanMuncul(0, "Andi")).toBe("Your post.");
  });

  it("luar jaringan dinyatakan apa adanya", () => {
    expect(alasanMuncul(null, "Andi")).toBe("Outside your network.");
  });

  // Nama kosong wajar: profil tidak mewajibkan nama, alamat-lah identitasnya.
  it("tidak menghasilkan kalimat rusak saat nama kosong", () => {
    expect(alasanMuncul(1, "  ")).toBe("You've met this person.");
    for (const hop of [0, 1, 2, null] as const) {
      const pesan = alasanMuncul(hop, "");
      expect(pesan.trim().length).toBeGreaterThan(5);
      expect(pesan).not.toContain("  ");
    }
  });
});
