import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { hapusPostTypedData, makePostId, postTypedData } from "@nearly/shared";
import { createPost, deletePost } from "../src/feed-gate";
import type { FeedDeps, FeedStore, PostRecord } from "../src/ports";

const penulis = privateKeyToAccount(`0x${"11".repeat(32)}` as Hex);
const orangLain = privateKeyToAccount(`0x${"22".repeat(32)}` as Hex);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const NOW = 1_800_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);

function store(over: Partial<FeedStore> = {}): FeedStore {
  return {
    createPost: vi.fn(async () => {}),
    getPost: vi.fn(async () => null),
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

function rekam(over: Partial<PostRecord> = {}): PostRecord {
  return {
    postId: `0x${"1".repeat(64)}` as Hex,
    author: penulis.address, body: "halo dunia",
    imageBucket: null, imageObject: null, imageMime: null, imageStatus: "none",
    createdAtMs: NOW, deleted: false, ...over,
  };
}

async function masukanBuat(over: Record<string, unknown> = {}) {
  const postId = makePostId();
  const pesan = { postId, author: penulis.address, body: "halo dunia", expiresAt: EXP };
  const sig = await penulis.signTypedData(postTypedData(pesan, KONTRAK));
  return { ...pesan, sig, ...over };
}

describe("createPost", () => {
  it("menyimpan unggahan yang tanda tangannya sah", async () => {
    const s = store();
    const hasil = await createPost(await masukanBuat(), deps(s));
    expect(hasil.ok).toBe(true);
    expect(s.createPost).toHaveBeenCalledTimes(1);
  });

  it("menolak tanda tangan dari orang lain", async () => {
    const postId = makePostId();
    const pesan = { postId, author: penulis.address, body: "halo dunia", expiresAt: EXP };
    const sig = await orangLain.signTypedData(postTypedData(pesan, KONTRAK));
    const s = store();
    const hasil = await createPost({ ...pesan, sig }, deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(s.createPost).not.toHaveBeenCalled();
  });

  it("menolak permintaan yang sudah kedaluwarsa", async () => {
    const lampau = BigInt(Math.floor(NOW / 1000) - 1);
    const postId = makePostId();
    const pesan = { postId, author: penulis.address, body: "halo dunia", expiresAt: lampau };
    const sig = await penulis.signTypedData(postTypedData(pesan, KONTRAK));
    const hasil = await createPost({ ...pesan, sig }, deps(store()));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("menolak postId yang sudah dipakai", async () => {
    const s = store({ getPost: vi.fn(async () => rekam()) });
    const hasil = await createPost(await masukanBuat(), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "post_exists", httpStatus: 409 } });
    expect(s.createPost).not.toHaveBeenCalled();
  });

  // Body ikut ditandatangani, jadi menukar isinya harus menggagalkan pemulihan.
  it("menolak body yang ditukar setelah ditandatangani", async () => {
    const masukan = await masukanBuat();
    const hasil = await createPost({ ...masukan, body: "isi lain" }, deps(store()));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature" } });
  });

  it("meneruskan waktu buat dari deps.nowMs, bukan jam klien", async () => {
    const s = store();
    await createPost(await masukanBuat(), deps(s));
    expect(s.createPost).toHaveBeenCalledWith(expect.objectContaining({ createdAtMs: NOW }));
  });
});

describe("deletePost", () => {
  async function masukanHapus(over: Record<string, unknown> = {}) {
    const postId = `0x${"1".repeat(64)}` as Hex;
    const pesan = { postId, author: penulis.address, expiresAt: EXP };
    const sig = await penulis.signTypedData(hapusPostTypedData(pesan, KONTRAK));
    return { ...pesan, sig, ...over };
  }

  it("menandai unggahan milik sendiri sebagai terhapus", async () => {
    const s = store({ getPost: vi.fn(async () => rekam()) });
    const hasil = await deletePost(await masukanHapus(), deps(s));
    expect(hasil.ok).toBe(true);
    expect(s.markDeleted).toHaveBeenCalledTimes(1);
  });

  it("menolak menghapus unggahan orang lain", async () => {
    const s = store({ getPost: vi.fn(async () => rekam({ author: orangLain.address })) });
    const hasil = await deletePost(await masukanHapus(), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "not_author", httpStatus: 403 } });
    expect(s.markDeleted).not.toHaveBeenCalled();
  });

  it("mengembalikan post_not_found untuk unggahan yang tidak ada", async () => {
    const hasil = await deletePost(await masukanHapus(), deps(store()));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "post_not_found", httpStatus: 404 } });
  });

  // Menghapus dua kali bukan galat — hasil akhirnya sama.
  it("idempoten pada unggahan yang sudah terhapus", async () => {
    const s = store({ getPost: vi.fn(async () => rekam({ deleted: true })) });
    const hasil = await deletePost(await masukanHapus(), deps(s));
    expect(hasil.ok).toBe(true);
    expect(s.markDeleted).not.toHaveBeenCalled();
  });

  /**
   * INVARIAN. Kalau gerbang hapus memakai recoverPostSigner, tanda tangan
   * yang dibuat untuk MEMPOSTING akan sah sebagai perintah MENGHAPUS, dan
   * siapa pun yang menangkapnya bisa menghapus unggahan orang itu. Tes ini
   * gagal kalau invarian itu dilanggar.
   */
  it("tanda tangan Post TIDAK diterima sebagai perintah hapus", async () => {
    const postId = `0x${"1".repeat(64)}` as Hex;
    const sigPost = await penulis.signTypedData(
      postTypedData({ postId, author: penulis.address, body: "halo dunia", expiresAt: EXP }, KONTRAK),
    );
    const s = store({ getPost: vi.fn(async () => rekam()) });
    const hasil = await deletePost(
      { postId, author: penulis.address, expiresAt: EXP, sig: sigPost }, deps(s),
    );
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(s.markDeleted).not.toHaveBeenCalled();
  });
});
