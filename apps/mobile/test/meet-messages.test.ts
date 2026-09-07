import { describe, expect, it } from "vitest";
import { meetErrorMessage } from "../src/messages";

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
