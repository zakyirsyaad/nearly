import { describe, expect, it } from "vitest";
import { occasionIdOf, OCCASION_WINDOW_MS, rowsToGraph } from "../src/trust/load-graph";
import type { GraphRows } from "../src/trust/load-graph";

const NOW = 1_700_000_000_000;

function rows(over: Partial<GraphRows> = {}): GraphRows {
  return { connections: [], vouches: [], seeds: [], slashes: [], ...over };
}

describe("occasionIdOf", () => {
  it("dua koneksi di sel dan jendela yang sama masuk occasion yang sama", () => {
    expect(occasionIdOf("qqguv1r", NOW)).toBe(occasionIdOf("qqguv1r", NOW + 60_000));
  });

  it("sel berbeda menghasilkan occasion berbeda walau waktunya sama", () => {
    expect(occasionIdOf("qqguv1r", NOW)).not.toBe(occasionIdOf("w1xyz00", NOW));
  });

  it("selisih lebih dari satu jendela menghasilkan occasion berbeda", () => {
    expect(occasionIdOf("qqguv1r", NOW))
      .not.toBe(occasionIdOf("qqguv1r", NOW + OCCASION_WINDOW_MS * 2));
  });

  it("berbentuk cell:indeks supaya regionOf bisa membacanya", () => {
    expect(occasionIdOf("qqguv1r", NOW)).toMatch(/^qqguv1r:\d+$/);
  });
});

describe("rowsToGraph", () => {
  it("baris koneksi menjadi edge dengan occasion terhitung", () => {
    const g = rowsToGraph(
      rows({
        connections: [
          { addr_a: "0x0a", addr_b: "0x0b", cell: "qqguv1r", created_at: new Date(NOW).toISOString() },
        ],
      }),
      NOW,
    );
    expect(g.edges).toHaveLength(1);
    expect(g.edges[0]!.occasionId).toBe(occasionIdOf("qqguv1r", NOW));
    expect(g.edges[0]!.blocked).toBe(false);
  });

  it("koneksi lama tanpa cell tetap masuk graf, masing-masing occasion sendiri", () => {
    const g = rowsToGraph(
      rows({
        connections: [
          { addr_a: "0x0a", addr_b: "0x0b", cell: null, created_at: new Date(NOW).toISOString() },
          { addr_a: "0x0a", addr_b: "0x0c", cell: null, created_at: new Date(NOW).toISOString() },
        ],
      }),
      NOW,
    );
    // Koneksi Fase 1 tercatat sebelum kolom cell ada. Tidak boleh hilang dari
    // graf, tapi juga tidak boleh menyatu jadi satu occasion raksasa yang
    // menjatuhkan diversitas semua orang yang punya koneksi lama.
    expect(g.edges).toHaveLength(2);
    expect(g.edges[0]!.occasionId).not.toBe(g.edges[1]!.occasionId);
  });

  it("vouch yang sudah dicabut tidak ikut masuk", () => {
    const g = rowsToGraph(
      rows({
        vouches: [
          { from_addr: "0x0a", to_addr: "0x0b", created_at: new Date(NOW).toISOString(), revoked_at: null },
          { from_addr: "0x0a", to_addr: "0x0c", created_at: new Date(NOW).toISOString(), revoked_at: new Date(NOW).toISOString() },
        ],
      }),
      NOW,
    );
    expect(g.vouches).toHaveLength(1);
    expect(g.vouches[0]!.to).toBe("0x0b");
  });

  it("seed dan slash diteruskan, alamat dinormalkan huruf kecil", () => {
    const g = rowsToGraph(
      rows({ seeds: [{ address: "0x0A", weight: 3 }], slashes: [{ subject: "0x0C" }] }),
      NOW,
    );
    expect(g.seeds).toEqual([{ address: "0x0a", weight: 3 }]);
    expect(g.slashed).toEqual(["0x0c"]);
  });

  it("nowMs diteruskan ke graf", () => {
    expect(rowsToGraph(rows(), NOW).nowMs).toBe(NOW);
  });
});
