import { describe, expect, it } from "vitest";
import type { HalamanGraf } from "../src/api";
import { DURASI_SOROT_MS, gabungHalaman, KEADAAN_KOSONG, type KeadaanGraf } from "../src/gabung-graf";

const A = "0x00000000000000000000000000000000000000AA";
const B = "0x00000000000000000000000000000000000000bb";
const C = "0x00000000000000000000000000000000000000cc";

function halaman(over: Partial<HalamanGraf> = {}): HalamanGraf {
  return {
    simpul: [
      { address: A, displayName: "Budi", tierLabel: "Baru" },
      { address: B, displayName: "", tierLabel: "Dikenal" },
    ],
    sisi: [{ id: 1, a: A, b: B, atMs: 10, txHash: "0x01" }],
    kursor: 1,
    lengkap: true,
    ...over,
  };
}

/** Salinan dalam yang bisa dibandingkan — Map dibekukan jadi array. */
function potret(k: KeadaanGraf) {
  return JSON.parse(JSON.stringify({ simpul: [...k.simpul], sisi: [...k.sisi], kursor: k.kursor }));
}

describe("gabungHalaman", () => {
  it("simpul dikunci alamat huruf kecil, sisi dikunci id", () => {
    const k = gabungHalaman(KEADAAN_KOSONG, halaman(), { nowMs: 0, sorot: false });
    expect([...k.simpul.keys()]).toEqual([A.toLowerCase(), B.toLowerCase()]);
    expect(k.sisi.get(1)).toMatchObject({ a: A.toLowerCase(), b: B.toLowerCase() });
  });

  it("sisi dan simpul yang sama tidak diduplikasi", () => {
    const k1 = gabungHalaman(KEADAAN_KOSONG, halaman(), { nowMs: 0, sorot: false });
    const k2 = gabungHalaman(k1, halaman({
      simpul: [{ address: A.toLowerCase(), displayName: "Budi", tierLabel: "Baru" }],
    }), { nowMs: 0, sorot: true });
    expect(k2.sisi.size).toBe(1);
    expect(k2.simpul.size).toBe(2);
  });

  it("respons tanpa perubahan mengembalikan keadaan yang sama persis", () => {
    const k1 = gabungHalaman(KEADAAN_KOSONG, halaman(), { nowMs: 0, sorot: false });
    expect(gabungHalaman(k1, halaman(), { nowMs: 5, sorot: true })).toBe(k1);
  });

  it("data simpul yang lebih baru menimpa nama dan tier, tanpa menyalakan ulang simpul lama", () => {
    const k1 = gabungHalaman(KEADAAN_KOSONG, halaman(), { nowMs: 0, sorot: false });
    const k2 = gabungHalaman(k1, halaman({
      simpul: [{ address: A, displayName: "Budi Santoso", tierLabel: "Inti" }], sisi: [],
    }), { nowMs: 100, sorot: true });
    expect(k2.simpul.get(A.toLowerCase())).toEqual({
      address: A.toLowerCase(), displayName: "Budi Santoso", tierLabel: "Inti", baruSampaiMs: null,
    });
  });

  it("kursor tidak pernah mundur", () => {
    const k1 = gabungHalaman(KEADAAN_KOSONG, halaman({ kursor: 50 }), { nowMs: 0, sorot: false });
    const k2 = gabungHalaman(k1, halaman({ simpul: [], sisi: [], kursor: 7 }), { nowMs: 0, sorot: false });
    expect(k2.kursor).toBe(50);
  });

  it("keadaan lama tidak termutasi", () => {
    const k1 = gabungHalaman(KEADAAN_KOSONG, halaman(), { nowMs: 0, sorot: false });
    const sebelum = potret(k1);
    gabungHalaman(k1, halaman({
      simpul: [{ address: A, displayName: "Lain", tierLabel: "Inti" }, { address: C, displayName: "", tierLabel: "Baru" }],
      sisi: [{ id: 2, a: B, b: C, atMs: 20, txHash: "0x02" }],
      kursor: 2,
    }), { nowMs: 1, sorot: true });
    expect(potret(k1)).toEqual(sebelum);
    expect(potret(KEADAAN_KOSONG)).toEqual({ simpul: [], sisi: [], kursor: 0 });
  });

  it("sorot: sisi dan simpul baru menyala 4 detik; muatan awal tidak", () => {
    const awal = gabungHalaman(KEADAAN_KOSONG, halaman(), { nowMs: 1_000, sorot: false });
    expect(awal.sisi.get(1)!.baruSampaiMs).toBeNull();

    const k = gabungHalaman(awal, halaman({
      simpul: [{ address: C, displayName: "", tierLabel: "Baru" }],
      sisi: [{ id: 2, a: B, b: C, atMs: 20, txHash: "0x02" }],
      kursor: 2,
    }), { nowMs: 5_000, sorot: true });
    expect(k.sisi.get(2)!.baruSampaiMs).toBe(5_000 + DURASI_SOROT_MS);
    expect(k.simpul.get(C.toLowerCase())!.baruSampaiMs).toBe(5_000 + DURASI_SOROT_MS);
    expect(k.sisi.get(1)!.baruSampaiMs).toBeNull();
  });

  it("sisi yang ujungnya tidak disertakan simpul tetap punya simpul pengganti", () => {
    const k = gabungHalaman(KEADAAN_KOSONG, halaman({ simpul: [] }), { nowMs: 0, sorot: false });
    expect(k.simpul.get(A.toLowerCase())).toEqual({
      address: A.toLowerCase(), displayName: "", tierLabel: "Baru", baruSampaiMs: null,
    });
  });
});
