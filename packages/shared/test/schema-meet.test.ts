import { describe, expect, it } from "vitest";
import { InginBertemuRequestSchema, TandaiDilihatRequestSchema } from "../src/schema";

const A = `0x${"a".repeat(40)}`;
const B = `0x${"b".repeat(40)}`;
const SIG = `0x${"c".repeat(130)}`;

function tanda(over: Record<string, unknown> = {}) {
  return { target: A, who: B, ingin: true, expiresAt: "1800000000", sig: SIG, ...over };
}

describe("InginBertemuRequestSchema", () => {
  it("menerima permintaan menandai", () => {
    expect(InginBertemuRequestSchema.safeParse(tanda()).success).toBe(true);
  });

  it("menerima permintaan mencabut", () => {
    expect(InginBertemuRequestSchema.safeParse(tanda({ ingin: false })).success).toBe(true);
  });

  // "true" string BUKAN boolean. Tipe EIP-712-nya bool, jadi menerima string
  // menghasilkan digest yang berbeda tanpa suara.
  it("menolak ingin berupa string", () => {
    expect(InginBertemuRequestSchema.safeParse(tanda({ ingin: "true" })).success).toBe(false);
  });

  it("menolak alamat yang bukan heksa 40 digit", () => {
    expect(InginBertemuRequestSchema.safeParse(tanda({ target: "0xbukan" })).success).toBe(false);
  });

  // Penolakan menandai diri sendiri ada di GERBANG (spec §13.7), bukan di
  // sini. Skema sengaja menerimanya supaya pemeriksaan gerbang benar-benar
  // terjangkau lewat rute dan tidak membusuk sebagai kode mati.
  it("MENERIMA target sama dengan who — itu urusan gerbang", () => {
    expect(InginBertemuRequestSchema.safeParse(tanda({ target: A, who: A })).success).toBe(true);
  });

  // Bukan 500. Fase 3a menemukan bahwa refine yang memanggil BigInt() atas
  // masukan bukan angka melempar SyntaxError yang lolos dari safeParse.
  it("menolak expiresAt bukan angka tanpa melempar", () => {
    expect(() => InginBertemuRequestSchema.safeParse(tanda({ expiresAt: "besok" }))).not.toThrow();
    expect(InginBertemuRequestSchema.safeParse(tanda({ expiresAt: "besok" })).success).toBe(false);
  });
});

describe("TandaiDilihatRequestSchema", () => {
  const dasar = { who: A, expiresAt: "1800000000", sig: SIG };

  it("menerima permintaan yang benar", () => {
    expect(TandaiDilihatRequestSchema.safeParse(dasar).success).toBe(true);
  });

  // Tipe TandaiDilihat tidak berbicara tentang orang lain, jadi skemanya pun
  // tidak boleh menuntut target.
  it("tidak menuntut target", () => {
    expect("target" in TandaiDilihatRequestSchema.parse(dasar)).toBe(false);
  });

  it("menolak tanda tangan yang panjangnya salah", () => {
    expect(TandaiDilihatRequestSchema.safeParse({ ...dasar, sig: "0xabc" }).success).toBe(false);
  });
});
