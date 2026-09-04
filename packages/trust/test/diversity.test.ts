import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import {
  clusteringCoefficient, DIVERSITY_FLOOR, diversityMultiplier,
  neighborsOf, normalizedEntropy, regionOf,
} from "../src/index";
import type { TrustEdge } from "../src/index";

const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const addr = (n: number): Address => (`0x${n.toString(16).padStart(40, "0")}`) as Address;
const HUB = addr(1);

function edge(a: Address, b: Address, occasionId: string, atMs: number): TrustEdge {
  const [x, y] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
  return { a: x, b: y, occasionId, atMs, blocked: false };
}

describe("normalizedEntropy", () => {
  it("semua di satu ember memberi 0", () => {
    expect(normalizedEntropy([50])).toBe(0);
  });

  it("tersebar merata mendekati 1", () => {
    expect(normalizedEntropy([10, 10, 10, 10, 10])).toBeCloseTo(1, 6);
  });

  it("tersebar timpang berada di antaranya", () => {
    const h = normalizedEntropy([47, 1, 1, 1]);
    expect(h).toBeGreaterThan(0);
    expect(h).toBeLessThan(0.5);
  });

  it("kosong memberi 0, bukan NaN", () => {
    expect(normalizedEntropy([])).toBe(0);
  });
});

describe("clusteringCoefficient", () => {
  it("segitiga tertutup memberi 1", () => {
    const n = neighborsOf([
      edge(addr(1), addr(2), "o", NOW),
      edge(addr(2), addr(3), "o", NOW),
      edge(addr(1), addr(3), "o", NOW),
    ]);
    expect(clusteringCoefficient(addr(1).toLowerCase(), n)).toBe(1);
  });

  it("bintang tanpa segitiga memberi 0", () => {
    const n = neighborsOf([
      edge(HUB, addr(2), "o", NOW),
      edge(HUB, addr(3), "o", NOW),
      edge(HUB, addr(4), "o", NOW),
    ]);
    expect(clusteringCoefficient(HUB.toLowerCase(), n)).toBe(0);
  });

  it("kurang dari dua tetangga memberi 0", () => {
    const n = neighborsOf([edge(HUB, addr(2), "o", NOW)]);
    expect(clusteringCoefficient(HUB.toLowerCase(), n)).toBe(0);
  });
});

describe("diversityMultiplier", () => {
  it("GERBANG: 50 koneksi di 1 occasion jauh di bawah 50 koneksi di 10 occasion", () => {
    const sempit: TrustEdge[] = [];
    const luas: TrustEdge[] = [];
    for (let i = 0; i < 50; i++) {
      sempit.push(edge(HUB, addr(100 + i), "satu-ruangan", NOW));
      luas.push(edge(HUB, addr(100 + i), `acara-${i % 10}`, NOW - (i % 10) * 30 * DAY));
    }
    const a = diversityMultiplier(HUB.toLowerCase(), sempit, neighborsOf(sempit));
    const b = diversityMultiplier(HUB.toLowerCase(), luas, neighborsOf(luas));
    expect(a).toBe(DIVERSITY_FLOOR);
    expect(b).toBeGreaterThan(a * 2);
  });

  it("tidak pernah turun di bawah lantai, supaya pengguna baru tidak difitnah", () => {
    const satu = [edge(HUB, addr(2), "o1", NOW)];
    expect(diversityMultiplier(HUB.toLowerCase(), satu, neighborsOf(satu))).toBe(DIVERSITY_FLOOR);
  });

  it("tidak pernah melebihi 1", () => {
    const edges: TrustEdge[] = [];
    for (let i = 0; i < 20; i++) edges.push(edge(HUB, addr(200 + i), `o-${i}`, NOW - i * 40 * DAY));
    expect(diversityMultiplier(HUB.toLowerCase(), edges, neighborsOf(edges))).toBeLessThanOrEqual(1);
  });

  it("lingkaran yang semuanya saling kenal dihukum clustering", () => {
    const rapat: TrustEdge[] = [];
    const orang = [1, 2, 3, 4, 5, 6].map(addr);
    for (let i = 0; i < orang.length; i++) {
      for (let j = i + 1; j < orang.length; j++) {
        rapat.push(edge(orang[i]!, orang[j]!, `o-${(i + j) % 5}`, NOW - ((i + j) % 5) * 30 * DAY));
      }
    }
    const longgar: TrustEdge[] = [];
    for (let i = 0; i < 5; i++) longgar.push(edge(HUB, addr(300 + i), `o-${i}`, NOW - i * 30 * DAY));

    const rapatSkor = diversityMultiplier(orang[0]!.toLowerCase(), rapat, neighborsOf(rapat));
    const longgarSkor = diversityMultiplier(HUB.toLowerCase(), longgar, neighborsOf(longgar));
    expect(rapatSkor).toBeLessThan(longgarSkor);
  });
});

describe("regionOf", () => {
  it("mengambil 4 huruf pertama sel geohash", () => {
    expect(regionOf("qqguv1r:5")).toBe("qqgu");
  });
});
