import { describe, expect, it } from "vitest";
import {
  AttachImageRequestSchema, CreatePostRequestSchema, DeletePostRequestSchema,
  LikeRequestSchema, ReportPostRequestSchema,
} from "../src/schema";

const ADDR = `0x${"a".repeat(40)}`;
const ID = `0x${"1".repeat(64)}`;
const SIG = `0x${"b".repeat(130)}`;

function post(over: Record<string, unknown> = {}) {
  return { postId: ID, author: ADDR, body: "halo dunia", expiresAt: "1800000000", sig: SIG, ...over };
}

describe("CreatePostRequestSchema", () => {
  it("menerima permintaan yang benar", () => {
    expect(CreatePostRequestSchema.safeParse(post()).success).toBe(true);
  });

  it("menolak body kosong", () => {
    expect(CreatePostRequestSchema.safeParse(post({ body: "" })).success).toBe(false);
  });

  it("menolak body lebih dari 500 karakter", () => {
    expect(CreatePostRequestSchema.safeParse(post({ body: "a".repeat(501) })).success).toBe(false);
  });

  it("menerima body tepat 500 karakter", () => {
    expect(CreatePostRequestSchema.safeParse(post({ body: "a".repeat(500) })).success).toBe(true);
  });

  // Bukan 500. Fase 3a menemukan bahwa refine yang memanggil BigInt() atas
  // masukan bukan angka melempar SyntaxError yang lolos dari safeParse.
  it("menolak expiresAt bukan angka tanpa melempar", () => {
    expect(() => CreatePostRequestSchema.safeParse(post({ expiresAt: "besok" }))).not.toThrow();
    expect(CreatePostRequestSchema.safeParse(post({ expiresAt: "besok" })).success).toBe(false);
  });
});

describe("LikeRequestSchema", () => {
  const dasar = { postId: ID, who: ADDR, suka: true, expiresAt: "1800000000", sig: SIG };

  it("menerima suka true", () => {
    expect(LikeRequestSchema.safeParse(dasar).success).toBe(true);
  });

  it("menerima suka false", () => {
    expect(LikeRequestSchema.safeParse({ ...dasar, suka: false }).success).toBe(true);
  });

  // "true" string BUKAN boolean. Tipe EIP-712-nya bool, jadi menerima string
  // di sini menghasilkan digest yang berbeda tanpa suara.
  it("menolak suka berupa string", () => {
    expect(LikeRequestSchema.safeParse({ ...dasar, suka: "true" }).success).toBe(false);
  });
});

describe("ReportPostRequestSchema", () => {
  const dasar = {
    postId: ID, reporter: ADDR, reason: "spam berulang di feed",
    expiresAt: "1800000000", sig: SIG,
  };

  it("menerima alasan yang cukup panjang", () => {
    expect(ReportPostRequestSchema.safeParse(dasar).success).toBe(true);
  });

  it("menolak alasan terlalu pendek", () => {
    expect(ReportPostRequestSchema.safeParse({ ...dasar, reason: "jelek" }).success).toBe(false);
  });

  /**
   * Laporan BERTANDA TANGAN. Ambang penyembunyian 3 pelapor berbeda dan
   * `post_reports.reporter` bukan foreign key ke profiles — tanpa tanda
   * tangan, tiga alamat karangan menyembunyikan unggahan siapa pun.
   */
  it("menolak laporan tanpa tanda tangan", () => {
    const { sig: _sig, ...tanpaSig } = dasar;
    expect(ReportPostRequestSchema.safeParse(tanpaSig).success).toBe(false);
  });

  it("menolak laporan tanpa expiresAt", () => {
    const { expiresAt: _exp, ...tanpaExp } = dasar;
    expect(ReportPostRequestSchema.safeParse(tanpaExp).success).toBe(false);
  });

  it("menolak expiresAt bukan angka tanpa melempar", () => {
    expect(() => ReportPostRequestSchema.safeParse({ ...dasar, expiresAt: "besok" })).not.toThrow();
    expect(ReportPostRequestSchema.safeParse({ ...dasar, expiresAt: "besok" }).success).toBe(false);
  });
});

describe("DeletePostRequestSchema", () => {
  const dasar = { postId: ID, author: ADDR, expiresAt: "1800000000", sig: SIG };

  it("menerima permintaan hapus yang benar", () => {
    expect(DeletePostRequestSchema.safeParse(dasar).success).toBe(true);
  });

  // Hapus memakai tanda tangan HapusPost, yang TIDAK mengikat body. Menerima
  // body di sini cuma mengundang klien mengira body itu ikut diverifikasi.
  it("tidak menuntut body", () => {
    expect("body" in DeletePostRequestSchema.parse(dasar)).toBe(false);
  });
});

describe("AttachImageRequestSchema", () => {
  const dasar = {
    postId: ID, author: ADDR, expiresAt: "1800000000", sig: SIG,
    mime: "image/jpeg", dataBase64: "aGFsbw==",
  };

  it("menerima jpeg", () => {
    expect(AttachImageRequestSchema.safeParse(dasar).success).toBe(true);
  });

  it("menerima png", () => {
    expect(AttachImageRequestSchema.safeParse({ ...dasar, mime: "image/png" }).success).toBe(true);
  });

  // Tanpa daftar putih, apa pun bisa diunggah ke Greenfield dan disajikan
  // kembali dari domain storage provider.
  it("menolak mime di luar daftar putih", () => {
    expect(AttachImageRequestSchema.safeParse({ ...dasar, mime: "text/html" }).success).toBe(false);
  });

  it("menolak base64 kosong", () => {
    expect(AttachImageRequestSchema.safeParse({ ...dasar, dataBase64: "" }).success).toBe(false);
  });
});
