import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { laporPostTypedData, likeTypedData } from "@nearly/shared";
import { reportPost, setLike } from "../src/feed-gate";
import type { FeedDeps, FeedStore, PostRecord } from "../src/ports";

const aku = privateKeyToAccount(`0x${"33".repeat(32)}` as Hex);
const lain = privateKeyToAccount(`0x${"44".repeat(32)}` as Hex);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const NOW = 1_800_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);
const ID = `0x${"1".repeat(64)}` as Hex;

function rekam(over: Partial<PostRecord> = {}): PostRecord {
  return {
    postId: ID, author: lain.address, body: "halo",
    imageBucket: null, imageObject: null, imageMime: null, imageStatus: "none",
    createdAtMs: NOW, deleted: false, ...over,
  };
}

function store(over: Partial<FeedStore> = {}): FeedStore {
  return {
    createPost: vi.fn(async () => {}),
    getPost: vi.fn(async () => rekam()),
    markDeleted: vi.fn(async () => {}),
    setLike: vi.fn(async () => {}),
    addReport: vi.fn(async () => {}),
    setImagePending: vi.fn(async () => {}),
    setImageDone: vi.fn(async () => {}),
    setImageFailed: vi.fn(async () => {}),
    listCandidates: vi.fn(async () => []), getCandidate: vi.fn(async () => null),
    ...over,
  };
}

function deps(feed: FeedStore): FeedDeps {
  return {
    feed,
    greenfield: { bucket: "nearly-feed", spEndpoint: "https://sp.example", upload: vi.fn(async () => {}) },
    verifyingContract: KONTRAK,
    nowMs: () => NOW,
  };
}

async function masukanSuka(suka: boolean, penandaTangan = aku) {
  const pesan = { postId: ID, who: aku.address, suka, expiresAt: EXP };
  const sig = await penandaTangan.signTypedData(likeTypedData(pesan, KONTRAK));
  return { ...pesan, sig };
}

describe("setLike", () => {
  it("menyimpan suka yang tanda tangannya sah", async () => {
    const s = store();
    const hasil = await setLike(await masukanSuka(true), deps(s));
    expect(hasil.ok).toBe(true);
    expect(s.setLike).toHaveBeenCalledWith(ID, aku.address, true);
  });

  it("menyimpan pembatalan suka", async () => {
    const s = store();
    await setLike(await masukanSuka(false), deps(s));
    expect(s.setLike).toHaveBeenCalledWith(ID, aku.address, false);
  });

  it("menolak tanda tangan orang lain", async () => {
    const s = store();
    const hasil = await setLike(await masukanSuka(true, lain), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(s.setLike).not.toHaveBeenCalled();
  });

  it("menolak permintaan kedaluwarsa", async () => {
    const lampau = BigInt(Math.floor(NOW / 1000) - 1);
    const pesan = { postId: ID, who: aku.address, suka: true, expiresAt: lampau };
    const sig = await aku.signTypedData(likeTypedData(pesan, KONTRAK));
    const hasil = await setLike({ ...pesan, sig }, deps(store()));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("menolak menyukai unggahan yang tidak ada", async () => {
    const s = store({ getPost: vi.fn(async () => null) });
    const hasil = await setLike(await masukanSuka(true), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "post_not_found", httpStatus: 404 } });
  });

  it("menolak menyukai unggahan yang sudah dihapus", async () => {
    const s = store({ getPost: vi.fn(async () => rekam({ deleted: true })) });
    const hasil = await setLike(await masukanSuka(true), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "post_not_found", httpStatus: 404 } });
    expect(s.setLike).not.toHaveBeenCalled();
  });

  /**
   * INVARIAN. `suka` ikut ditandatangani justru supaya satu tanda tangan
   * tidak bisa dipakai dua arah. Kalau gerbang memulihkan memakai nilai
   * `suka` yang dikarang server alih-alih yang dikirim, penjagaan itu hilang.
   */
  it("tanda tangan suka:true tidak bisa dipakai untuk membatalkan", async () => {
    const sigTrue = (await masukanSuka(true)).sig;
    const s = store();
    const hasil = await setLike(
      { postId: ID, who: aku.address, suka: false, expiresAt: EXP, sig: sigTrue }, deps(s),
    );
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature" } });
    expect(s.setLike).not.toHaveBeenCalled();
  });
});

const ALASAN = "spam berulang";

async function masukanLapor(
  over: { reason?: string; expiresAt?: bigint; reporter?: Address } = {},
  penandaTangan = aku,
) {
  const pesan = {
    postId: ID,
    reporter: over.reporter ?? aku.address,
    reason: over.reason ?? ALASAN,
    expiresAt: over.expiresAt ?? EXP,
  };
  const sig = await penandaTangan.signTypedData(laporPostTypedData(pesan, KONTRAK));
  return { ...pesan, sig };
}

describe("reportPost", () => {
  it("mencatat laporan yang tanda tangannya sah", async () => {
    const s = store();
    const hasil = await reportPost(await masukanLapor(), deps(s));
    expect(hasil.ok).toBe(true);
    expect(s.addReport).toHaveBeenCalledWith(ID, aku.address, ALASAN);
  });

  it("menolak melaporkan unggahan yang tidak ada", async () => {
    const s = store({ getPost: vi.fn(async () => null) });
    const hasil = await reportPost(await masukanLapor(), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "post_not_found", httpStatus: 404 } });
  });

  /**
   * INVARIAN INTI perbaikan ini, dan tes yang menjadi merah begitu
   * pemeriksaan tanda tangan di reportPost dicabut.
   *
   * Ambang penyembunyian 3 pelapor berbeda, dan `post_reports.reporter`
   * bukan foreign key ke `profiles` — alamat pelapor tidak perlu pernah ada.
   * Jadi tanpa pemeriksaan ini, tiga permintaan dengan tiga alamat karangan
   * cukup untuk menyembunyikan unggahan siapa pun, selamanya.
   */
  it("menolak reporter yang dikarang tanpa tanda tangan yang cocok", async () => {
    const karangan = [
      "0x00000000000000000000000000000000000000a1",
      "0x00000000000000000000000000000000000000a2",
      "0x00000000000000000000000000000000000000a3",
    ] as Address[];
    const sigAku = (await masukanLapor()).sig;

    for (const palsu of karangan) {
      const s = store();
      const hasil = await reportPost(
        { postId: ID, reporter: palsu, reason: ALASAN, expiresAt: EXP, sig: sigAku },
        deps(s),
      );
      expect(hasil).toMatchObject({
        ok: false, failure: { code: "bad_signature", httpStatus: 401 },
      });
      expect(s.addReport).not.toHaveBeenCalled();
    }
  });

  it("menolak tanda tangan orang lain atas nama pelapor", async () => {
    const s = store();
    const hasil = await reportPost(await masukanLapor({}, lain), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(s.addReport).not.toHaveBeenCalled();
  });

  // `reason` ikut ditandatangani supaya alasan tidak bisa ditukar setelah
  // ditandatangani.
  it("alasan yang ditukar setelah ditandatangani ditolak", async () => {
    const s = store();
    const sah = await masukanLapor();
    const hasil = await reportPost({ ...sah, reason: "alasan lain sama sekali" }, deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature" } });
    expect(s.addReport).not.toHaveBeenCalled();
  });

  it("menolak laporan kedaluwarsa", async () => {
    const lampau = BigInt(Math.floor(NOW / 1000) - 1);
    const s = store();
    const hasil = await reportPost(await masukanLapor({ expiresAt: lampau }), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "expired", httpStatus: 410 } });
    expect(s.addReport).not.toHaveBeenCalled();
  });
});
