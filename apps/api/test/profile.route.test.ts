import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { createApp, type TrustDeps } from "../src/app";

const A = "0x0000000000000000000000000000000000000aaa" as Address;
const B = "0x0000000000000000000000000000000000000bbb" as Address;
const TX = `0x${"ab".repeat(32)}`;

function deps(): TrustDeps {
  return {
    verifyingContract: A,
    nowMs: () => 1_700_000_000_000,
    store: {
      putOffer: async () => {}, getOffer: async () => null, consumeOffer: async () => {},
      areConnected: vi.fn(async () => false), countConnectionsSince: async () => 0,
      recordConnection: async () => {},
    },
    chain: { submitConnect: async () => TX },
    profiles: {
      listConnections: vi.fn(async () => [{ address: B, txHash: `0x${"cd".repeat(32)}`, at: 1 }]),
      countConnections: vi.fn(async () => 1),
      getDisplayName: vi.fn(async () => "ghost"),
    },
    identity: {
      ensName: vi.fn(async () => "ghost.eth"),
      txCount: vi.fn(async () => 42),
    },
    // Stub Fase 3c: tidak diuji langsung di sini (lihat
    // profile-meet.route.test.ts), hanya supaya bentuk TrustDeps lengkap.
    meet: {
      setTanda: vi.fn(async () => {}),
      hitungTanda: vi.fn(async () => 0),
      adaTanda: vi.fn(async () => false),
      tandaOleh: vi.fn(async () => []),
      tandaKe: vi.fn(async () => []),
      cocokDilihatAtMs: vi.fn(async () => null),
      setCocokDilihat: vi.fn(async () => {}),
      profilRingkas: vi.fn(async () => new Map()),
    },
    // Stub Fase 4a: tidak diuji langsung di sini, hanya supaya bentuk
    // TrustDeps lengkap — rute profil memanggil deps.blokir.himpunanUntuk
    // untuk menyaring angka publik dan bendera pribadi (Task 10).
    blokir: {
      setBlokir: vi.fn(async () => {}),
      adaBlokir: vi.fn(async () => false),
      diblokirOleh: vi.fn(async () => []),
      himpunanUntuk: vi.fn(async () => new Set<string>()),
    },
    // Stub Fase 2: tidak dipakai langsung oleh test profil ini, hanya supaya
    // bentuk TrustDeps lengkap untuk onChanged() yang dipicu createApp.
    trust: {
      loadGraph: async () => ({ edges: [], vouches: [], seeds: [], slashed: [], nowMs: 0 }),
      saveSnapshots: async () => {},
      getSnapshot: async () => null,
      listPublishedTiers: async () => new Map(),
      markPublished: async () => {},
    },
    vouches: {
      countVouchesSince: async () => 0,
      hasVouch: async () => false,
      recordVouch: async () => {},
      markRevoked: async () => {},
    },
    reports: {
      recordReport: async () => {},
      listReports: async () => [],
      setReportStatus: async () => {},
      recordSlash: async () => {},
    },
    attestor: { setScore: async () => TX },
    vouchChain: {
      submitVouch: async () => TX,
      submitRevoke: async () => TX,
      submitSlash: async () => TX,
    },
    vouchContract: A,
    adminToken: "test-admin-token",
  } as unknown as TrustDeps;
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
      inginBertemuCount: 0,
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

describe("GET /connected/:a/:b", () => {
  it("true untuk pasangan yang sudah terkoneksi", async () => {
    const d = deps();
    d.store.areConnected = vi.fn(async () => true);
    const res = await createApp(d).request(`/connected/${A}/${B}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: true });
    expect(d.store.areConnected).toHaveBeenCalledWith(
      A.toLowerCase() as Address, B.toLowerCase() as Address,
    );
  });

  it("false untuk pasangan yang belum terkoneksi", async () => {
    const d = deps();
    d.store.areConnected = vi.fn(async () => false);
    const res = await createApp(d).request(`/connected/${A}/${B}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ connected: false });
    expect(d.store.areConnected).toHaveBeenCalledWith(
      A.toLowerCase() as Address, B.toLowerCase() as Address,
    );
  });

  it("400 untuk alamat yang tidak sah", async () => {
    const d = deps();
    d.store.areConnected = vi.fn(async () => true);
    const res = await createApp(d).request(`/connected/bukan-alamat/${B}`);
    expect(res.status).toBe(400);
    expect(d.store.areConnected).not.toHaveBeenCalled();
  });
});
