import { describe, expect, it, vi } from "vitest";
import { buatCacheSingkat } from "../src/cache-singkat";

describe("buatCacheSingkat", () => {
  it("kunci sama dalam umurnya → hitung sekali; setelah umur habis → hitung lagi", async () => {
    const jam = { t: 0 };
    const c = buatCacheSingkat<number>(() => jam.t, 2000);
    const hitung = vi.fn(async () => 1);
    await c.ambil("k", hitung);
    jam.t = 1999;
    await c.ambil("k", hitung);
    expect(hitung).toHaveBeenCalledTimes(1);
    jam.t = 2000;
    await c.ambil("k", hitung);
    expect(hitung).toHaveBeenCalledTimes(2);
  });

  it("panggilan bersamaan berbagi satu promise", async () => {
    const c = buatCacheSingkat<number>(() => 0, 2000);
    let selesai!: (n: number) => void;
    const hitung = vi.fn(() => new Promise<number>((r) => { selesai = r; }));
    const p1 = c.ambil("k", hitung);
    const p2 = c.ambil("k", hitung);
    selesai(5);
    expect(await Promise.all([p1, p2])).toEqual([5, 5]);
    expect(hitung).toHaveBeenCalledTimes(1);
  });

  it("promise yang gagal tidak disimpan", async () => {
    const c = buatCacheSingkat<number>(() => 0, 2000);
    await expect(c.ambil("k", async () => { throw new Error("mati"); })).rejects.toThrow("mati");
    expect(await c.ambil("k", async () => 7)).toBe(7);
  });

  it("jumlah entri dibatasi — sejakId bebas dari query tidak bisa mengisi memori", async () => {
    const c = buatCacheSingkat<number>(() => 0, 2000, 3);
    for (let i = 0; i < 10; i++) await c.ambil(`k${i}`, async () => i);
    expect(c.ukuran()).toBeLessThanOrEqual(3);
  });
});
