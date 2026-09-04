import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import { TIER_LABELS } from "@nearly/trust";
import { reasonHashOf, reportTypedData, tagsHashOf, vouchTypedData } from "@nearly/shared";
import { createApp } from "../src/app";
import { trustRoutes } from "../src/routes/trust";
import { vouchRoutes } from "../src/routes/vouch";
import { A, B, CONTRACT, NOW, depsFor } from "./support/deps";

// PK Anvil default #0, dipakai hanya sebagai penanda tanda tangan asli untuk
// test pemicu ini — pola sama seperti helper `input()` di vouch-gate.test.ts.
const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const account = privateKeyToAccount(PK);

// Badan permintaan vouch yang tanda tangannya SENGAJA tidak sah, dipakai HANYA
// oleh test "vouch yang DITOLAK tidak memicu recompute". Test pemicu yang
// positif memakai signedVouchBody(), karena vouch yang ditolak tidak pernah
// sampai ke onChanged.
const VOUCH_BODY_INVALID = {
  from: A, to: B, tags: ["zk"],
  expiresAt: String(Math.floor(NOW / 1000) + 3600),
  sig: `0x${"1".repeat(130)}`,
};

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

// Task 1: laporan JUGA lewat EIP-712 sekarang — `reporter` tidak lagi datang
// telanjang dari body. `reporter` di sini WAJIB alamat yang bisa menandatangani
// (account.address), bukan konstanta A, karena A bukan turunan private key.
async function signedReportBody(reason: string, subject = B) {
  const expiresAt = BigInt(Math.floor(NOW / 1000) + 3600);
  const msg = {
    reporter: account.address, subject, reasonHash: reasonHashOf(reason), expiresAt,
  };
  return {
    reporter: account.address,
    subject,
    reason,
    expiresAt: String(Math.floor(NOW / 1000) + 3600),
    sig: await account.signTypedData(reportTypedData(msg, CONTRACT)),
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
      body: JSON.stringify(VOUCH_BODY_INVALID),
    });
    expect(onChanged).not.toHaveBeenCalled();
  });
});

describe("POST /report", () => {
  // Test ini WAJIB dibangun lewat createApp, bukan lewat reportRoutes langsung.
  //
  // Versi sebelumnya membuat dua vi.fn() lokal dan menegaskan keduanya tidak
  // terpanggil — padahal keduanya tidak pernah disambungkan ke apa pun, jadi
  // assertion-nya benar apa pun yang dilakukan route. Test yang tidak bisa
  // gagal lebih buruk daripada tidak ada test, karena ia terlihat seperti
  // perlindungan. Spy HARUS spy yang sama yang dipakai jalur recompute
  // sungguhan, dan test kedua di bawah membuktikan spy itu memang terjangkau.
  it("GERBANG: laporan mencatat, tapi TIDAK menyentuh skor sama sekali", async () => {
    const saveSnapshots = vi.fn(async () => {});
    const setScore = vi.fn(async (): Promise<Hex> => "0xtx" as Hex);
    const recordReport = vi.fn(async () => {});
    const app = createApp(depsFor({ saveSnapshots, setScore, recordReport }));

    const res = await app.request("/report", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(await signedReportBody("menjual token palsu di venue")),
    });

    expect(res.status).toBe(200);
    expect(recordReport).toHaveBeenCalledTimes(1);
    // Spec induk §6: laporan TIDAK PERNAH menurunkan trust secara langsung.
    expect(saveSnapshots).not.toHaveBeenCalled();
    expect(setScore).not.toHaveBeenCalled();
  });

  it("spy yang sama TERPANGGIL lewat jalur yang memang memicu recompute", async () => {
    // Tanpa test ini, test di atas bisa lolos hanya karena spy-nya tidak
    // terjangkau. Ini yang membuktikan spy-nya hidup.
    const saveSnapshots = vi.fn(async () => {});
    const setScore = vi.fn(async (): Promise<Hex> => "0xtx" as Hex);
    const app = createApp(depsFor({ saveSnapshots, setScore }));

    const res = await app.request("/vouch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(await signedVouchBody()),
    });

    expect(res.status).toBe(200);
    expect(saveSnapshots).toHaveBeenCalled();
  });
});
