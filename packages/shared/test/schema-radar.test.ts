import { describe, expect, it } from "vitest";
import { AturProfilRequestSchema, DetakRequestSchema } from "../src/schema";

const ALAMAT = "0x000000000000000000000000000000000000bEEF";
const SIG = `0x${"11".repeat(65)}`;

describe("DetakRequestSchema", () => {
  it("menerima sel geohash7", () => {
    expect(DetakRequestSchema.safeParse({ cell: "qqguv1r" }).success).toBe(true);
  });
  it("menolak sel yang bukan geohash7", () => {
    for (const cell of ["qqguv1", "qqguv1rr", "QQGUV1R", "qqguv1a", ""]) {
      expect(DetakRequestSchema.safeParse({ cell }).success).toBe(false);
    }
  });
  it("menolak badan tanpa sel", () => {
    expect(DetakRequestSchema.safeParse({}).success).toBe(false);
    expect(DetakRequestSchema.safeParse(null).success).toBe(false);
  });
});

describe("AturProfilRequestSchema", () => {
  const sah = { who: ALAMAT, displayName: "Budi", visibilitas: "terlihat", expiresAt: "1800000000", sig: SIG };
  it("menerima badan sah", () => expect(AturProfilRequestSchema.safeParse(sah).success).toBe(true));
  it("menolak visibilitas di luar dua mode", () => {
    for (const visibilitas of ["hantu", "ghost", "TERLIHAT", ""]) {
      expect(AturProfilRequestSchema.safeParse({ ...sah, visibilitas }).success).toBe(false);
    }
  });
  // Aturan nama sengaja di gerbang, bukan di skema (lihat komentar skema).
  it("TIDAK menolak nama bidi atau 33 code point — itu tugas gerbang", () => {
    expect(AturProfilRequestSchema.safeParse({ ...sah, displayName: "a‮b" }).success).toBe(true);
    expect(AturProfilRequestSchema.safeParse({ ...sah, displayName: "a".repeat(33) }).success).toBe(true);
  });
  it("menolak nama mentah lebih dari 256 karakter", () => {
    expect(AturProfilRequestSchema.safeParse({ ...sah, displayName: "a".repeat(257) }).success).toBe(false);
  });
  it("menolak expiresAt bukan angka", () => {
    expect(AturProfilRequestSchema.safeParse({ ...sah, expiresAt: "besok" }).success).toBe(false);
  });
});
