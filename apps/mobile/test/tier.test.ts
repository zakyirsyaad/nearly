import { describe, expect, it } from "vitest";
import { SUGGESTED_TAGS, tierView } from "../src/tier";

const bukti = { connections: 47, occasions: 6, regions: 3, vouches: 12 };

describe("tierView", () => {
  it("menyusun label dan baris bukti sesuai spec §8", () => {
    const v = tierView(2, bukti);
    expect(v.label).toBe("Terpercaya");
    expect(v.evidenceLine).toBe("47 koneksi · 6 occasion · 3 wilayah · 12 vouch");
  });

  it("pengguna baru tanpa apa pun tetap punya baris bukti yang jujur", () => {
    const v = tierView(0, { connections: 0, occasions: 0, regions: 0, vouches: 0 });
    expect(v.label).toBe("Baru");
    expect(v.evidenceLine).toBe("belum ada koneksi");
  });

  it("menghilangkan bagian yang bernilai nol, bukan menulis '0 vouch'", () => {
    const v = tierView(1, { connections: 3, occasions: 1, regions: 1, vouches: 0 });
    expect(v.evidenceLine).toBe("3 koneksi · 1 occasion · 1 wilayah");
  });

  it("tier di luar rentang jatuh ke Baru, bukan undefined", () => {
    expect(tierView(9, bukti).label).toBe("Baru");
    expect(tierView(-1, bukti).label).toBe("Baru");
  });

  it("tag saran ada dan tidak kosong", () => {
    expect(SUGGESTED_TAGS.length).toBeGreaterThan(0);
    for (const t of SUGGESTED_TAGS) expect(t.trim()).toBe(t);
  });
});
