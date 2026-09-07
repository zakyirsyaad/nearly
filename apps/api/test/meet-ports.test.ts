import { describe, expect, it } from "vitest";
import { METODE_MEET_STORE } from "../src/ports";

/**
 * Tes bentuk, bukan perilaku. Ia ada supaya penambahan atau penghapusan
 * metode di MeetStore menjadi tindakan sadar: setiap fake di tes gerbang
 * harus ikut diperbarui, dan tanpa daftar ini yang gagal cuma typecheck di
 * berkas yang jauh dari sumber perubahan.
 */
describe("bentuk MeetStore", () => {
  it("punya sembilan metode dengan nama yang tepat", () => {
    expect(METODE_MEET_STORE).toEqual([
      "setTanda", "hitungTanda", "adaTanda", "tandaOleh", "tandaKe",
      "cocokDilihatAtMs", "setCocokDilihat", "profilRingkas", "hitungTandaBanyak",
    ]);
  });
});
