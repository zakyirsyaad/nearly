import { afterEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  recoverHapusPostSigner, recoverLaporPostSigner, recoverPostSigner,
} from "@nearly/shared";
import {
  ALASAN_LAPOR, bisaHapus, hapusUnggahan, laporUnggahan,
} from "../src/feed-actions";

const akun = privateKeyToAccount(`0x${"55".repeat(32)}` as Hex);
const KONTRAK = "0x0000000000000000000000000000000000000001" as Address;
const ID = `0x${"1".repeat(64)}` as Hex;
const NOW = 1_800_000_000_000;

const signer = {
  address: akun.address,
  signTypedData: (d: unknown) =>
    akun.signTypedData(d as Parameters<typeof akun.signTypedData>[0]),
};

const asli = globalThis.fetch;
afterEach(() => { globalThis.fetch = asli; });

type BadanTerkirim = {
  postId: string; reporter: string; author: string;
  reason: string; expiresAt: string; sig: string;
};

function tangkap() {
  const jejak: { url: string; badan: BadanTerkirim }[] = [];
  globalThis.fetch = vi.fn(async (url: string, init?: RequestInit) => {
    jejak.push({ url: String(url), badan: JSON.parse(String(init?.body)) as BadanTerkirim });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }) as unknown as typeof fetch;
  return jejak;
}

describe("bisaHapus", () => {
  // Tombol hapus hanya untuk unggahan penonton sendiri (spec §10.2).
  it("benar untuk unggahan sendiri", () => {
    expect(bisaHapus(akun.address, akun.address)).toBe(true);
  });

  it("salah untuk unggahan orang lain", () => {
    expect(bisaHapus("0x00000000000000000000000000000000000000aa", akun.address)).toBe(false);
  });

  // Alamat bisa datang dalam campuran huruf; server pun membandingkannya
  // tanpa peduli besar-kecil.
  it("tidak peka besar-kecil huruf", () => {
    expect(bisaHapus(akun.address.toUpperCase(), akun.address.toLowerCase())).toBe(true);
  });
});

describe("laporUnggahan", () => {
  it("mengirim ke rute laporan unggahan yang benar", async () => {
    const jejak = tangkap();
    await laporUnggahan(signer, ID, KONTRAK, NOW);
    expect(jejak).toHaveLength(1);
    expect(jejak[0]!.url).toContain(`/posts/${ID}/report`);
  });

  /**
   * Laporan wajib bertanda tangan `LaporPost`, dan `reason` ikut
   * ditandatangani. Tes ini memulihkan penanda tangannya dari badan yang
   * benar-benar dikirim — jadi ia merah kalau tanda tangannya hilang, memakai
   * tipe lain, atau alasan yang dikirim berbeda dari yang ditandatangani.
   */
  it("badannya memulihkan penanda tangan lewat recoverLaporPostSigner", async () => {
    const jejak = tangkap();
    await laporUnggahan(signer, ID, KONTRAK, NOW);
    const b = jejak[0]!.badan;

    expect(b.reason).toBe(ALASAN_LAPOR);
    const pulih = await recoverLaporPostSigner(
      {
        postId: b.postId as Hex,
        reporter: b.reporter as Address,
        reason: b.reason,
        expiresAt: BigInt(b.expiresAt),
      },
      b.sig as Hex,
      KONTRAK,
    );
    expect(pulih.toLowerCase()).toBe(akun.address.toLowerCase());
  });

  // Skema server menuntut minimal 10 karakter; alasan yang lebih pendek
  // ditolak invalid_body sebelum tanda tangannya pernah diperiksa.
  it("alasan bakunya memenuhi batas minimal 10 karakter", () => {
    expect(ALASAN_LAPOR.length).toBeGreaterThanOrEqual(10);
  });
});

describe("hapusUnggahan", () => {
  it("mengirim ke rute hapus unggahan yang benar", async () => {
    const jejak = tangkap();
    await hapusUnggahan(signer, ID, KONTRAK, NOW);
    expect(jejak).toHaveLength(1);
    expect(jejak[0]!.url).toContain(`/posts/${ID}/delete`);
  });

  it("badannya memulihkan penanda tangan lewat recoverHapusPostSigner", async () => {
    const jejak = tangkap();
    await hapusUnggahan(signer, ID, KONTRAK, NOW);
    const b = jejak[0]!.badan;
    const pulih = await recoverHapusPostSigner(
      { postId: b.postId as Hex, author: b.author as Address, expiresAt: BigInt(b.expiresAt) },
      b.sig as Hex,
      KONTRAK,
    );
    expect(pulih.toLowerCase()).toBe(akun.address.toLowerCase());
  });

  /**
   * Penjaga Ruling 23 di sisi klien: kalau layar diam-diam kembali memakai
   * `postTypedData` untuk menghapus, tanda tangan memposting akan sah sebagai
   * perintah menghapus. Tanda tangan hapus TIDAK BOLEH pulih sebagai `Post`.
   */
  it("tanda tangannya bukan tanda tangan Post", async () => {
    const jejak = tangkap();
    await hapusUnggahan(signer, ID, KONTRAK, NOW);
    const b = jejak[0]!.badan;
    const pulih = await recoverPostSigner(
      {
        postId: b.postId as Hex, author: b.author as Address,
        body: "halo", expiresAt: BigInt(b.expiresAt),
      },
      b.sig as Hex,
      KONTRAK,
    );
    expect(pulih.toLowerCase()).not.toBe(akun.address.toLowerCase());
  });
});
