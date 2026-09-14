import { describe, expect, it } from "vitest";
import { METODE_GRAF_STORE } from "../src/ports";

/**
 * Tes bentuk. Menambah metode GrafStore harus jadi tindakan sadar: dunia-graf.ts
 * dan fake di support/deps.ts ikut berubah, dan setiap metode baru adalah
 * pintu baru ke data publik yang harus melewati penyaring kunci.
 */
describe("bentuk GrafStore", () => {
  it("daftar metodenya persis seperti yang tercatat", () => {
    expect(METODE_GRAF_STORE).toEqual([
      "koneksiSejak", "acara", "acaraBeririsan", "checkInAcara", "koneksiDalamJendela", "daftarAcara",
    ]);
  });
});
