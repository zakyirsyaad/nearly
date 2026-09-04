import { beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { encodeCell, neighborCells, offerTypedData, acceptTypedData } from "@nearly/shared";
import { submitOffer, acceptHandshake, DAILY_CONNECTION_QUOTA } from "../src/handshake-gate";
import type { GateDeps, PendingOffer } from "../src/ports";

const A = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");
const B = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const NONCE = `0x${"11".repeat(32)}` as Hex;
const CELL = encodeCell(-6.2088, 106.8456);
const NOW = 1_700_000_000_000;
const EXPIRES = BigInt(Math.floor(NOW / 1000) + 30);
const TX = `0x${"ab".repeat(32)}` as Hex;

function fakeDeps(): GateDeps & { offers: Map<Hex, PendingOffer> } {
  const offers = new Map<Hex, PendingOffer>();
  return {
    offers,
    verifyingContract: VC,
    nowMs: () => NOW,
    store: {
      putOffer: vi.fn(async (o) => { offers.set(o.nonce, { ...o, consumed: false }); }),
      getOffer: vi.fn(async (n: Hex) => offers.get(n) ?? null),
      consumeOffer: vi.fn(async (n: Hex) => {
        const o = offers.get(n); if (o) offers.set(n, { ...o, consumed: true });
      }),
      areConnected: vi.fn(async () => false),
      countConnectionsSince: vi.fn(async () => 0),
      recordConnection: vi.fn(async () => {}),
    },
    chain: { submitConnect: vi.fn(async () => TX) },
  } as unknown as GateDeps & { offers: Map<Hex, PendingOffer> };
}

async function signedOffer() {
  const offer = { initiator: A.address, nonce: NONCE, expiresAt: EXPIRES };
  return { ...offer, sigOffer: await A.signTypedData(offerTypedData(offer, VC)) };
}

async function signedAccept(counterparty = B.address, signer = B) {
  const acc = { initiator: A.address, counterparty, nonce: NONCE, expiresAt: EXPIRES };
  return { ...acc, sigAccept: await signer.signTypedData(acceptTypedData(acc, VC)) };
}

describe("submitOffer", () => {
  let deps: ReturnType<typeof fakeDeps>;
  beforeEach(() => { deps = fakeDeps(); });

  it("menyimpan offer beserta lokasi milik A sendiri", async () => {
    const o = await signedOffer();
    const r = await submitOffer({ ...o, cell: CELL, atMs: NOW }, deps);
    expect(r.ok).toBe(true);
    expect(deps.offers.get(NONCE)?.cell).toBe(CELL);
  });

  it("menolak offer yang sudah kedaluwarsa", async () => {
    const o = await signedOffer();
    const lewat = { ...deps, nowMs: () => NOW + 31_000 };
    const r = await submitOffer({ ...o, cell: CELL, atMs: NOW }, lewat);
    expect(r).toMatchObject({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("menolak tanda tangan yang bukan dari initiator", async () => {
    const o = await signedOffer();
    const palsu = { ...o, initiator: B.address };
    const r = await submitOffer({ ...palsu, cell: CELL, atMs: NOW }, deps);
    expect(r).toMatchObject({ ok: false, failure: { code: "bad_offer_signature", httpStatus: 401 } });
  });

  it("menolak nonce yang sudah pernah dipakai", async () => {
    const o = await signedOffer();
    await submitOffer({ ...o, cell: CELL, atMs: NOW }, deps);
    const r = await submitOffer({ ...o, cell: CELL, atMs: NOW }, deps);
    expect(r).toMatchObject({ ok: false, failure: { code: "nonce_used", httpStatus: 409 } });
  });
});

describe("acceptHandshake", () => {
  let deps: ReturnType<typeof fakeDeps>;
  beforeEach(async () => {
    deps = fakeDeps();
    const o = await signedOffer();
    await submitOffer({ ...o, cell: CELL, atMs: NOW }, deps);
  });

  it("mencetak koneksi ketika keduanya benar-benar berdekatan", async () => {
    const acc = await signedAccept();
    const r = await acceptHandshake({ ...acc, cell: CELL, atMs: NOW }, deps);
    expect(r).toEqual({ ok: true, value: { txHash: TX } });
    expect(deps.store.recordConnection).toHaveBeenCalledOnce();
  });

  it("menerima sel yang bertetangga — orang di batas sel", async () => {
    const acc = await signedAccept();
    const r = await acceptHandshake({ ...acc, cell: neighborCells(CELL)[0]!, atMs: NOW }, deps);
    expect(r.ok).toBe(true);
  });

  it("MENOLAK ketika keduanya berjauhan — test terpenting di seluruh proyek", async () => {
    const acc = await signedAccept();
    const jauh = encodeCell(-6.9175, 107.6191); // Bandung
    const r = await acceptHandshake({ ...acc, cell: jauh, atMs: NOW }, deps);
    expect(r).toMatchObject({
      ok: false,
      failure: { code: "not_colocated", reason: "cell_too_far", httpStatus: 422 },
    });
    expect(deps.chain.submitConnect).not.toHaveBeenCalled();
    expect(deps.store.recordConnection).not.toHaveBeenCalled();
  });

  it("MENOLAK ketika selisih waktunya di luar jendela", async () => {
    const acc = await signedAccept();
    const r = await acceptHandshake({ ...acc, cell: CELL, atMs: NOW + 200_000 }, deps);
    expect(r).toMatchObject({
      ok: false,
      failure: { code: "not_colocated", reason: "time_too_far", httpStatus: 422 },
    });
  });

  it("menolak kalau offer-nya tidak pernah ada", async () => {
    const kosong = fakeDeps();
    const acc = await signedAccept();
    const r = await acceptHandshake({ ...acc, cell: CELL, atMs: NOW }, kosong);
    expect(r).toMatchObject({ ok: false, failure: { code: "offer_not_found", httpStatus: 404 } });
  });

  it("menolak offer yang sudah dipakai — tidak bisa dipakai dua kali", async () => {
    const acc = await signedAccept();
    await acceptHandshake({ ...acc, cell: CELL, atMs: NOW }, deps);
    const r = await acceptHandshake({ ...acc, cell: CELL, atMs: NOW }, deps);
    expect(r).toMatchObject({ ok: false, failure: { code: "offer_consumed", httpStatus: 409 } });
  });

  it("menolak accept yang ditandatangani orang lain", async () => {
    const acc = await signedAccept(B.address, A);
    const r = await acceptHandshake({ ...acc, cell: CELL, atMs: NOW }, deps);
    expect(r).toMatchObject({ ok: false, failure: { code: "bad_accept_signature", httpStatus: 401 } });
  });

  it("menolak kalau sudah terkoneksi sebelumnya", async () => {
    deps.store.areConnected = vi.fn(async () => true);
    const acc = await signedAccept();
    const r = await acceptHandshake({ ...acc, cell: CELL, atMs: NOW }, deps);
    expect(r).toMatchObject({ ok: false, failure: { code: "already_connected", httpStatus: 409 } });
  });

  it("menolak kalau kuota harian habis", async () => {
    deps.store.countConnectionsSince = vi.fn(async () => DAILY_CONNECTION_QUOTA);
    const acc = await signedAccept();
    const r = await acceptHandshake({ ...acc, cell: CELL, atMs: NOW }, deps);
    expect(r).toMatchObject({ ok: false, failure: { code: "quota_exceeded", httpStatus: 429 } });
  });

  it("tidak menandai offer terpakai kalau transaksi chain gagal", async () => {
    deps.chain.submitConnect = vi.fn(async () => { throw new Error("rpc down"); });
    const acc = await signedAccept();
    const r = await acceptHandshake({ ...acc, cell: CELL, atMs: NOW }, deps);
    expect(r).toMatchObject({ ok: false, failure: { code: "chain_error", httpStatus: 502 } });
    expect(deps.offers.get(NONCE)?.consumed).toBe(false);
  });
});
