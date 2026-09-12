import { describe, expect, it } from "vitest";
import { BlokirRequestSchema } from "../src/schema";

const dasar = {
  target: "0x000000000000000000000000000000000000beef",
  who: "0x000000000000000000000000000000000000cafe",
  blokir: true,
  expiresAt: "1800000000",
  sig: `0x${"11".repeat(65)}`,
};

describe("BlokirRequestSchema", () => {
  it("menerima badan yang sah", () => {
    expect(BlokirRequestSchema.safeParse(dasar).success).toBe(true);
  });

  // Tipe EIP-712-nya `bool`. String "true" menghasilkan digest berbeda tanpa
  // suara, jadi harus ditolak di sini, bukan ditemukan sebagai tanda tangan
  // yang misterius tidak cocok.
  it("menolak `blokir` berupa string", () => {
    expect(BlokirRequestSchema.safeParse({ ...dasar, blokir: "true" }).success).toBe(false);
  });

  // Penolakan memblokir diri sendiri hidup di GERBANG, bukan di sini
  // (spec §7.1). Kalau skema ikut menolaknya, pemeriksaan gerbang tidak
  // pernah terjangkau lewat rute dan menjadi kode mati.
  it("MENERIMA target sama dengan who — penolakannya tugas gerbang", () => {
    expect(BlokirRequestSchema.safeParse({ ...dasar, target: dasar.who }).success).toBe(true);
  });

  it("menolak alamat yang bukan heksadesimal 40 digit", () => {
    expect(BlokirRequestSchema.safeParse({ ...dasar, target: "0xbukan" }).success).toBe(false);
  });

  // safeParse TIDAK BOLEH melempar untuk apa pun. Fase 3a pernah kebobolan:
  // `.refine` yang memanggil BigInt() atas string non-angka melempar
  // SyntaxError yang lolos dari safeParse dan berakhir 500, bukan 400.
  it("expiresAt non-angka gagal bersih, tanpa melempar", () => {
    expect(() => BlokirRequestSchema.safeParse({ ...dasar, expiresAt: "besok" }))
      .not.toThrow();
    expect(BlokirRequestSchema.safeParse({ ...dasar, expiresAt: "besok" }).success).toBe(false);
  });

  it("menolak tanda tangan yang panjangnya salah", () => {
    expect(BlokirRequestSchema.safeParse({ ...dasar, sig: `0x${"11".repeat(64)}` }).success)
      .toBe(false);
  });
});
