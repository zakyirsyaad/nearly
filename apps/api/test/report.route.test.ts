import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { reasonHashOf, reportTypedData } from "@nearly/shared";
import { reportRoutes } from "../src/routes/report";
import { A, B, CONTRACT, NOW } from "./support/deps";

// Task 1: sebelum ini, `reporter` datang telanjang dari body request tanpa
// tanda tangan — siapa pun bisa mengaku sebagai tiga pelapor ber-trust tinggi
// yang saling asing dan menembus gerbang anti-brigading (spec fase §6). Test
// ini memastikan tanda tangan BENAR-BENAR ditegakkan, bukan cuma diterima.
const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const account = privateKeyToAccount(PK);
// Kunci kedua HANYA untuk membuat tanda tangan yang formatnya sah tapi
// penandatangannya BUKAN reporter yang diklaim — beda dari sig acak (yang
// bisa gagal di tahap ecrecover, bukan di pengecekan alamat).
const OTHER_PK = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex;
const otherAccount = privateKeyToAccount(OTHER_PK);
const REASON = "menjual token palsu di venue";

function deps(recordReport = vi.fn(async () => {})) {
  return { reports: { recordReport, listReports: vi.fn(), setReportStatus: vi.fn(), recordSlash: vi.fn() } as never, vouchContract: CONTRACT, nowMs: () => NOW };
}

async function post(recordReport: ReturnType<typeof vi.fn>, body: unknown) {
  const app = reportRoutes(deps(recordReport));
  return app.request("/report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function signedBody(over: {
  reporter?: Address; subject?: Address; reason?: string; expiresAt?: bigint; badSig?: boolean;
} = {}) {
  const reporter = over.reporter ?? account.address;
  const subject = over.subject ?? B;
  const reason = over.reason ?? REASON;
  const expiresAt = over.expiresAt ?? BigInt(Math.floor(NOW / 1000) + 3600);
  const msg = { reporter, subject, reasonHash: reasonHashOf(reason), expiresAt };
  const sig = over.badSig
    ? await otherAccount.signTypedData(reportTypedData(msg, CONTRACT))
    : await account.signTypedData(reportTypedData(msg, CONTRACT));
  return { reporter, subject, reason, expiresAt: expiresAt.toString(), sig };
}

describe("POST /report — tanda tangan EIP-712", () => {
  it("tanda tangan yang sah tercatat", async () => {
    const recordReport = vi.fn(async () => {});
    const res = await post(recordReport, await signedBody());
    expect(res.status).toBe(200);
    expect(recordReport).toHaveBeenCalledTimes(1);
    expect(recordReport).toHaveBeenCalledWith(
      expect.objectContaining({ reporter: account.address, subject: B, reason: REASON }),
    );
  });

  it("penandatangan yang salah ditolak 401, tidak dicatat", async () => {
    const recordReport = vi.fn(async () => {});
    const res = await post(recordReport, await signedBody({ badSig: true }));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "bad_signature" });
    expect(recordReport).not.toHaveBeenCalled();
  });

  it("laporan mengaku dari alamat lain (reporter != penandatangan) ditolak 401", async () => {
    // Ini SIS persis serangan yang ditutup Task 1: sebelumnya `reporter` di
    // body dipercaya apa adanya. Di sini tanda tangan sah milik `account`,
    // tapi `reporter` di body diklaim sebagai A — harus tetap ditolak.
    const recordReport = vi.fn(async () => {});
    const msg = {
      reporter: account.address, subject: B, reasonHash: reasonHashOf(REASON),
      expiresAt: BigInt(Math.floor(NOW / 1000) + 3600),
    };
    const sig = await account.signTypedData(reportTypedData(msg, CONTRACT));
    const res = await post(recordReport, {
      reporter: A, subject: B, reason: REASON,
      expiresAt: String(Math.floor(NOW / 1000) + 3600), sig,
    });
    expect(res.status).toBe(401);
    expect(recordReport).not.toHaveBeenCalled();
  });

  it("kedaluwarsa ditolak 410, tidak dicatat", async () => {
    const recordReport = vi.fn(async () => {});
    const lampau = BigInt(Math.floor(NOW / 1000) - 10);
    const res = await post(recordReport, await signedBody({ expiresAt: lampau }));
    expect(res.status).toBe(410);
    expect(await res.json()).toMatchObject({ code: "expired" });
    expect(recordReport).not.toHaveBeenCalled();
  });

  it("GERBANG: tanda tangan untuk SATU alasan tidak sah untuk alasan LAIN", async () => {
    // Tanpa reasonHash di dalam pesan yang ditandatangani, seseorang bisa
    // menandatangani laporan yang jinak lalu server (atau siapa pun yang
    // menguasai transport) menukar `reason` dengan tuduhan yang berbeda tanpa
    // membatalkan tanda tangannya.
    const recordReport = vi.fn(async () => {});
    const body = await signedBody({ reason: "alasan asli yang ditandatangani" });
    const res = await post(recordReport, { ...body, reason: "alasan lain yang ditukar diam-diam" });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "bad_signature" });
    expect(recordReport).not.toHaveBeenCalled();
  });

  it("400 untuk body yang tidak sesuai skema (sig/expiresAt hilang)", async () => {
    const recordReport = vi.fn(async () => {});
    const res = await post(recordReport, { reporter: account.address, subject: B, reason: REASON });
    expect(res.status).toBe(400);
    expect(recordReport).not.toHaveBeenCalled();
  });
});
