import { describe, expect, it } from "vitest";
import { METODE_PROFIL_SAYA_STORE, METODE_RADAR_STORE } from "../src/ports";

/**
 * Tes bentuk. Menambah atau menghapus metode harus jadi tindakan sadar, karena
 * dunia-radar.ts dan fake di support/deps.ts ikut berubah. Judul tanpa jumlah.
 */
describe("bentuk RadarStore dan ProfilSayaStore", () => {
  it("daftar metode RadarStore persis seperti yang tercatat", () => {
    expect(METODE_RADAR_STORE).toEqual([
      "ambilKehadiran", "simpanKehadiran", "hapusKehadiran", "hapusSemuaKehadiran",
      "hadirSejak", "terhubungDengan", "hitungNotifKedekatan", "sisipNotifKedekatan",
      "sapuLokasi",
    ]);
  });

  it("daftar metode ProfilSayaStore persis seperti yang tercatat", () => {
    expect(METODE_PROFIL_SAYA_STORE).toEqual(["profilSaya", "aturProfil", "visibilitasBanyak"]);
  });
});
