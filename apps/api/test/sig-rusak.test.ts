import { describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { encodeCell } from "@nearly/shared";
import { submitOffer, acceptHandshake } from "../src/handshake-gate";
import { submitVouch, revokeVouch } from "../src/vouch-gate";
import { createEvent, rsvp, submitCheckInOffer, acceptCheckIn } from "../src/event-gate";
import { createPost, deletePost, setLike, reportPost, attachImage } from "../src/feed-gate";
import { reportRoutes } from "../src/routes/report";

/**
 * Satu tanda tangan yang PANJANGNYA sah — jadi ia lolos regex skema Zod — tapi
 * byte `v`-nya (0x99 = 153) di luar {0, 1, 27, 28}. viem melempar
 * `Invalid yParityOrV value` alih-alih memulihkan alamat yang salah.
 *
 * Kalau panggilan recover tidak dibungkus, lemparan itu lolos dari kontrak
 * Result gerbang dan keluar sebagai 500 — bukan 401 seperti kegagalan tanda
 * tangan lainnya. Ditemukan hidup pada verifikasi lapangan Fase 3b:
 * `POST /posts/:id/report` mengembalikan 500 untuk badan seperti ini.
 */
const SIG_RUSAK = ("0x" + "99".repeat(65)) as Hex;

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = privateKeyToAccount(`0x${"b2".repeat(32)}` as Hex);
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const NOW = 1_700_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);
const ID32 = `0x${"11".repeat(32)}` as Hex;
const CELL = encodeCell(-6.2088, 106.8456);

/** Semua gerbang harus MENGEMBALIKAN kegagalan, bukan menolak promise-nya. */
async function hasil(f: () => Promise<{ ok: boolean; failure?: { code: string; httpStatus: number } }>) {
  try {
    return { melempar: false as const, nilai: await f() };
  } catch (e) {
    return { melempar: true as const, error: e };
  }
}

describe("tanda tangan cacat bentuk tidak boleh jadi 500", () => {
  it("handshake: submitOffer", async () => {
    const deps = {
      verifyingContract: VC, nowMs: () => NOW,
      store: { getOffer: vi.fn(async () => null), putOffer: vi.fn(async () => {}) },
    } as never;
    const r = await hasil(() => submitOffer({
      initiator: A.address, nonce: ID32, expiresAt: EXP,
      sigOffer: SIG_RUSAK, cell: CELL, atMs: NOW,
    } as never, deps));
    expect(r.melempar).toBe(false);
    expect(r.melempar === false && r.nilai.failure?.httpStatus).toBe(401);
  });

  it("handshake: acceptHandshake", async () => {
    const deps = {
      verifyingContract: VC, nowMs: () => NOW,
      store: {
        getOffer: vi.fn(async () => ({
          nonce: ID32, initiator: A.address, expiresAt: EXP, sigOffer: SIG_RUSAK,
          cell: CELL, atMs: NOW, consumed: false,
        })),
        areConnected: vi.fn(async () => false),
        countConnectionsSince: vi.fn(async () => 0),
      },
    } as never;
    const r = await hasil(() => acceptHandshake({
      initiator: A.address, counterparty: B.address, nonce: ID32, expiresAt: EXP,
      sigAccept: SIG_RUSAK, cell: CELL, atMs: NOW,
    } as never, deps));
    expect(r.melempar).toBe(false);
    expect(r.melempar === false && r.nilai.failure?.httpStatus).toBe(401);
  });

  it("vouch: submitVouch", async () => {
    const deps = {
      vouchContract: VC, nowMs: () => NOW,
      store: { areConnected: vi.fn(async () => true) },
      vouches: { countVouchesSince: vi.fn(async () => 0), hasVouch: vi.fn(async () => false) },
    } as never;
    const r = await hasil(() => submitVouch({
      from: A.address, to: B.address, tags: ["real builder"], expiresAt: EXP, sig: SIG_RUSAK,
    } as never, deps));
    expect(r.melempar).toBe(false);
    expect(r.melempar === false && r.nilai.failure?.httpStatus).toBe(401);
  });

  it("vouch: revokeVouch", async () => {
    const deps = {
      vouchContract: VC, nowMs: () => NOW,
      vouches: { isActiveVouch: vi.fn(async () => true), markRevoked: vi.fn(async () => {}) },
    } as never;
    const r = await hasil(() => revokeVouch({
      from: A.address, to: B.address, expiresAt: EXP, sig: SIG_RUSAK,
    } as never, deps));
    expect(r.melempar).toBe(false);
    expect(r.melempar === false && r.nilai.failure?.httpStatus).toBe(401);
  });

  it("event: createEvent", async () => {
    const deps = {
      attendanceContract: VC, nowMs: () => NOW,
      events: { getEvent: vi.fn(async () => null), recordEvent: vi.fn(async () => {}) },
    } as never;
    const r = await hasil(() => createEvent({
      eventId: ID32, host: A.address, title: "T", venueLabel: "V", cell: CELL,
      startsAt: BigInt(Math.floor(NOW / 1000)), endsAt: BigInt(Math.floor(NOW / 1000) + 3600),
      expiresAt: EXP, sigHost: SIG_RUSAK,
    } as never, deps));
    expect(r.melempar).toBe(false);
    expect(r.melempar === false && r.nilai.failure?.httpStatus).toBe(401);
  });

  it("event: rsvp", async () => {
    const deps = {
      attendanceContract: VC, nowMs: () => NOW,
      events: {
        getEvent: vi.fn(async () => ({
          eventId: ID32, host: A.address, title: "T", venueLabel: "V", centerCell: CELL,
          startsAt: BigInt(Math.floor(NOW / 1000) - 60),
          endsAt: BigInt(Math.floor(NOW / 1000) + 3600), txHash: ID32,
        })),
        hasRsvp: vi.fn(async () => false), recordRsvp: vi.fn(async () => {}),
      },
    } as never;
    const r = await hasil(() => rsvp({
      eventId: ID32, who: A.address, expiresAt: EXP, sig: SIG_RUSAK,
    } as never, deps));
    expect(r.melempar).toBe(false);
    expect(r.melempar === false && r.nilai.failure?.httpStatus).toBe(401);
  });

  it("event: submitCheckInOffer", async () => {
    const deps = {
      attendanceContract: VC, nowMs: () => NOW,
      events: {
        getEvent: vi.fn(async () => ({
          eventId: ID32, host: A.address, title: "T", venueLabel: "V", centerCell: CELL,
          startsAt: BigInt(Math.floor(NOW / 1000) - 60),
          endsAt: BigInt(Math.floor(NOW / 1000) + 3600), txHash: ID32,
        })),
        getCheckInOffer: vi.fn(async () => null), putCheckInOffer: vi.fn(async () => {}),
      },
    } as never;
    const r = await hasil(() => submitCheckInOffer({
      eventId: ID32, nonce: ID32, host: A.address, expiresAt: EXP,
      sigHost: SIG_RUSAK, cell: CELL, atMs: NOW,
    } as never, deps));
    expect(r.melempar).toBe(false);
    expect(r.melempar === false && r.nilai.failure?.httpStatus).toBe(401);
  });

  it("event: acceptCheckIn", async () => {
    const deps = {
      attendanceContract: VC, nowMs: () => NOW,
      events: {
        getEvent: vi.fn(async () => ({
          eventId: ID32, host: A.address, title: "T", venueLabel: "V", centerCell: CELL,
          startsAt: BigInt(Math.floor(NOW / 1000) - 60),
          endsAt: BigInt(Math.floor(NOW / 1000) + 3600), txHash: ID32,
        })),
        getCheckInOffer: vi.fn(async () => ({
          nonce: ID32, eventId: ID32, host: A.address, expiresAt: EXP,
          sigHost: SIG_RUSAK, cell: CELL, atMs: NOW, consumed: false,
        })),
        hasRsvp: vi.fn(async () => true), hasCheckIn: vi.fn(async () => false),
        consumeCheckInOffer: vi.fn(async () => {}), recordCheckIn: vi.fn(async () => {}),
      },
    } as never;
    const r = await hasil(() => acceptCheckIn({
      eventId: ID32, nonce: ID32, attendee: B.address, expiresAt: EXP,
      sigAttendee: SIG_RUSAK, cell: CELL, atMs: NOW,
    } as never, deps));
    expect(r.melempar).toBe(false);
    expect(r.melempar === false && r.nilai.failure?.httpStatus).toBe(401);
  });

  const feedDeps = (over: Record<string, unknown> = {}) => ({
    verifyingContract: VC, nowMs: () => NOW,
    feed: {
      getPost: vi.fn(async () => ({
        postId: ID32, author: A.address, body: "x", imageBucket: null, imageObject: null,
        imageMime: null, imageStatus: "none", createdAtMs: NOW, deleted: false,
      })),
      createPost: vi.fn(async () => {}), markDeleted: vi.fn(async () => {}),
      setLike: vi.fn(async () => {}), addReport: vi.fn(async () => {}),
      setImagePending: vi.fn(async () => {}),
      ...(over.feed as object ?? {}),
    },
    greenfield: { bucket: "b", spEndpoint: "http://sp", upload: vi.fn(async () => {}) },
  } as never);

  it("feed: createPost", async () => {
    const deps = { ...(feedDeps() as object) } as never;
    (deps as { feed: { getPost: unknown } }).feed.getPost = vi.fn(async () => null);
    const r = await hasil(() => createPost({
      postId: ID32, author: A.address, body: "halo", expiresAt: EXP, sig: SIG_RUSAK,
    } as never, deps));
    expect(r.melempar).toBe(false);
    expect(r.melempar === false && r.nilai.failure?.httpStatus).toBe(401);
  });

  it("feed: deletePost", async () => {
    const r = await hasil(() => deletePost({
      postId: ID32, author: A.address, expiresAt: EXP, sig: SIG_RUSAK,
    } as never, feedDeps()));
    expect(r.melempar).toBe(false);
    expect(r.melempar === false && r.nilai.failure?.httpStatus).toBe(401);
  });

  it("feed: setLike", async () => {
    const r = await hasil(() => setLike({
      postId: ID32, who: B.address, suka: true, expiresAt: EXP, sig: SIG_RUSAK,
    } as never, feedDeps()));
    expect(r.melempar).toBe(false);
    expect(r.melempar === false && r.nilai.failure?.httpStatus).toBe(401);
  });

  it("feed: reportPost — yang benar-benar 500 di lapangan", async () => {
    const r = await hasil(() => reportPost({
      postId: ID32, reporter: B.address, reason: "melanggar aturan komunitas",
      expiresAt: EXP, sig: SIG_RUSAK,
    } as never, feedDeps()));
    expect(r.melempar).toBe(false);
    expect(r.melempar === false && r.nilai.failure?.httpStatus).toBe(401);
  });

  it("feed: attachImage", async () => {
    const r = await hasil(() => attachImage({
      postId: ID32, author: A.address, mime: "image/png", expiresAt: EXP,
      sig: SIG_RUSAK, dataBase64: Buffer.from("x").toString("base64"),
    } as never, feedDeps()));
    expect(r.melempar).toBe(false);
    expect(r.melempar === false && r.nilai.failure?.httpStatus).toBe(401);
  });
});

describe("rute yang memulihkan tanda tangan sendiri", () => {
  it("POST /report dengan sig rusak → 401, bukan 500", async () => {
    const app = reportRoutes({
      reports: { recordReport: vi.fn(async () => {}) },
      vouchContract: VC, nowMs: () => NOW,
    } as never);
    const r = await app.request("/report", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reporter: A.address, subject: B.address,
        reason: "menjual token palsu di venue",
        expiresAt: EXP.toString(), sig: SIG_RUSAK,
      }),
    });
    expect(r.status).toBe(401);
  });
});

/**
 * Penjaga struktural, bukan perilaku. Tes di atas hanya menutupi entri yang
 * ADA SEKARANG; ini menutupi yang belum ditulis. Setiap panggilan
 * `recover*Signer` di gerbang MAUPUN rute harus lewat `pulihkanTandaTangan`,
 * karena satu panggilan telanjang saja sudah cukup mengembalikan bug 500-nya —
 * dan satu memang lolos ke produksi lewat `routes/report.ts`.
 */
describe("setiap pemulihan tanda tangan dibungkus", () => {
  it("tidak ada panggilan recover telanjang di gerbang maupun rute", () => {
    const src = join(__dirname, "..", "src");
    const berkas = [
      ...readdirSync(src).filter((f) => f.endsWith("-gate.ts")).map((f) => join(src, f)),
      ...readdirSync(join(src, "routes")).filter((f) => f.endsWith(".ts"))
        .map((f) => join(src, "routes", f)),
    ];
    expect(berkas.length).toBeGreaterThan(4);

    const telanjang: string[] = [];
    for (const f of berkas) {
      const isi = readFileSync(f, "utf8");
      for (const baris of isi.split("\n")) {
        const m = /\brecover[A-Za-z]*Signer\s*\(/.exec(baris);
        // Baris impor dan komentar bukan situs panggilan.
        if (!m) continue;
        if (/^\s*(\*|\/\/|import\b)/.test(baris)) continue;
        if (!/pulihkanTandaTangan\s*\(/.test(baris)) telanjang.push(`${f}: ${baris.trim()}`);
      }
    }
    expect(telanjang).toEqual([]);
  });
});
