import { describe, expect, it } from "vitest";
import { METODE_PESAN_STORE } from "../src/ports";

/**
 * Tes bentuk. Menambah atau menghapus metode PesanStore harus jadi tindakan
 * sadar, karena dunia-pesan.ts dan fake di support/deps.ts ikut berubah.
 * Judulnya sengaja tidak menyebut jumlah.
 */
describe("bentuk PesanStore", () => {
  it("daftar metodenya persis seperti yang tercatat", () => {
    expect(METODE_PESAN_STORE).toEqual([
      "simpanKunci", "ambilKunci", "simpanPesan", "hitungTerkirimSejak",
      "pesanTerbaruUntuk", "belumDibacaPerPengirim", "riwayat", "tandaiDibaca",
      "adaBelumDibacaLainDari", "simpanTokenPush", "tokenPush", "hapusTokenPush",
      "pesanBerdasarkanId", "gantiBuktiLaporan",
    ]);
  });
});
