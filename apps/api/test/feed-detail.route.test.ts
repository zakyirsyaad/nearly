import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { lihatFeedTypedData } from "@nearly/shared";
import { feedRoutes } from "../src/routes/feed";
import type { FeedCandidate, FeedDeps, FeedStore, PostRecord } from "../src/ports";

/**
 * `GET /posts/:id` — satu unggahan untuk layar detail (2026-09-24). Aturannya
 * sama persis dengan `GET /feed`: `viewer` boleh datang tanpa bukti (urutan
 * graf publik), tapi efek blokir dan `sudahSuka` HANYA untuk penonton
 * terbukti. Bedanya dengan `/feed`: unggahan yang tidak terlihat menjadi 404,
 * bukan daftar kosong.
 */
const penulis = privateKeyToAccount(`0x${"77".repeat(32)}` as Hex);
const pembaca = privateKeyToAccount(`0x${"88".repeat(32)}` as Hex);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const NOW = 1_800_000_000_000;
const ID = `0x${"1".repeat(64)}` as Hex;

function rekam(over: Partial<PostRecord> = {}): PostRecord {
  return {
    postId: ID, author: penulis.address, body: "halo",
    imageBucket: null, imageObject: null, imageMime: null, imageStatus: "none",
    createdAtMs: NOW, deleted: false, ...over,
  };
}

function kandidat(over: Partial<FeedCandidate> = {}): FeedCandidate {
  return {
    ...rekam(), displayName: "Andi", authorRatio: 0.1, authorTier: 1,
    authorConnections: 4, authorSlashed: false, reportCount: 0,
    likeCount: 3, sudahSuka: false, hop: 1, ...over,
  };
}

function store(over: Partial<FeedStore> = {}): FeedStore {
  return {
    createPost: vi.fn(async () => {}), getPost: vi.fn(async () => null),
    markDeleted: vi.fn(async () => {}), setLike: vi.fn(async () => {}),
    addReport: vi.fn(async () => {}), setImagePending: vi.fn(async () => {}),
    setImageDone: vi.fn(async () => {}), setImageFailed: vi.fn(async () => {}),
    listCandidates: vi.fn(async () => []), getCandidate: vi.fn(async () => null), ...over,
  };
}

function app(feed: FeedStore) {
  const deps: FeedDeps = {
    feed,
    greenfield: { bucket: "nearly-feed", spEndpoint: "https://sp.example", upload: vi.fn(async () => {}) },
    verifyingContract: KONTRAK,
    nowMs: () => NOW,
  };
  const a = new Hono();
  a.route("/", feedRoutes(deps));
  return a;
}

async function buktiLihatFeed() {
  const expiresAt = BigInt(Math.floor(NOW / 1000) + 300);
  const sig = await pembaca.signTypedData(
    lihatFeedTypedData({ who: pembaca.address, expiresAt }, KONTRAK),
  );
  return `who=${pembaca.address}&expiresAt=${expiresAt.toString()}&sig=${sig}`;
}

describe("GET /posts/:id", () => {
  it("mengembalikan satu unggahan dalam bentuk yang sama dengan feed", async () => {
    const res = await app(store({ getCandidate: vi.fn(async () => kandidat()) })).request(`/posts/${ID}`);
    expect(res.status).toBe(200);
    const { post } = await res.json() as { post: { postId: Hex; body: string; likeCount: number; hop: number | null } };
    expect(post.postId).toBe(ID);
    expect(post.body).toBe("halo");
    expect(post.likeCount).toBe(3);
    // Penonton anonim: hop SELALU null, sama seperti feed (spec §6.5).
    expect(post.hop).toBeNull();
  });

  it("id yang tidak ada → 404, bukan 200 dengan post null", async () => {
    const res = await app(store()).request(`/posts/${ID}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "tidak_ada" });
  });

  it("id cacat → 404 tanpa menyentuh store", async () => {
    const getCandidate = vi.fn(async () => kandidat());
    const res = await app(store({ getCandidate })).request("/posts/bukan-id");
    expect(res.status).toBe(404);
    expect(getCandidate).not.toHaveBeenCalled();
  });

  it("unggahan terhapus atau tersembunyi (slashed / cukup laporan) → 404", async () => {
    for (const over of [{ deleted: true }, { authorSlashed: true }, { reportCount: 99 }]) {
      const res = await app(store({ getCandidate: vi.fn(async () => kandidat(over)) })).request(`/posts/${ID}`);
      expect(res.status, JSON.stringify(over)).toBe(404);
    }
  });

  it("gambar siap → imageUrl dari endpoint SP", async () => {
    const dengan = kandidat({ imageStatus: "ready", imageBucket: "nearly-feed", imageObject: "a.jpg" });
    const res = await app(store({ getCandidate: vi.fn(async () => dengan) })).request(`/posts/${ID}`);
    const { post } = await res.json() as { post: { imageUrl: string | null } };
    expect(post.imageUrl).toBe("https://sp.example/view/nearly-feed/a.jpg");
  });

  it("who tanpa bukti: dipakai untuk hop, TAPI blokir dan sudahSuka tidak (C1)", async () => {
    const getCandidate = vi.fn(async () => kandidat());
    const res = await app(store({ getCandidate })).request(`/posts/${ID}?who=${pembaca.address}`);
    expect(res.status).toBe(200);
    const { post } = await res.json() as { post: { hop: number | null } };
    expect(post.hop).toBe(1);
    expect(getCandidate).toHaveBeenCalledWith(expect.objectContaining({
      viewer: pembaca.address.toLowerCase(),
      terbukti: false,
    }));
  });

  it("bukti LihatFeed yang sah → terbukti true", async () => {
    const getCandidate = vi.fn(async () => kandidat());
    const res = await app(store({ getCandidate })).request(`/posts/${ID}?${await buktiLihatFeed()}`);
    expect(res.status).toBe(200);
    expect(getCandidate).toHaveBeenCalledWith(expect.objectContaining({ terbukti: true }));
  });

  it("bukti kedaluwarsa atau cacat tidak menggagalkan permintaan, hanya tidak terbukti", async () => {
    const getCandidate = vi.fn(async () => kandidat());
    const res = await app(store({ getCandidate }))
      .request(`/posts/${ID}?who=${pembaca.address}&expiresAt=1&sig=0xdeadbeef`);
    expect(res.status).toBe(200);
    expect(getCandidate).toHaveBeenCalledWith(expect.objectContaining({ terbukti: false }));
  });
});
