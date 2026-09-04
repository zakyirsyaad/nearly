import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { revokeTypedData } from "@nearly/shared";
import { revokeVouch } from "../src/vouch-gate";

// Task 7: revokeVouch belum pernah diuji sama sekali sebelum ini. Yang jauh
// lebih berbahaya: hasVouch berarti "PERNAH vouch" (termasuk yang sudah
// dicabut, karena kontrak menyimpan catatan vouch SELAMANYA — satu vouch per
// pasangan). Kalau revokeVouch dijaga pakai hasVouch alih-alih
// isActiveVouch, API akan meneruskan revoke untuk vouch yang sudah pernah
// dicabut ke chain, dan kontrak PASTI revert NotVouched — membakar gas
// relayer untuk transaksi yang sudah bisa dipastikan gagal sebelum dikirim.

const NOW = 1_700_000_000_000;
const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const account = privateKeyToAccount(PK);
const OTHER_PK = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex;
const otherAccount = privateKeyToAccount(OTHER_PK);
const TO = "0x000000000000000000000000000000000000beef" as Address;
const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;

function deps(over: Record<string, unknown> = {}) {
  return {
    store: { areConnected: vi.fn(async () => true) },
    vouches: {
      countVouchesSince: vi.fn(async () => 0),
      hasVouch: vi.fn(async () => true),
      isActiveVouch: vi.fn(async () => true),
      recordVouch: vi.fn(async () => {}),
      markRevoked: vi.fn(async () => {}),
    },
    vouchChain: {
      submitVouch: vi.fn(async (): Promise<Hex> => "0xtx" as Hex),
      submitRevoke: vi.fn(async (): Promise<Hex> => "0xtx" as Hex),
    },
    vouchContract: CONTRACT,
    nowMs: () => NOW,
    ...over,
  } as never;
}

async function input(over: Record<string, unknown> = {}) {
  const expiresAt = BigInt(Math.floor(NOW / 1000) + 3600);
  const msg = { from: account.address, to: TO, expiresAt };
  return {
    from: account.address,
    to: TO,
    expiresAt,
    sig: await account.signTypedData(revokeTypedData(msg, CONTRACT)),
    ...over,
  } as never;
}

describe("revokeVouch", () => {
  it("jalur bahagia: mencabut vouch aktif, diteruskan ke chain, dicatat", async () => {
    const markRevoked = vi.fn(async () => {});
    const submitRevoke = vi.fn(async (): Promise<Hex> => "0xrevoked" as Hex);
    const d = deps({
      vouches: {
        countVouchesSince: vi.fn(async () => 0),
        hasVouch: vi.fn(async () => true),
        isActiveVouch: vi.fn(async () => true),
        recordVouch: vi.fn(async () => {}),
        markRevoked,
      },
      vouchChain: { submitVouch: vi.fn(), submitRevoke },
    });

    const r = await revokeVouch(await input(), d);

    expect(r).toMatchObject({ ok: true, value: { txHash: "0xrevoked" } });
    expect(submitRevoke).toHaveBeenCalledTimes(1);
    expect(markRevoked).toHaveBeenCalledWith(account.address, TO);
  });

  it("penandatangan yang salah ditolak 401, tidak menyentuh chain", async () => {
    const submitRevoke = vi.fn(async (): Promise<Hex> => "0xtx" as Hex);
    const msg = { from: account.address, to: TO, expiresAt: BigInt(Math.floor(NOW / 1000) + 3600) };
    const sig = await otherAccount.signTypedData(revokeTypedData(msg, CONTRACT));
    const d = deps({ vouchChain: { submitVouch: vi.fn(), submitRevoke } });

    const r = await revokeVouch(await input({ sig }), d);

    expect(r).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(submitRevoke).not.toHaveBeenCalled();
  });

  it("kedaluwarsa ditolak 410, tidak menyentuh chain", async () => {
    const submitRevoke = vi.fn(async (): Promise<Hex> => "0xtx" as Hex);
    const lampau = BigInt(Math.floor(NOW / 1000) - 10);
    const msg = { from: account.address, to: TO, expiresAt: lampau };
    const sig = await account.signTypedData(revokeTypedData(msg, CONTRACT));
    const d = deps({ vouchChain: { submitVouch: vi.fn(), submitRevoke } });

    const r = await revokeVouch(await input({ expiresAt: lampau, sig }), d);

    expect(r).toMatchObject({ ok: false, failure: { code: "expired", httpStatus: 410 } });
    expect(submitRevoke).not.toHaveBeenCalled();
  });

  it("GERBANG: belum pernah vouch -> 404 not_vouched, TIDAK mengirim tx yang pasti revert", async () => {
    const submitRevoke = vi.fn(async (): Promise<Hex> => "0xtx" as Hex);
    const d = deps({
      vouches: {
        countVouchesSince: vi.fn(async () => 0),
        hasVouch: vi.fn(async () => false),
        isActiveVouch: vi.fn(async () => false),
        recordVouch: vi.fn(async () => {}),
        markRevoked: vi.fn(async () => {}),
      },
      vouchChain: { submitVouch: vi.fn(), submitRevoke },
    });

    const r = await revokeVouch(await input(), d);

    expect(r).toMatchObject({ ok: false, failure: { code: "not_vouched", httpStatus: 404 } });
    expect(submitRevoke).not.toHaveBeenCalled();
  });

  it("GERBANG: sudah pernah dicabut sebelumnya -> 404 not_vouched, TIDAK mengirim tx yang pasti revert (bukan gas relayer)", async () => {
    // hasVouch TETAP true di sini (kontrak menyimpan catatan vouch selamanya
    // — "pernah vouch" tidak berubah setelah revoke), tapi isActiveVouch
    // sudah false. Kalau gerbangnya masih memakai hasVouch, test ini akan
    // GAGAL karena request akan diteruskan ke chain dan submitRevoke
    // terpanggil — persis bug yang ditutup Task 7.
    const submitRevoke = vi.fn(async (): Promise<Hex> => "0xtx" as Hex);
    const d = deps({
      vouches: {
        countVouchesSince: vi.fn(async () => 0),
        hasVouch: vi.fn(async () => true),
        isActiveVouch: vi.fn(async () => false),
        recordVouch: vi.fn(async () => {}),
        markRevoked: vi.fn(async () => {}),
      },
      vouchChain: { submitVouch: vi.fn(), submitRevoke },
    });

    const r = await revokeVouch(await input(), d);

    expect(r).toMatchObject({ ok: false, failure: { code: "not_vouched", httpStatus: 404 } });
    expect(submitRevoke).not.toHaveBeenCalled();
  });

  it("kegagalan chain -> 502, tidak mencatat markRevoked", async () => {
    const markRevoked = vi.fn(async () => {});
    const d = deps({
      vouches: {
        countVouchesSince: vi.fn(async () => 0),
        hasVouch: vi.fn(async () => true),
        isActiveVouch: vi.fn(async () => true),
        recordVouch: vi.fn(async () => {}),
        markRevoked,
      },
      vouchChain: {
        submitVouch: vi.fn(),
        submitRevoke: vi.fn(async () => { throw new Error("rpc gagal"); }),
      },
    });

    const r = await revokeVouch(await input(), d);

    expect(r).toMatchObject({ ok: false, failure: { code: "chain_error", httpStatus: 502 } });
    expect(markRevoked).not.toHaveBeenCalled();
  });
});
