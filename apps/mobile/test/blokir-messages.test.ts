import { describe, expect, it } from "vitest";
import { blokirErrorMessage, blokirTombolLabel } from "../src/messages";

describe("blokirErrorMessage", () => {
  it("menerjemahkan setiap kode gerbang blokir", () => {
    for (const kode of ["expired", "bad_signature", "blokir_diri", "butuh_bukti", "invalid_body"]) {
      const p = blokirErrorMessage(kode);
      expect(p).not.toContain("_");
      expect(p.length).toBeGreaterThan(10);
    }
  });

  it("kode tak dikenal jatuh ke kalimat cadangan", () => {
    expect(blokirErrorMessage("entah-apa")).toBe(blokirErrorMessage("juga-entah"));
  });
});

describe("blokirTombolLabel", () => {
  it("belum diblokir → mengajak memblokir", () => {
    expect(blokirTombolLabel(false, false)).toContain("Blokir");
  });

  it("sudah diblokir → menawarkan mencabut", () => {
    expect(blokirTombolLabel(true, false)).toContain("Cabut");
  });

  // Label harus jujur tentang apa yang terjadi kalau diketuk. Sedang sibuk
  // berarti ketukan berikutnya tidak melakukan apa-apa, jadi labelnya tidak
  // boleh menjanjikan aksi.
  it("sedang sibuk → tidak menjanjikan aksi apa pun", () => {
    expect(blokirTombolLabel(false, true)).not.toContain("Blokir");
    expect(blokirTombolLabel(true, true)).not.toContain("Cabut");
  });
});
