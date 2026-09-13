import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { kunciPesanTypedData, tandaRequest, turunkanKunciPesan, VERSI_KUNCI_PESAN } from "@nearly/shared";
import { pemanggilPesan, type RequestPesan } from "../src/pesan-auth";

const VC = "0x0000000000000000000000000000000000000abc" as Address;
const NOW = 1_700_000_000_000;
const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = privateKeyToAccount(`0x${"b2".repeat(32)}` as Hex);

async function kunci(akun: typeof A) {
  return turunkanKunciPesan(await akun.signTypedData(
    kunciPesanTypedData({ who: akun.address, versi: VERSI_KUNCI_PESAN }, VC)));
}

async function requestBertanda(over: Partial<{ method: string; path: string; badan: string; ts: number; who: string }> = {}) {
  const ka = await kunci(A);
  const isi = {
    method: over.method ?? "POST", pathDenganQuery: over.path ?? "/pesan",
    badan: over.badan ?? "{\"x\":1}", ts: over.ts ?? Math.floor(NOW / 1000), who: over.who ?? A.address,
  };
  const tanda = tandaRequest(ka.privTanda, isi);
  const header: Record<string, string> = {
    "x-nearly-who": isi.who, "x-nearly-ts": String(isi.ts), "x-nearly-tanda": tanda,
  };
  const r: RequestPesan = {
    method: isi.method, pathDenganQuery: isi.pathDenganQuery, badan: isi.badan,
    header: (n) => header[n.toLowerCase()],
  };
  return { r, header, ka };
}

function deps(peta: Record<string, { kunciEnkripsi: Hex; kunciTanda: Hex }>) {
  return {
    nowMs: () => NOW,
    pesan: { ambilKunci: vi.fn(async (a: Address) => peta[a.toLowerCase()] ?? null) },
  };
}

describe("pemanggilPesan", () => {
  it("request bertanda sah → alamat huruf kecil", async () => {
    const { r, ka } = await requestBertanda();
    const d = deps({ [A.address.toLowerCase()]: { kunciEnkripsi: ka.pubEnkripsi, kunciTanda: ka.pubTanda } });
    expect(await pemanggilPesan(r, d)).toBe(A.address.toLowerCase());
  });

  it("header hilang → null tanpa membaca store", async () => {
    const { r } = await requestBertanda();
    const d = deps({});
    expect(await pemanggilPesan({ ...r, header: () => undefined }, d)).toBeNull();
    expect(d.pesan.ambilKunci).not.toHaveBeenCalled();
  });

  it("ts di luar jendela 300 detik → null", async () => {
    for (const geser of [-301, 301]) {
      const { r, ka } = await requestBertanda({ ts: Math.floor(NOW / 1000) + geser });
      const d = deps({ [A.address.toLowerCase()]: { kunciEnkripsi: ka.pubEnkripsi, kunciTanda: ka.pubTanda } });
      expect(await pemanggilPesan(r, d)).toBeNull();
    }
  });

  it("alamat tanpa kunci terdaftar → null", async () => {
    const { r } = await requestBertanda();
    expect(await pemanggilPesan(r, deps({}))).toBeNull();
  });

  it("badan diubah setelah ditandatangani → null", async () => {
    const { r, ka } = await requestBertanda();
    const d = deps({ [A.address.toLowerCase()]: { kunciEnkripsi: ka.pubEnkripsi, kunciTanda: ka.pubTanda } });
    expect(await pemanggilPesan({ ...r, badan: "{\"x\":2}" }, d)).toBeNull();
  });

  it("path diubah setelah ditandatangani → null", async () => {
    const { r, ka } = await requestBertanda();
    const d = deps({ [A.address.toLowerCase()]: { kunciEnkripsi: ka.pubEnkripsi, kunciTanda: ka.pubTanda } });
    expect(await pemanggilPesan({ ...r, pathDenganQuery: "/pesan/kunci" }, d)).toBeNull();
  });

  // Tanda tangan A tapi mengaku B, dan B punya kunci terdaftar.
  it("mengaku alamat lain → null", async () => {
    const { header, ka } = await requestBertanda();
    const kb = await kunci(B);
    const d = deps({
      [A.address.toLowerCase()]: { kunciEnkripsi: ka.pubEnkripsi, kunciTanda: ka.pubTanda },
      [B.address.toLowerCase()]: { kunciEnkripsi: kb.pubEnkripsi, kunciTanda: kb.pubTanda },
    });
    const palsu: Record<string, string> = { ...header, "x-nearly-who": B.address };
    expect(await pemanggilPesan({
      method: "POST", pathDenganQuery: "/pesan", badan: "{\"x\":1}", header: (n) => palsu[n],
    }, d)).toBeNull();
  });

  it("tanda cacat bentuk → null, bukan lemparan", async () => {
    const { header, ka } = await requestBertanda();
    const d = deps({ [A.address.toLowerCase()]: { kunciEnkripsi: ka.pubEnkripsi, kunciTanda: ka.pubTanda } });
    const cacat: Record<string, string> = { ...header, "x-nearly-tanda": `0x${"9".repeat(130)}` };
    await expect(pemanggilPesan({
      method: "POST", pathDenganQuery: "/pesan", badan: "{\"x\":1}", header: (n) => cacat[n],
    }, d)).resolves.toBeNull();
  });

  // Store yang mati BUKAN penolakan autentikasi — ia harus sampai ke Hono
  // sebagai 500 supaya pemadaman terlihat.
  it("galat store merambat, tidak dicuci jadi null", async () => {
    const { r } = await requestBertanda();
    const d = { nowMs: () => NOW, pesan: { ambilKunci: vi.fn(async () => { throw new Error("db mati"); }) } };
    await expect(pemanggilPesan(r, d)).rejects.toThrow("db mati");
  });
});
