// Helper bersama untuk test route API. BUKAN berkas test (tidak berakhiran
// .test.ts, lihat vitest.config.ts: hanya "test/**/*.test.ts" yang dikumpulkan)
// supaya bisa di-import dari beberapa berkas test tanpa mendaftarkan ulang
// describe/it milik trust.route.test.ts.
import { vi } from "vitest";
import type { Address, Hex } from "viem";
import type { TrustDeps } from "../../src/app";

export const A = "0x000000000000000000000000000000000000000a" as Address;
export const B = "0x000000000000000000000000000000000000000b" as Address;
export const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;
export const NOW = 1_700_000_000_000;

/**
 * TrustDeps lengkap untuk createApp, seluruh port distub sebagai vi.fn().
 *
 * `overrides.saveSnapshots` dan `overrides.setScore` menggantikan spy default
 * trust.saveSnapshots / attestor.setScore, supaya test bisa mengamati jalur
 * recompute SUNGGUHAN (lewat onChanged di app.ts), bukan spy lokal yang tidak
 * tersambung ke apa pun.
 *
 * `overrides.trust`, `overrides.reports`, `overrides.vouchChain`, dan
 * `overrides.adminToken` di-merge di atas nilai default masing-masing —
 * dipakai admin.route.test.ts untuk mengendalikan gerbang confirmSlash
 * (snapshot pelapor, graf koneksi, dan hasil chain) tanpa menduplikasi
 * seluruh helper ini.
 */
export function depsFor(overrides: {
  saveSnapshots?: ReturnType<typeof vi.fn>;
  setScore?: ReturnType<typeof vi.fn>;
  recordReport?: ReturnType<typeof vi.fn>;
  trust?: Partial<TrustDeps["trust"]>;
  reports?: Partial<TrustDeps["reports"]>;
  vouchChain?: Partial<TrustDeps["vouchChain"]>;
  adminToken?: string;
} = {}): TrustDeps {
  return {
    verifyingContract: CONTRACT,
    nowMs: () => NOW,
    store: {
      putOffer: vi.fn(async () => {}),
      getOffer: vi.fn(async () => null),
      consumeOffer: vi.fn(async () => {}),
      // true supaya jalur vouch (submitVouch -> areConnected) bisa lewat.
      areConnected: vi.fn(async () => true),
      countConnectionsSince: vi.fn(async () => 0),
      recordConnection: vi.fn(async () => {}),
    },
    chain: { submitConnect: vi.fn(async (): Promise<Hex> => "0xtx" as Hex) },
    profiles: {
      listConnections: vi.fn(async () => []),
      countConnections: vi.fn(async () => 0),
      getDisplayName: vi.fn(async () => ""),
    },
    identity: {
      ensName: vi.fn(async () => null),
      txCount: vi.fn(async () => 0),
    },
    trust: {
      // Graf minimal berisi satu seed, cukup untuk computeTrust menghasilkan
      // satu baris tanpa melempar.
      loadGraph: vi.fn(async () => ({
        edges: [], vouches: [], seeds: [{ address: A, weight: 1 }], slashed: [], nowMs: NOW,
      })),
      saveSnapshots: overrides.saveSnapshots ?? vi.fn(async () => {}),
      getSnapshot: vi.fn(async () => null),
      listPublishedTiers: vi.fn(async () => new Map()),
      markPublished: vi.fn(async () => {}),
      ...overrides.trust,
    },
    vouches: {
      countVouchesSince: vi.fn(async () => 0),
      hasVouch: vi.fn(async () => false),
      recordVouch: vi.fn(async () => {}),
      markRevoked: vi.fn(async () => {}),
    },
    reports: {
      recordReport: overrides.recordReport ?? vi.fn(async () => {}),
      listReports: vi.fn(async () => []),
      setReportStatus: vi.fn(async () => {}),
      recordSlash: vi.fn(async () => {}),
      ...overrides.reports,
    },
    attestor: { setScore: overrides.setScore ?? vi.fn(async (): Promise<Hex> => "0xtx" as Hex) },
    vouchChain: {
      submitVouch: vi.fn(async (): Promise<Hex> => "0xtx" as Hex),
      submitRevoke: vi.fn(async (): Promise<Hex> => "0xtx" as Hex),
      submitSlash: vi.fn(async (): Promise<Hex> => "0xtx" as Hex),
      ...overrides.vouchChain,
    },
    vouchContract: CONTRACT,
    adminToken: overrides.adminToken ?? "test-admin-token",
  };
}
