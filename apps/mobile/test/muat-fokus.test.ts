import { describe, expect, it } from "vitest";
import { bolehMuatFokus, JEDA_MUAT_FOKUS_MS } from "../src/muat-fokus";

// Spec desain UI §4.6: layar tab memuat saat fokus, paling sering sekali per
// 30 detik — setara "satu tanda tangan per pembukaan beranda" hari ini.
describe("batas muat saat fokus", () => {
  it("pemuatan pertama selalu boleh", () => {
    expect(bolehMuatFokus(null, 1_000)).toBe(true);
  });

  it("pemuatan berikutnya ditahan sampai jeda terlewati", () => {
    expect(bolehMuatFokus(1_000, 1_000)).toBe(false);
    expect(bolehMuatFokus(1_000, 1_000 + JEDA_MUAT_FOKUS_MS - 1)).toBe(false);
    expect(bolehMuatFokus(1_000, 1_000 + JEDA_MUAT_FOKUS_MS)).toBe(true);
  });

  it("jedanya tiga puluh detik", () => {
    expect(JEDA_MUAT_FOKUS_MS).toBe(30_000);
  });
});
