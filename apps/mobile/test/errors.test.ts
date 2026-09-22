import { describe, expect, it } from "vitest";
import { pesanGagal } from "../src/errors";

describe("pesanGagal", () => {
  const kodeDikenal = [
    "quota_exceeded",
    "not_connected",
    "already_vouched",
    "not_vouched",
    "bad_signature",
    "chain_error",
    "self_vouch",
    "expired",
    "invalid_body",
  ];

  it.each(kodeDikenal)("memetakan kode '%s' ke kalimat Inggris yang tidak kosong", (kode) => {
    const pesan = pesanGagal(kode);
    expect(pesan.length).toBeGreaterThan(0);
    // Kalimatnya bukan sekadar kode mentah yang dikembalikan apa adanya.
    expect(pesan).not.toBe(kode);
  });

  it("kode tak dikenal jatuh ke pesan default, bukan kode mentah", () => {
    expect(pesanGagal("kode_asing_yang_tidak_ada")).not.toBe("kode_asing_yang_tidak_ada");
    expect(pesanGagal("kode_asing_yang_tidak_ada").length).toBeGreaterThan(0);
  });
});
