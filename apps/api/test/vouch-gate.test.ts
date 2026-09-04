import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { tagsHashOf, vouchTypedData } from "@nearly/shared";
import { DAILY_VOUCH_QUOTA, submitVouch } from "../src/vouch-gate";

const NOW = 1_700_000_000_000;
const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const account = privateKeyToAccount(PK);
const TO = "0x000000000000000000000000000000000000beef" as Address;
const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;

function deps(over: Record<string, unknown> = {}) {
  return {
    store: { areConnected: vi.fn(async () => true) },
    vouches: {
      countVouchesSince: vi.fn(async () => 0),
      hasVouch: vi.fn(async () => false),
      recordVouch: vi.fn(async () => {}),
      markRevoked: vi.fn(async () => {}),
    },
    vouchChain: { submitVouch: vi.fn(async (): Promise<Hex> => "0xtx" as Hex) },
    vouchContract: CONTRACT,
    nowMs: () => NOW,
    ...over,
  } as never;
}

async function input(over: Record<string, unknown> = {}) {
  const expiresAt = BigInt(Math.floor(NOW / 1000) + 3600);
  const tags = ["real builder"];
  const msg = { from: account.address, to: TO, tagsHash: tagsHashOf(tags), expiresAt };
  return {
    from: account.address,
    to: TO,
    tags,
    expiresAt,
    sig: await account.signTypedData(vouchTypedData(msg, CONTRACT)),
    ...over,
  } as never;
}

describe("submitVouch", () => {
  it("vouch yang sah diteruskan ke chain dan dicatat", async () => {
    const d = deps();
    const r = await submitVouch(await input(), d);
    expect(r.ok).toBe(true);
  });

  it("menolak vouch ke orang yang belum pernah ditemui", async () => {
    const d = deps({ store: { areConnected: vi.fn(async () => false) } });
    const r = await submitVouch(await input(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "not_connected", httpStatus: 422 } });
  });

  it("menolak vouch ke diri sendiri", async () => {
    const r = await submitVouch(await input({ to: account.address }), deps());
    expect(r).toMatchObject({ ok: false, failure: { code: "self_vouch" } });
  });

  it("menolak tanda tangan yang tidak cocok", async () => {
    const r = await submitVouch(await input({ tags: ["tag lain"] }), deps());
    expect(r).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
  });

  it("menolak kalau kuota harian sudah habis", async () => {
    const d = deps({
      vouches: {
        countVouchesSince: vi.fn(async () => DAILY_VOUCH_QUOTA),
        hasVouch: vi.fn(async () => false),
        recordVouch: vi.fn(async () => {}),
        markRevoked: vi.fn(async () => {}),
      },
    });
    const r = await submitVouch(await input(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "quota_exceeded", httpStatus: 429 } });
  });

  it("menolak vouch ganda ke orang yang sama", async () => {
    const d = deps({
      vouches: {
        countVouchesSince: vi.fn(async () => 0),
        hasVouch: vi.fn(async () => true),
        recordVouch: vi.fn(async () => {}),
        markRevoked: vi.fn(async () => {}),
      },
    });
    const r = await submitVouch(await input(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "already_vouched", httpStatus: 409 } });
  });

  it("menolak yang sudah kedaluwarsa", async () => {
    const lampau = BigInt(Math.floor(NOW / 1000) - 10);
    const msg = {
      from: account.address, to: TO, tagsHash: tagsHashOf(["x"]), expiresAt: lampau,
    };
    const sig = await account.signTypedData(vouchTypedData(msg, CONTRACT));
    const r = await submitVouch(
      await input({ tags: ["x"], expiresAt: lampau, sig }),
      deps(),
    );
    expect(r).toMatchObject({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("tidak mencatat apa pun kalau transaksi chain gagal", async () => {
    const recordVouch = vi.fn(async () => {});
    const d = deps({
      vouches: {
        countVouchesSince: vi.fn(async () => 0),
        hasVouch: vi.fn(async () => false),
        recordVouch,
        markRevoked: vi.fn(async () => {}),
      },
      vouchChain: { submitVouch: vi.fn(async () => { throw new Error("gagal"); }) },
    });
    const r = await submitVouch(await input(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "chain_error", httpStatus: 502 } });
    expect(recordVouch).not.toHaveBeenCalled();
  });

  it("kuota harian memang 3 (spec §11.1 butir 8)", () => {
    expect(DAILY_VOUCH_QUOTA).toBe(3);
  });
});
