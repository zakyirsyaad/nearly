import { describe, expect, it } from "vitest";
import { METODE_PERTEMUAN_STORE } from "../src/ports";

/**
 * Tes bentuk. Menambah atau menghapus metode harus jadi tindakan sadar, karena
 * support/deps.ts, handshake.route.test.ts, dan dunia-pertemuan.ts ikut berubah.
 */
describe("bentuk PertemuanStore", () => {
  it("daftar metode PertemuanStore persis seperti yang tercatat", () => {
    expect(METODE_PERTEMUAN_STORE).toEqual(["koneksiPasangan", "acaraCheckInBersama", "penjaminAktif"]);
  });
});
