import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { createApp } from "../src/app";
import type { GateDeps } from "../src/ports";

const A = "0x0000000000000000000000000000000000000aaa" as Address;
const B = "0x0000000000000000000000000000000000000bbb" as Address;

function deps(): GateDeps {
  return {
    verifyingContract: A,
    nowMs: () => 1_700_000_000_000,
    store: {
      putOffer: async () => {}, getOffer: async () => null, consumeOffer: async () => {},
      areConnected: async () => false, countConnectionsSince: async () => 0,
      recordConnection: async () => {},
    },
    chain: { submitConnect: async () => `0x${"ab".repeat(32)}` },
    profiles: {
      listConnections: vi.fn(async () => [{ address: B, txHash: `0x${"cd".repeat(32)}`, at: 1 }]),
      countConnections: vi.fn(async () => 1),
      getDisplayName: vi.fn(async () => "ghost"),
    },
    identity: {
      ensName: vi.fn(async () => "ghost.eth"),
      txCount: vi.fn(async () => 42),
    },
  } as unknown as GateDeps;
}

describe("GET /connections/:address", () => {
  it("mengembalikan daftar koneksi", async () => {
    const res = await createApp(deps()).request(`/connections/${A}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ connections: [{ address: B }] });
  });

  it("400 untuk alamat yang tidak sah", async () => {
    expect((await createApp(deps()).request("/connections/bukan-alamat")).status).toBe(400);
  });
});

describe("GET /profile/:address", () => {
  it("menyertakan alamat, nama, ENS, dan jumlah koneksi", async () => {
    const res = await createApp(deps()).request(`/profile/${A}`);
    expect(await res.json()).toEqual({
      address: A.toLowerCase(),
      displayName: "ghost",
      ens: "ghost.eth",
      txCount: 42,
      connectionCount: 1,
    });
  });

  it("tetap 200 walau ENS tidak ada — anon adalah keadaan normal", async () => {
    const d = deps();
    d.identity.ensName = vi.fn(async () => null);
    const res = await createApp(d).request(`/profile/${A}`);
    expect(res.status).toBe(200);
    expect((await res.json()).ens).toBeNull();
  });

  it("tetap 200 walau lookup ENS melempar error — jangan sampai profil ikut mati", async () => {
    const d = deps();
    d.identity.ensName = vi.fn(async () => { throw new Error("rpc mainnet down"); });
    const res = await createApp(d).request(`/profile/${A}`);
    expect(res.status).toBe(200);
    expect((await res.json()).ens).toBeNull();
  });

  it("400 untuk alamat yang tidak sah", async () => {
    expect((await createApp(deps()).request("/profile/xyz")).status).toBe(400);
  });
});
