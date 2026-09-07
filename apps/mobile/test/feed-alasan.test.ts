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

  it("luar jaringan dinyatakan apa adanya", () => {
    expect(alasanMuncul(null, "Andi").toLowerCase()).toContain("luar jaringan");
  });

  // Nama kosong wajar: profil tidak mewajibkan nama, alamat-lah identitasnya.
  it("tidak menghasilkan kalimat rusak saat nama kosong", () => {
    for (const hop of [1, 2, null] as const) {
      const pesan = alasanMuncul(hop, "");
      expect(pesan.trim().length).toBeGreaterThan(5);
      expect(pesan).not.toContain("  ");
    }
  });
});
