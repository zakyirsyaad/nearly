import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import {
  basisTrust, BOBOT_BARU, BOBOT_SUKA, BOBOT_TRUST, DIVERSITAS_LANTAI,
  DIVERSITAS_PELURUHAN, faktorJarak, faktorKebaruan, faktorSuka,
  JARAK_1_HOP, JARAK_2_HOP, JARAK_LUAR, pengaliDiversitas, PARUH_WAKTU_JAM,
  skorAwal, SUKA_JENUH,
} from "../src/feed-rank";
import type { FeedCandidate } from "../src/ports";

const NOW = 1_800_000_000_000;
const JAM = 3_600_000;

function kandidat(over: Partial<FeedCandidate> = {}): FeedCandidate {
  return {
    postId: `0x${"1".repeat(64)}` as Hex,
    author: "0x000000000000000000000000000000000000aaaa" as Address,
    displayName: "Andi",
    body: "halo", imageBucket: null, imageObject: null, imageMime: null,
    imageStatus: "none", createdAtMs: NOW, deleted: false,
    authorRatio: 0.01, authorTier: 1, authorConnections: 5, authorSlashed: false,
    reportCount: 0, likeCount: 0, sudahSuka: false, hop: 1,
    ...over,
  };
}

describe("konstanta terkunci ke spec §6.1", () => {
  it("bobotnya persis 0.5 / 0.2 / 0.3", () => {
    expect(BOBOT_TRUST).toBe(0.5);
    expect(BOBOT_SUKA).toBe(0.2);
    expect(BOBOT_BARU).toBe(0.3);
  });

  it("bobot berjumlah tepat 1", () => {
    expect(BOBOT_TRUST + BOBOT_SUKA + BOBOT_BARU).toBeCloseTo(1, 12);
  });

  it("faktor jarak persis 1.0 / 0.6 / 0.3", () => {
    expect(JARAK_1_HOP).toBe(1.0);
    expect(JARAK_2_HOP).toBe(0.6);
    expect(JARAK_LUAR).toBe(0.3);
  });

  it("paruh waktu 24 jam, kejenuhan suka 50", () => {
    expect(PARUH_WAKTU_JAM).toBe(24);
    expect(SUKA_JENUH).toBe(50);
  });

  it("peluruhan diversitas 0.5 dengan lantai 0.25", () => {
    expect(DIVERSITAS_PELURUHAN).toBe(0.5);
    expect(DIVERSITAS_LANTAI).toBe(0.25);
  });
});

describe("basisTrust", () => {
  it("rasio nol menghasilkan nol, bukan minus tak hingga", () => {
    expect(basisTrust(0)).toBe(0);
    expect(Number.isFinite(basisTrust(0))).toBe(true);
  });

  it("rasio negatif atau NaN diperlakukan sebagai nol", () => {
    expect(basisTrust(-1)).toBe(0);
    expect(basisTrust(Number.NaN)).toBe(0);
  });

  it("rasio 1 — penulis teratas di graf — menghasilkan tepat 1", () => {
    expect(basisTrust(1)).toBeCloseTo(1, 12);
  });

  it("monoton naik", () => {
    expect(basisTrust(0.5)).toBeGreaterThan(basisTrust(0.1));
  });

  /**
   * Inti spec §6.3, dan alasan seluruh kompresi ini ada: tanpa `ln`,
   * ketimpangan 1000x akan membuat peluruhan diversitas tidak menggigit.
   * Setelah kompresi, ketimpangan itu harus jatuh di bawah 3x.
   */
  it("menekan ketimpangan 1000x menjadi di bawah 3x", () => {
    const kecil = basisTrust(0.001);
    const besar = basisTrust(1);
    expect(besar / kecil).toBeLessThan(3);
    expect(besar / kecil).toBeGreaterThan(1);
  });
});

describe("faktorJarak", () => {
  it("1 hop penuh, 2 hop 0.6, luar jaringan 0.3", () => {
    expect(faktorJarak(1)).toBe(1.0);
    expect(faktorJarak(2)).toBe(0.6);
    expect(faktorJarak(null)).toBe(0.3);
  });
});

describe("faktorKebaruan", () => {
  it("unggahan baru bernilai 1", () => {
    expect(faktorKebaruan(NOW, NOW)).toBeCloseTo(1, 12);
  });

  it("tepat 24 jam bernilai setengah", () => {
    expect(faktorKebaruan(NOW - 24 * JAM, NOW)).toBeCloseTo(0.5, 12);
  });

  it("48 jam bernilai seperempat", () => {
    expect(faktorKebaruan(NOW - 48 * JAM, NOW)).toBeCloseTo(0.25, 12);
  });

  // Jam perangkat bisa mundur. Umur negatif tidak boleh membuat skor meledak.
  it("unggahan dari masa depan tidak melebihi 1", () => {
    expect(faktorKebaruan(NOW + 10 * JAM, NOW)).toBe(1);
  });
});

describe("faktorSuka", () => {
  it("tanpa suka bernilai nol", () => {
    expect(faktorSuka(0)).toBe(0);
  });

  it("tepat di titik jenuh bernilai 1", () => {
    expect(faktorSuka(SUKA_JENUH)).toBeCloseTo(1, 12);
  });

  it("dijepit di 1 walau suka jauh melebihi titik jenuh", () => {
    expect(faktorSuka(100_000)).toBe(1);
  });

  it("monoton naik", () => {
    expect(faktorSuka(10)).toBeGreaterThan(faktorSuka(1));
  });
});

describe("skorAwal", () => {
  it("unggahan 1 hop mengalahkan unggahan luar jaringan yang identik", () => {
    const dekat = skorAwal(kandidat({ hop: 1 }), NOW);
    const jauh = skorAwal(kandidat({ hop: null }), NOW);
    expect(dekat).toBeGreaterThan(jauh);
  });

  it("lebih banyak suka menaikkan skor", () => {
    expect(skorAwal(kandidat({ likeCount: 20 }), NOW))
      .toBeGreaterThan(skorAwal(kandidat({ likeCount: 0 }), NOW));
  });

  it("unggahan lebih baru mengalahkan yang lebih lama", () => {
    expect(skorAwal(kandidat({ createdAtMs: NOW }), NOW))
      .toBeGreaterThan(skorAwal(kandidat({ createdAtMs: NOW - 48 * JAM }), NOW));
  });

  it("penulis ber-rasio nol tetap mendapat skor positif dari kebaruan", () => {
    expect(skorAwal(kandidat({ authorRatio: 0 }), NOW)).toBeGreaterThan(0);
  });
});

describe("pengaliDiversitas", () => {
  it("unggahan pertama penulis tidak dikurangi", () => {
    expect(pengaliDiversitas(0)).toBeCloseTo(1, 12);
  });

  it("unggahan kedua 0.625, ketiga 0.4375", () => {
    expect(pengaliDiversitas(1)).toBeCloseTo(0.625, 12);
    expect(pengaliDiversitas(2)).toBeCloseTo(0.4375, 12);
  });

  // Lantai menjaga orang rajin tidak dihilangkan, cuma tidak menguasai.
  it("tidak pernah turun di bawah lantai", () => {
    expect(pengaliDiversitas(50)).toBeGreaterThanOrEqual(DIVERSITAS_LANTAI);
    expect(pengaliDiversitas(50)).toBeCloseTo(DIVERSITAS_LANTAI, 12);
  });

  it("monoton turun", () => {
    expect(pengaliDiversitas(3)).toBeLessThan(pengaliDiversitas(2));
  });
});
