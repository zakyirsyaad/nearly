import { describe, expect, it } from "vitest";
import {
  DaftarKunciPesanRequestSchema, KirimPesanRequestSchema, LaporanPesanRequestSchema,
  TandaiDibacaRequestSchema, TokenPushRequestSchema,
} from "../src/schema";

const ALAMAT = "0x000000000000000000000000000000000000bEEF";
const KUNCI = `0x${"ab".repeat(32)}`;
const SIG = `0x${"11".repeat(65)}`;
const ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";

describe("DaftarKunciPesanRequestSchema", () => {
  const sah = { who: ALAMAT, kunciEnkripsi: KUNCI, kunciTanda: KUNCI, expiresAt: "1800000000", sig: SIG };
  it("menerima badan sah", () => expect(DaftarKunciPesanRequestSchema.safeParse(sah).success).toBe(true));
  // Kolom basis data menuntut huruf kecil; skema menolak lebih dulu dengan 400
  // alih-alih membiarkan CHECK Postgres menjadi 500.
  it("menolak kunci berhuruf besar", () => {
    expect(DaftarKunciPesanRequestSchema.safeParse({ ...sah, kunciTanda: `0x${"AB".repeat(32)}` }).success).toBe(false);
  });
  it("menolak kunci yang bukan 32 byte", () => {
    expect(DaftarKunciPesanRequestSchema.safeParse({ ...sah, kunciEnkripsi: "0xab" }).success).toBe(false);
  });
});

describe("KirimPesanRequestSchema", () => {
  const sah = { id: ID, penerima: ALAMAT, ciphertext: "QUJD", nonce: `0x${"cd".repeat(24)}` };
  it("menerima badan sah", () => expect(KirimPesanRequestSchema.safeParse(sah).success).toBe(true));
  it("menolak id yang bukan uuid", () => expect(KirimPesanRequestSchema.safeParse({ ...sah, id: "x" }).success).toBe(false));
  it("menolak ciphertext bukan base64", () => expect(KirimPesanRequestSchema.safeParse({ ...sah, ciphertext: "a b" }).success).toBe(false));
  it("batas ciphertext 16384 karakter", () => {
    expect(KirimPesanRequestSchema.safeParse({ ...sah, ciphertext: "A".repeat(16385) }).success).toBe(false);
    expect(KirimPesanRequestSchema.safeParse({ ...sah, ciphertext: "A".repeat(16384) }).success).toBe(true);
  });
  it("menolak nonce yang bukan 24 byte", () => {
    expect(KirimPesanRequestSchema.safeParse({ ...sah, nonce: `0x${"cd".repeat(12)}` }).success).toBe(false);
  });
  // Tidak ada pemeriksaan penerima = pengirim di sini: pengirim datang dari
  // header terautentikasi, bukan badan. Gerbang yang menolaknya (spec 4c §7).
});

describe("TandaiDibacaRequestSchema", () => {
  it("menerima bilangan bulat non-negatif", () => expect(TandaiDibacaRequestSchema.safeParse({ sampaiMs: 5 }).success).toBe(true));
  it("menolak pecahan dan negatif", () => {
    expect(TandaiDibacaRequestSchema.safeParse({ sampaiMs: 1.5 }).success).toBe(false);
    expect(TandaiDibacaRequestSchema.safeParse({ sampaiMs: -1 }).success).toBe(false);
  });
});

describe("TokenPushRequestSchema", () => {
  it("menerima token Expo", () => {
    expect(TokenPushRequestSchema.safeParse({ token: "ExponentPushToken[abc123_-]" }).success).toBe(true);
    expect(TokenPushRequestSchema.safeParse({ token: "ExpoPushToken[abc]" }).success).toBe(true);
  });
  it("menolak string sembarang", () => expect(TokenPushRequestSchema.safeParse({ token: "halo" }).success).toBe(false));
});

describe("LaporanPesanRequestSchema", () => {
  const laporan = {
    reporter: ALAMAT, subject: "0x000000000000000000000000000000000000cafe",
    reason: "mengirim ancaman berulang kali", expiresAt: "1800000000", sig: SIG,
  };
  const bukti = { pesanId: ID, isi: "halo", dikirimMs: 1, tanda: `0x${"ee".repeat(64)}` };
  it("menerima satu sampai lima bukti", () => {
    expect(LaporanPesanRequestSchema.safeParse({ laporan, bukti: [bukti] }).success).toBe(true);
    expect(LaporanPesanRequestSchema.safeParse({ laporan, bukti: Array(5).fill(bukti) }).success).toBe(true);
  });
  it("menolak nol atau enam bukti", () => {
    expect(LaporanPesanRequestSchema.safeParse({ laporan, bukti: [] }).success).toBe(false);
    expect(LaporanPesanRequestSchema.safeParse({ laporan, bukti: Array(6).fill(bukti) }).success).toBe(false);
  });
  it("menolak tanda yang bukan 64 byte", () => {
    expect(LaporanPesanRequestSchema.safeParse({ laporan, bukti: [{ ...bukti, tanda: "0xee" }] }).success).toBe(false);
  });
  it("menolak laporan yang tidak sah menurut ReportRequestSchema", () => {
    expect(LaporanPesanRequestSchema.safeParse({ laporan: { ...laporan, reason: "pendek" }, bukti: [bukti] }).success).toBe(false);
  });
});
