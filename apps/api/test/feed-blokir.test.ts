import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { petaHop } from "../src/feed-store";

const AKU = "0x00000000000000000000000000000000000000aa" as Address;
const B = "0x00000000000000000000000000000000000000bb";
const C = "0x00000000000000000000000000000000000000cc";

const tepi = (a: string, b: string) => ({ addr_a: a, addr_b: b });

describe("petaHop dengan blokir", () => {
  it("tanpa blokir, B satu lompatan dan C dua", () => {
    const h = petaHop(AKU, [tepi(AKU, B)], [tepi(B, C)], new Set());
    expect(h.get(B)).toBe(1);
    expect(h.get(C)).toBe(2);
  });

  it("memblokir B menghapus B dari peta", () => {
    const h = petaHop(AKU, [tepi(AKU, B)], [tepi(B, C)], new Set([B]));
    expect(h.has(B)).toBe(false);
  });

  // INI konsekuensi yang tidak akan diduga pengguna, dan yang membuat
  // penyaringan kandidat saja tidak cukup: C tadinya terjangkau LEWAT B.
  // Memblokir B memutus jalannya, jadi C keluar dari jangkauan sama sekali.
  it("memblokir B juga mengeluarkan C yang hanya terjangkau lewat B", () => {
    const h = petaHop(AKU, [tepi(AKU, B)], [tepi(B, C)], new Set([B]));
    expect(h.has(C)).toBe(false);
  });

  it("C tetap dua lompatan kalau ada jalan lain yang tidak lewat B", () => {
    const D = "0x00000000000000000000000000000000000000dd";
    const h = petaHop(AKU, [tepi(AKU, B), tepi(AKU, D)], [tepi(B, C), tepi(D, C)], new Set([B]));
    expect(h.get(C)).toBe(2);
  });

  it("alamat sendiri tetap nol walau entah bagaimana ada di himpunan blokir", () => {
    const h = petaHop(AKU, [], [], new Set([AKU.toLowerCase()]));
    expect(h.get(AKU.toLowerCase())).toBe(0);
  });
});
