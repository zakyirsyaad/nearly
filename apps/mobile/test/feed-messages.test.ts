import { describe, expect, it } from "vitest";
import { feedErrorMessage } from "../src/messages";

describe("feedErrorMessage", () => {
  it("menerjemahkan setiap kode gerbang feed ke kalimat untuk orang", () => {
    for (const kode of [
      "post_exists", "post_not_found", "not_author",
      "image_slot_taken", "image_too_large", "bad_signature", "expired", "invalid_body",
    ]) {
      const pesan = feedErrorMessage(kode);
      expect(pesan).not.toContain("_");
      expect(pesan.length).toBeGreaterThan(10);
    }
  });

  it("kode yang tidak dikenal tetap menghasilkan kalimat, bukan kode mentah", () => {
    expect(feedErrorMessage("kode_aneh_dari_masa_depan")).not.toContain("kode_aneh");
  });

  it("image_unavailable tidak menyuruh coba lagi — mencoba ulang tidak menolong", () => {
    expect(feedErrorMessage("image_unavailable")).not.toMatch(/try again/i);
  });
});
