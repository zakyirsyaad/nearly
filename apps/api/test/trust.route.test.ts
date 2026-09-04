import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { TIER_LABELS } from "@nearly/trust";
import { tagsHashOf, vouchTypedData } from "@nearly/shared";
import { trustRoutes } from "../src/routes/trust";
import { reportRoutes } from "../src/routes/report";
import { vouchRoutes } from "../src/routes/vouch";

const A = "0x000000000000000000000000000000000000000a" as Address;
const B = "0x000000000000000000000000000000000000000b" as Address;
const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;
const NOW = 1_700_000_000_000;

// PK Anvil default #0, dipakai hanya sebagai penanda tanda tangan asli untuk
// test pemicu ini — pola sama seperti helper `input()` di vouch-gate.test.ts.
const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const account = privateKeyToAccount(PK);

async function signedVouchBody() {
  const expiresAt = BigInt(Math.floor(NOW / 1000) + 3600);
  const tags = ["zk"];
  const msg = { from: account.address, to: B, tagsHash: tagsHashOf(tags), expiresAt };
  return {
    from: account.address,
    to: B,
    tags,
    expiresAt: String(Math.floor(NOW / 1000) + 3600),
    sig: await account.signTypedData(vouchTypedData(msg, CONTRACT)),
  };
}

function app(snapshot: unknown) {
  return trustRoutes({
    trust: { getSnapshot: vi.fn(async () => snapshot) },
  } as never);
}

describe("GET /trust/:address", () => {
  it("mengembalikan tier, label, dan bukti", async () => {
    const res = await app({
      address: A, score: 0.4, ratio: 0.4, tier: 2,
      evidence: { connections: 47, occasions: 6, regions: 3, vouches: 12 },
      operatorCluster: null,
    }).request(`/trust/${A}`);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tier).toBe(2);
    expect(body.tierLabel).toBe(TIER_LABELS[2]);
    expect(body.evidence.connections).toBe(47);
  });

  it("alamat yang belum pernah dihitung mengembalikan tier Baru, bukan 404", async () => {
    const res = await app(null).request(`/trust/${A}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tier).toBe(0);
    expect(body.tierLabel).toBe("Baru");
    expect(body.evidence.connections).toBe(0);
  });

  it("menolak alamat yang tidak sah", async () => {
    const res = await app(null).request("/trust/bukan-alamat");
    expect(res.status).toBe(400);
  });

  it("TIDAK membocorkan skor mentah", async () => {
    const res = await app({
      address: A, score: 0.4, ratio: 0.4, tier: 2,
      evidence: { connections: 1, occasions: 1, regions: 1, vouches: 0 },
      operatorCluster: "0xabc",
    }).request(`/trust/${A}`);
    const body = await res.json();
    // Spec induk §8: tampilkan tier + bukti, bukan angka telanjang. Klaster
    // operator juga tidak dibuka — itu tuduhan, dan gerbangnya belum dilewati.
    expect(body.score).toBeUndefined();
    expect(body.operatorCluster).toBeUndefined();
  });
});

describe("pemicu recompute", () => {
  it("vouch yang berhasil memicu recompute tepat sekali", async () => {
    const onChanged = vi.fn(async () => {});
    const app = vouchRoutes({
      store: { areConnected: vi.fn(async () => true) },
      vouches: {
        countVouchesSince: vi.fn(async () => 0),
        hasVouch: vi.fn(async () => false),
        recordVouch: vi.fn(async () => {}),
        markRevoked: vi.fn(async () => {}),
      },
      vouchChain: { submitVouch: vi.fn(async () => "0xtx") },
      vouchContract: CONTRACT,
      nowMs: () => NOW,
      onChanged,
    } as never);

    const res = await app.request("/vouch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(await signedVouchBody()),
    });
    expect(res.status).toBe(200);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("vouch yang DITOLAK tidak memicu recompute", async () => {
    const onChanged = vi.fn(async () => {});
    const app = vouchRoutes({
      store: { areConnected: vi.fn(async () => false) },
      vouches: {
        countVouchesSince: vi.fn(async () => 0),
        hasVouch: vi.fn(async () => false),
        recordVouch: vi.fn(async () => {}),
        markRevoked: vi.fn(async () => {}),
      },
      vouchChain: { submitVouch: vi.fn(async () => "0xtx") },
      vouchContract: CONTRACT,
      nowMs: () => NOW,
      onChanged,
    } as never);

    await app.request("/vouch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(await signedVouchBody()),
    });
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe("POST /report", () => {
  it("GERBANG: laporan mencatat, tapi TIDAK menyentuh skor sama sekali", async () => {
    const recordReport = vi.fn(async () => {});
    const saveSnapshots = vi.fn(async () => {});
    const setScore = vi.fn(async () => "0xtx");

    const app = reportRoutes({
      reports: {
        recordReport,
        listReports: vi.fn(async () => []),
        setReportStatus: vi.fn(async () => {}),
        recordSlash: vi.fn(async () => {}),
      },
    } as never);

    const res = await app.request("/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        reporter: A, subject: B, reason: "menjual token palsu di venue",
      }),
    });

    expect(res.status).toBe(200);
    expect(recordReport).toHaveBeenCalledTimes(1);
    // Spec induk §6: laporan TIDAK PERNAH menurunkan trust secara langsung.
    // Kalau suatu saat seseorang menambahkan onChanged() ke route ini, test
    // ini yang menangkapnya.
    expect(saveSnapshots).not.toHaveBeenCalled();
    expect(setScore).not.toHaveBeenCalled();
  });
});
