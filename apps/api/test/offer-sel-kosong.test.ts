import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  acceptTypedData, checkInAcceptTypedData, checkInOfferTypedData, offerTypedData,
} from "@nearly/shared";
import { rowToOffer } from "../src/db";
import { rowToCheckInOffer } from "../src/event-store";
import { acceptHandshake, submitOffer } from "../src/handshake-gate";
import { acceptCheckIn, submitCheckInOffer } from "../src/event-gate";
import type { PendingCheckInOffer, PendingOffer } from "../src/ports";

/**
 * Offer yang selnya sudah dikosongkan `sapuLokasi` (spec 4b+5 §4.4) TIDAK
 * PERNAH menghasilkan sukses di gerbang salaman maupun check-in — dan gerbangnya
 * sendiri tidak diubah. Offer dibangun lewat pemeta store SUNGGUHAN dari baris
 * `cell: null`, persis bentuk yang dikembalikan Supabase setelah sapuan.
 */
const NOW = 1_700_000_000_000;
const NOW_SEC = Math.floor(NOW / 1000);
const HARI_DETIK = 86_400;
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const NONCE = `0x${"11".repeat(32)}` as Hex;
const EVENT_ID = `0x${"1".repeat(64)}` as Hex;
const CELL = "qqguv1r";
const A = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const B = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");

function offerSalamanTersapu(expiresAtDetik: number, consumed = false): PendingOffer {
  return rowToOffer({
    nonce: NONCE, initiator: A.address.toLowerCase(), expires_at: String(expiresAtDetik),
    sig_offer: `0x${"22".repeat(65)}`, cell: null, at_ms: String(NOW),
    consumed_at: consumed ? "2026-09-13T00:00:00Z" : null,
  });
}

function offerCheckInTersapu(expiresAtDetik: number, consumed = false): PendingCheckInOffer {
  return rowToCheckInOffer({
    nonce: NONCE, event_id: EVENT_ID, host: A.address.toLowerCase(), expires_at: String(expiresAtDetik),
    sig_host: `0x${"33".repeat(65)}`, cell: null, at_ms: String(NOW),
    consumed_at: consumed ? "2026-09-13T00:00:00Z" : null,
  });
}

function depsSalaman(offer: PendingOffer) {
  return {
    verifyingContract: VC,
    nowMs: () => NOW,
    store: {
      putOffer: vi.fn(async () => {}),
      getOffer: vi.fn(async () => offer),
      consumeOffer: vi.fn(async () => {}),
      areConnected: vi.fn(async () => false),
      countConnectionsSince: vi.fn(async () => 0),
      recordConnection: vi.fn(async () => {}),
    },
    chain: { submitConnect: vi.fn(async () => `0x${"ab".repeat(32)}` as Hex) },
  } as never;
}

function depsCheckIn(offer: PendingCheckInOffer) {
  return {
    events: {
      getEvent: vi.fn(async () => ({
        eventId: EVENT_ID, host: A.address, title: "t", venueLabel: "", centerCell: CELL,
        startsAt: BigInt(NOW_SEC - 600), endsAt: BigInt(NOW_SEC + 3600), txHash: "0xtx",
      })),
      hasRsvp: vi.fn(async () => true),
      hasCheckIn: vi.fn(async () => false),
      getCheckInOffer: vi.fn(async () => offer),
      putCheckInOffer: vi.fn(async () => {}),
      consumeCheckInOffer: vi.fn(async () => {}),
      recordCheckIn: vi.fn(async () => {}),
    },
    attendance: { submitCheckIn: vi.fn(async () => "0xtx" as Hex) },
    profiles: {},
    attendanceContract: VC,
    nowMs: () => NOW,
  } as never;
}

async function terimaSalaman(offer: PendingOffer) {
  const acc = { initiator: A.address, counterparty: B.address, nonce: NONCE, expiresAt: offer.expiresAt };
  const deps = depsSalaman(offer);
  const hasil = await acceptHandshake({
    ...acc, sigAccept: await B.signTypedData(acceptTypedData(acc, VC)), cell: CELL, atMs: NOW,
  }, deps);
  return { hasil, deps: deps as { chain: { submitConnect: ReturnType<typeof vi.fn> } } };
}

async function terimaCheckIn(offer: PendingCheckInOffer) {
  const msg = { eventId: EVENT_ID, nonce: NONCE, attendee: B.address, expiresAt: offer.expiresAt };
  const deps = depsCheckIn(offer);
  const hasil = await acceptCheckIn({
    ...msg, sigAttendee: await B.signTypedData(checkInAcceptTypedData(msg, VC)), cell: CELL, atMs: NOW,
  }, deps);
  return { hasil, deps: deps as { attendance: { submitCheckIn: ReturnType<typeof vi.fn> } } };
}

describe("pemetaan store menerima sel null", () => {
  it("rowToOffer: cell null → string kosong", () => {
    expect(offerSalamanTersapu(NOW_SEC).cell).toBe("");
  });
  it("rowToCheckInOffer: cell null → string kosong", () => {
    expect(offerCheckInTersapu(NOW_SEC).cell).toBe("");
  });
});

describe("offer salaman bersel kosong tidak pernah sukses", () => {
  it("hasil sapuan (kedaluwarsa > 24 jam) → 410 expired, chain tidak dipanggil", async () => {
    const { hasil, deps } = await terimaSalaman(offerSalamanTersapu(NOW_SEC - HARI_DETIK - 1));
    expect(hasil).toEqual({ ok: false, failure: { code: "expired", httpStatus: 410 } });
    expect(deps.chain.submitConnect).not.toHaveBeenCalled();
  });

  it("hasil sapuan yang sudah terpakai → 409 offer_consumed", async () => {
    const { hasil } = await terimaSalaman(offerSalamanTersapu(NOW_SEC - HARI_DETIK - 1, true));
    expect(hasil).toEqual({ ok: false, failure: { code: "offer_consumed", httpStatus: 409 } });
  });

  // Defensif: di dunia nyata sel hanya kosong setelah kedaluwarsa > 24 jam.
  it("bahkan bila belum kedaluwarsa, sel kosong → 422 not_colocated", async () => {
    const { hasil, deps } = await terimaSalaman(offerSalamanTersapu(NOW_SEC + 30));
    expect(hasil).toEqual({ ok: false, failure: { code: "not_colocated", reason: "cell_too_far", httpStatus: 422 } });
    expect(deps.chain.submitConnect).not.toHaveBeenCalled();
  });

  // Inilah alasan barisnya DIPERTAHANKAN: nonce tetap tidak bisa dipakai ulang.
  it("nonce offer tersapu tetap ditolak 409 nonce_used", async () => {
    const offer = { initiator: A.address, nonce: NONCE, expiresAt: BigInt(NOW_SEC + 30) };
    const hasil = await submitOffer({
      ...offer, sigOffer: await A.signTypedData(offerTypedData(offer, VC)), cell: CELL, atMs: NOW,
    }, depsSalaman(offerSalamanTersapu(NOW_SEC - HARI_DETIK - 1)));
    expect(hasil).toEqual({ ok: false, failure: { code: "nonce_used", httpStatus: 409 } });
  });
});

describe("offer check-in bersel kosong tidak pernah sukses", () => {
  it("hasil sapuan (kedaluwarsa > 24 jam) → 410 expired, chain tidak dipanggil", async () => {
    const { hasil, deps } = await terimaCheckIn(offerCheckInTersapu(NOW_SEC - HARI_DETIK - 1));
    expect(hasil).toEqual({ ok: false, failure: { code: "expired", httpStatus: 410 } });
    expect(deps.attendance.submitCheckIn).not.toHaveBeenCalled();
  });

  it("hasil sapuan yang sudah terpakai → 409 offer_consumed", async () => {
    const { hasil } = await terimaCheckIn(offerCheckInTersapu(NOW_SEC - HARI_DETIK - 1, true));
    expect(hasil).toEqual({ ok: false, failure: { code: "offer_consumed", httpStatus: 409 } });
  });

  it("bahkan bila belum kedaluwarsa, sel kosong → 422 not_colocated", async () => {
    const { hasil, deps } = await terimaCheckIn(offerCheckInTersapu(NOW_SEC + 30));
    expect(hasil).toEqual({ ok: false, failure: { code: "not_colocated", reason: "cell_too_far", httpStatus: 422 } });
    expect(deps.attendance.submitCheckIn).not.toHaveBeenCalled();
  });

  it("nonce offer check-in tersapu tetap ditolak 409 nonce_used", async () => {
    const msg = { eventId: EVENT_ID, nonce: NONCE, expiresAt: BigInt(NOW_SEC + 30) };
    const hasil = await submitCheckInOffer({
      ...msg, host: A.address, sigHost: await A.signTypedData(checkInOfferTypedData(msg, VC)), cell: CELL, atMs: NOW,
    }, depsCheckIn(offerCheckInTersapu(NOW_SEC - HARI_DETIK - 1)));
    expect(hasil).toEqual({ ok: false, failure: { code: "nonce_used", httpStatus: 409 } });
  });
});
