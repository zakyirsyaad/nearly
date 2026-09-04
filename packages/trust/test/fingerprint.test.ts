import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { detectOperators, jaccard } from "../src/index";
import type { TrustEdge } from "../src/index";

const NOW = 1_700_000_000_000;
const MIN = 60_000;
const addr = (n: number): Address => (`0x${n.toString(16).padStart(40, "0")}`) as Address;

function edge(a: Address, b: Address, occasionId: string, atMs: number): TrustEdge {
  const [x, y] = a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
  return { a: x, b: y, occasionId, atMs, blocked: false };
}

describe("jaccard", () => {
  it("himpunan identik memberi 1", () => {
    expect(jaccard(new Set(["a", "b"]), new Set(["a", "b"]))).toBe(1);
  });
  it("tanpa irisan memberi 0", () => {
    expect(jaccard(new Set(["a"]), new Set(["b"]))).toBe(0);
  });
  it("dua himpunan kosong memberi 0, bukan NaN", () => {
    expect(jaccard(new Set(), new Set())).toBe(0);
  });
});

describe("detectOperators", () => {
  it("GERBANG: 5 akun dengan pola ko-lokasi identik tergabung jadi satu operator", () => {
    const edges: TrustEdge[] = [];
    const palsu = [901, 902, 903, 904, 905].map(addr);
    const korban = [1, 2, 3, 4, 5, 6].map(addr);

    // Kelima akun menyalami orang yang sama, di occasion yang sama, dalam menit yang sama.
    palsu.forEach((p, pi) => {
      korban.forEach((k, ki) => {
        edges.push(edge(p, k, "acara-a", NOW + ki * MIN + pi * 1000));
      });
    });

    const clusters = detectOperators(edges);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.members.sort()).toEqual(palsu.map((p) => p.toLowerCase()).sort());
  });

  it("orang jujur yang menghadiri acara sama TIDAK digabung", () => {
    const edges: TrustEdge[] = [];
    // Dua orang di acara yang sama, tapi menyalami orang yang sebagian besar berbeda.
    for (let i = 0; i < 8; i++) edges.push(edge(addr(11), addr(100 + i), "acara-a", NOW + i * MIN));
    for (let i = 0; i < 8; i++) edges.push(edge(addr(12), addr(200 + i), "acara-a", NOW + i * MIN));
    expect(detectOperators(edges)).toEqual([]);
  });

  it("koneksi identik tapi terpisah berhari-hari TIDAK digabung", () => {
    const edges: TrustEdge[] = [];
    const korban = [1, 2, 3, 4, 5, 6].map(addr);
    korban.forEach((k, i) => {
      edges.push(edge(addr(901), k, `acara-${i}`, NOW + i * MIN));
      edges.push(edge(addr(902), k, `acara-${i}`, NOW + i * MIN + 5 * 86_400_000));
    });
    expect(detectOperators(edges)).toEqual([]);
  });

  it("akun dengan koneksi di bawah ambang minimum diabaikan", () => {
    const edges: TrustEdge[] = [];
    [1, 2].forEach((k, i) => {
      edges.push(edge(addr(901), addr(k), "acara-a", NOW + i * MIN));
      edges.push(edge(addr(902), addr(k), "acara-a", NOW + i * MIN));
    });
    expect(detectOperators(edges)).toEqual([]);
  });

  it("id klaster adalah alamat terkecil, jadi deterministik", () => {
    const edges: TrustEdge[] = [];
    const palsu = [905, 901, 903].map(addr);
    const korban = [1, 2, 3, 4, 5, 6].map(addr);
    palsu.forEach((p, pi) => {
      korban.forEach((k, ki) => edges.push(edge(p, k, "acara-a", NOW + ki * MIN + pi * 1000)));
    });
    expect(detectOperators(edges)[0]!.id).toBe(addr(901).toLowerCase());
  });
});
