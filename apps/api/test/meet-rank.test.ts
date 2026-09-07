import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { hitungBaru, irisan, kecocokanDari } from "../src/meet-rank";
import type { Tanda } from "../src/ports";

const A = "0x00000000000000000000000000000000000000aa" as Address;
const B = "0x00000000000000000000000000000000000000bb" as Address;
const C = "0x00000000000000000000000000000000000000cc" as Address;
const T = 1_800_000_000_000;

const tanda = (address: Address, atMs: number): Tanda => ({ address, atMs });

describe("kecocokanDari", () => {
  it("dua orang yang saling menandai menghasilkan satu kecocokan", () => {
    const k = kecocokanDari([tanda(A, T)], [tanda(A, T + 1000)]);
    expect(k).toHaveLength(1);
    expect(k[0]!.address).toBe(A.toLowerCase());
  });

  // Kecocokan baru ADA saat tanda kedua dibuat, bukan yang pertama.
  it("sejakMs adalah waktu tanda yang LEBIH BARU", () => {
    expect(kecocokanDari([tanda(A, T)], [tanda(A, T + 5000)])[0]!.sejakMs).toBe(T + 5000);
    expect(kecocokanDari([tanda(A, T + 5000)], [tanda(A, T)])[0]!.sejakMs).toBe(T + 5000);
  });

  it("menandai satu arah saja bukan kecocokan", () => {
    expect(kecocokanDari([tanda(A, T)], [])).toHaveLength(0);
    expect(kecocokanDari([], [tanda(A, T)])).toHaveLength(0);
  });

  // Inilah yang membuat pencabutan bekerja tanpa kode penghapus: begitu satu
  // baris hilang, irisannya hilang.
  it("pencabutan satu pihak menghilangkan kecocokan", () => {
    const sebelum = kecocokanDari([tanda(A, T)], [tanda(A, T)]);
    const sesudah = kecocokanDari([], [tanda(A, T)]);
    expect(sebelum).toHaveLength(1);
    expect(sesudah).toHaveLength(0);
  });

  it("pencocokan tidak peka besar-kecil huruf", () => {
    const k = kecocokanDari(
      [tanda(A.toUpperCase() as Address, T)], [tanda(A, T)],
    );
    expect(k).toHaveLength(1);
    expect(k[0]!.address).toBe(A.toLowerCase());
  });

  it("mengurutkan yang terbaru lebih dulu", () => {
    const k = kecocokanDari(
      [tanda(A, T), tanda(B, T + 9000)],
      [tanda(A, T), tanda(B, T + 9000)],
    );
    expect(k.map((x) => x.address)).toEqual([B.toLowerCase(), A.toLowerCase()]);
  });

  // Tanpa pemecah seri, urutan dua kecocokan berwaktu sama bergantung urutan
  // masukan — dan itu membuat tes tidak bisa diandalkan.
  it("urutan deterministik untuk waktu yang sama", () => {
    const satu = kecocokanDari([tanda(A, T), tanda(B, T)], [tanda(A, T), tanda(B, T)]);
    const dua = kecocokanDari([tanda(B, T), tanda(A, T)], [tanda(B, T), tanda(A, T)]);
    expect(satu.map((x) => x.address)).toEqual(dua.map((x) => x.address));
  });

  it("himpunan kosong menghasilkan daftar kosong", () => {
    expect(kecocokanDari([], [])).toEqual([]);
  });
});

describe("hitungBaru", () => {
  const k = [
    { address: A, sejakMs: T + 5000 },
    { address: B, sejakMs: T + 1000 },
  ];

  // Belum pernah membuka layar kecocokan: SEMUANYA baru.
  it("dilihatAtMs null berarti semuanya baru", () => {
    expect(hitungBaru(k, null)).toBe(2);
  });

  it("menghitung hanya yang lebih baru dari waktu dilihat", () => {
    expect(hitungBaru(k, T + 2000)).toBe(1);
  });

  it("kecocokan tepat pada waktu dilihat TIDAK dihitung baru", () => {
    expect(hitungBaru(k, T + 5000)).toBe(0);
  });

  it("daftar kosong menghasilkan nol", () => {
    expect(hitungBaru([], null)).toBe(0);
  });
});

describe("irisan", () => {
  it("menghitung alamat yang ada di kedua himpunan", () => {
    expect(irisan([A, B, C], [B, C])).toBe(2);
  });

  it("tidak peka besar-kecil huruf", () => {
    expect(irisan([A.toUpperCase()], [A])).toBe(1);
  });

  // Duplikat di sisi kiri tidak boleh menggandakan hitungan — kalau tidak,
  // angka loop event bisa melebihi jumlah orang yang sebenarnya.
  it("duplikat dihitung sekali", () => {
    expect(irisan([A, A, A], [A])).toBe(1);
  });

  it("himpunan kosong menghasilkan nol", () => {
    expect(irisan([], [A])).toBe(0);
    expect(irisan([A], [])).toBe(0);
  });
});
