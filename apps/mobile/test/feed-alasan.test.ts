import { describe, expect, it } from "vitest";
import { alasanMuncul } from "../src/messages";

describe("alasanMuncul", () => {
  it("1 lompatan menyebut pertemuan langsung", () => {
    expect(alasanMuncul(1, "Andi")).toContain("Andi");
    expect(alasanMuncul(1, "Andi").toLowerCase()).toContain("bertemu");
  });

  it("2 lompatan menyebut perantara tanpa mengaku kamu bertemu dia", () => {
    const pesan = alasanMuncul(2, "Andi");
    expect(pesan.toLowerCase()).toContain("kenalan");
  });

  /**
   * hop 0 berarti unggahanmu sendiri. Tanpa cabang ini, unggahan sendiri
   * jatuh ke cabang terakhir dan kartunya memberi tahu penulisnya bahwa
   * unggahannya sendiri berada di luar jaringannya sendiri.
   */
  it("unggahan sendiri disebut milikmu, bukan luar jaringan", () => {
    const pesan = alasanMuncul(0, "Andi");
    expect(pesan.toLowerCase()).toContain("unggahanmu");
    expect(pesan.toLowerCase()).not.toContain("luar jaringan");
  });

  it("luar jaringan dinyatakan apa adanya", () => {
    expect(alasanMuncul(null, "Andi").toLowerCase()).toContain("luar jaringan");
  });

  // Nama kosong wajar: profil tidak mewajibkan nama, alamat-lah identitasnya.
  it("tidak menghasilkan kalimat rusak saat nama kosong", () => {
    for (const hop of [0, 1, 2, null] as const) {
      const pesan = alasanMuncul(hop, "");
      expect(pesan.trim().length).toBeGreaterThan(5);
      expect(pesan).not.toContain("  ");
    }
  });
});
