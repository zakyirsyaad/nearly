import { describe, expect, it } from "vitest";
import { jedaBerikutnya } from "../src/jeda";

describe("jeda coba ulang", () => {
  it("sehat 3 detik; gagal beruntun 3 → 6 → 12 → tetap 12; berhasil kembali 3", () => {
    const urutan = [0, 1, 2, 3, 4, 9, 0].map(jedaBerikutnya);
    expect(urutan).toEqual([3_000, 3_000, 6_000, 12_000, 12_000, 12_000, 3_000]);
  });
});
