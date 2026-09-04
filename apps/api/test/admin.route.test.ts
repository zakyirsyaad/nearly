import { describe, expect, it, vi } from "vitest";
import type { Address, Hex } from "viem";
import type { Tier } from "@nearly/trust";
import { createApp } from "../src/app";
import { depsFor, NOW } from "./support/deps";

// Subjek yang dilaporkan, dan tiga pelapor. Dibangun lewat helper alamat
// supaya panjangnya selalu benar (40 karakter hex) tanpa dihitung manual.
const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;
const SUBJECT = addr(0xf00);
const R1 = addr(1);
const R2 = addr(2);
const R3 = addr(3);

const REPORTS = [R1, R2, R3].map((reporter) => ({ reporter, subject: SUBJECT, atMs: NOW }));

/** Snapshot pelapor yang "trusted": ratio di atas ambang MIN_REPORTER_RATIO (0.15). */
function trustedSnapshot(addrLower: string) {
  return {
    address: addrLower as Address, score: 0.5, ratio: 0.5, tier: 2 as Tier,
    evidence: { connections: 1, occasions: 1, regions: 1, vouches: 0 },
    operatorCluster: null,
  };
}

function graphOf(edges: { a: Address; b: Address }[]) {
  return {
    edges: edges.map((e) => ({ ...e, occasionId: "x", atMs: NOW, blocked: false })),
    vouches: [],
    // Seed apa pun cukup — dipakai onChanged (recomputeTrust), yang hanya
    // benar-benar terpanggil pada kasus gerbang lolos.
    seeds: [{ address: SUBJECT, weight: 1 }],
    slashed: [],
    nowMs: NOW,
  };
}

/**
 * deps lengkap untuk confirmSlash lewat createApp: tiga pelapor trusted
 * (ratio 0.5 >= MIN_REPORTER_RATIO 0.15), snapshot per alamat, dan graf yang
 * edge-nya diatur lewat `edges` (kosong = pelapor saling asing, terisi =
 * pelapor saling terhubung / brigading).
 */
function slashDeps(overrides: {
  edges?: { a: Address; b: Address }[];
  submitSlash?: ReturnType<typeof vi.fn>;
  setReportStatus?: ReturnType<typeof vi.fn>;
  recordSlash?: ReturnType<typeof vi.fn>;
  saveSnapshots?: ReturnType<typeof vi.fn>;
  adminToken?: string;
} = {}) {
  const getSnapshot = vi.fn(async (a: Address) => {
    const lower = a.toLowerCase();
    const trusted = [R1, R2, R3].map((x) => x.toLowerCase());
    return trusted.includes(lower) ? trustedSnapshot(lower) : null;
  });

  return depsFor({
    adminToken: overrides.adminToken ?? "rahasia-admin",
    saveSnapshots: overrides.saveSnapshots,
    trust: {
      getSnapshot,
      loadGraph: vi.fn(async () => graphOf(overrides.edges ?? [])),
    },
    reports: {
      listReports: vi.fn(async () => REPORTS),
      setReportStatus: overrides.setReportStatus ?? vi.fn(async () => {}),
      recordSlash: overrides.recordSlash ?? vi.fn(async () => {}),
    },
    vouchChain: {
      submitSlash: overrides.submitSlash ?? vi.fn(async (): Promise<Hex> => "0xslash" as Hex),
    },
  });
}

describe("POST /admin/slash/:address", () => {
  it("token hilang atau salah ditolak dengan 401, tidak ada panggilan ke chain", async () => {
    const submitSlash = vi.fn(async (): Promise<Hex> => "0xslash" as Hex);
    const app = createApp(slashDeps({ submitSlash }));

    const tanpaHeader = await app.request(`/admin/slash/${SUBJECT}`, { method: "POST" });
    expect(tanpaHeader.status).toBe(401);

    const headerSalah = await app.request(`/admin/slash/${SUBJECT}`, {
      method: "POST",
      headers: { "x-admin-token": "token-yang-salah" },
    });
    expect(headerSalah.status).toBe(401);

    expect(submitSlash).not.toHaveBeenCalled();
  });

  it("adminToken kosong tetap ditolak 401 walau header juga kosong", async () => {
    const submitSlash = vi.fn(async (): Promise<Hex> => "0xslash" as Hex);
    const app = createApp(slashDeps({ submitSlash, adminToken: "" }));

    // Header tidak dikirim sama sekali -> defaultnya "", persis seperti
    // adminToken yang dikonfigurasi kosong. Keduanya kosong TIDAK boleh cocok.
    const res = await app.request(`/admin/slash/${SUBJECT}`, {
      method: "POST",
      headers: { "x-admin-token": "" },
    });
    expect(res.status).toBe(401);
    expect(submitSlash).not.toHaveBeenCalled();
  });

  it("gerbang tidak lolos (brigading) -> 409, status ditolak, tidak ada panggilan chain", async () => {
    // Ketiga pelapor saling terhubung satu sama lain -> hanya terhitung satu
    // suara independen, gerbang tidak pernah lolos (packages/trust/slashing.ts).
    const submitSlash = vi.fn(async (): Promise<Hex> => "0xslash" as Hex);
    const setReportStatus = vi.fn(async () => {});
    const recordSlash = vi.fn(async () => {});
    const app = createApp(slashDeps({
      edges: [{ a: R1, b: R2 }, { a: R1, b: R3 }, { a: R2, b: R3 }],
      submitSlash,
      setReportStatus,
      recordSlash,
    }));

    const res = await app.request(`/admin/slash/${SUBJECT}`, {
      method: "POST",
      headers: { "x-admin-token": "rahasia-admin" },
    });

    expect(res.status).toBe(409);
    expect(setReportStatus).toHaveBeenCalledWith(SUBJECT.toLowerCase(), "ditolak");
    expect(submitSlash).not.toHaveBeenCalled();
    expect(recordSlash).not.toHaveBeenCalled();
  });

  it("gerbang lolos -> memanggil submitSlash, mencatat slash, status terkonfirmasi, memicu onChanged", async () => {
    // Ketiga pelapor asing satu sama lain (tidak ada edge) -> masing-masing
    // dihitung independen, gerbang lolos (3 pelapor independen, MIN_REPORTERS=3).
    const submitSlash = vi.fn(async (): Promise<Hex> => "0xslash" as Hex);
    const setReportStatus = vi.fn(async () => {});
    const recordSlash = vi.fn(async () => {});
    const saveSnapshots = vi.fn(async () => {});
    const app = createApp(slashDeps({
      edges: [], submitSlash, setReportStatus, recordSlash, saveSnapshots,
    }));

    const res = await app.request(`/admin/slash/${SUBJECT}`, {
      method: "POST",
      headers: { "x-admin-token": "rahasia-admin" },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.txHash).toBe("0xslash");
    expect(submitSlash).toHaveBeenCalledWith(SUBJECT.toLowerCase());
    expect(recordSlash).toHaveBeenCalledWith(SUBJECT.toLowerCase(), "0xslash");
    expect(setReportStatus).toHaveBeenCalledWith(SUBJECT.toLowerCase(), "terkonfirmasi");
    // onChanged (app.ts) memanggil recomputeTrust, yang memanggil
    // trust.saveSnapshots -- spy yang sama yang dipakai jalur nyata,
    // bukan spy lokal yang tidak tersambung ke apa pun.
    expect(saveSnapshots).toHaveBeenCalled();
  });

  it("kegagalan chain -> 502, tidak ada slash yang dicatat", async () => {
    const submitSlash = vi.fn(async () => { throw new Error("rpc gagal"); });
    const setReportStatus = vi.fn(async () => {});
    const recordSlash = vi.fn(async () => {});
    const app = createApp(slashDeps({
      edges: [], submitSlash, setReportStatus, recordSlash,
    }));

    const res = await app.request(`/admin/slash/${SUBJECT}`, {
      method: "POST",
      headers: { "x-admin-token": "rahasia-admin" },
    });

    expect(res.status).toBe(502);
    expect(recordSlash).not.toHaveBeenCalled();
    // Laporan tidak boleh terlihat terkonfirmasi kalau tidak ada yang benar-benar
    // mendarat on-chain.
    expect(setReportStatus).not.toHaveBeenCalledWith(SUBJECT.toLowerCase(), "terkonfirmasi");
  });
});
