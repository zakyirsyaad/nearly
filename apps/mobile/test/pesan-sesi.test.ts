import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  kunciPesanTypedData, recoverDaftarKunciPesanSigner, turunkanKunciPesan, verifikasiRequest, VERSI_KUNCI_PESAN,
} from "@nearly/shared";
import { CONFIG } from "../src/config";
import { _resetSesiPesanUntukTes, sesiPesan } from "../src/pesan/sesi";
import { getRiwayat, postPesan, reqPesan } from "../src/pesan/pesan-api";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);

function signerBerhitung() {
  const tanda = vi.fn((td: never) => A.signTypedData(td as Parameters<typeof A.signTypedData>[0]));
  return { signer: { address: A.address as Address, signTypedData: tanda }, tanda };
}

type Rekaman = { url: string; init: RequestInit };

function pasangFetch(jawab: (url: string) => { status?: number; body?: unknown } = () => ({ body: { ok: true } })) {
  const rekaman: Rekaman[] = [];
  globalThis.fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    rekaman.push({ url, init });
    const j = jawab(url);
    return new Response(JSON.stringify(j.body ?? {}), { status: j.status ?? 200 });
  }) as never;
  return rekaman;
}

const aslinya = globalThis.fetch;
beforeEach(() => _resetSesiPesanUntukTes());
afterEach(() => { globalThis.fetch = aslinya; });

describe("sesiPesan", () => {
  it("menandatangani tepat dua kali per kali buka aplikasi, walau dipanggil bersamaan", async () => {
    const rek = pasangFetch();
    const { signer, tanda } = signerBerhitung();
    const [s1, s2] = await Promise.all([sesiPesan(signer), sesiPesan(signer)]);
    expect(s1).toBe(s2);
    expect(tanda).toHaveBeenCalledTimes(2);
    expect(rek.filter((r) => r.url.endsWith("/pesan/kunci"))).toHaveLength(1);
  });

  it("mendaftarkan kunci publik hasil penurunan, ditandatangani dompet", async () => {
    const rek = pasangFetch();
    const { signer } = signerBerhitung();
    const sesi = await sesiPesan(signer);
    const badan = JSON.parse(String(rek[0]!.init.body)) as {
      who: Address; kunciEnkripsi: Hex; kunciTanda: Hex; expiresAt: string; sig: Hex;
    };
    const harapan = turunkanKunciPesan(await A.signTypedData(
      kunciPesanTypedData({ who: A.address, versi: VERSI_KUNCI_PESAN }, CONFIG.verifyingContract)));
    expect(badan.kunciTanda).toBe(harapan.pubTanda);
    expect(badan.kunciEnkripsi).toBe(harapan.pubEnkripsi);
    expect(sesi.kunci.pubTanda).toBe(harapan.pubTanda);
    const pulih = await recoverDaftarKunciPesanSigner(
      { who: badan.who, kunciEnkripsi: badan.kunciEnkripsi, kunciTanda: badan.kunciTanda, expiresAt: BigInt(badan.expiresAt) },
      badan.sig, CONFIG.verifyingContract);
    expect(pulih.toLowerCase()).toBe(A.address.toLowerCase());
  });

  // Spec 4c §6: tanda tangan KunciPesan membuka seluruh riwayat pesan.
  it("tanda tangan KunciPesan TIDAK PERNAH meninggalkan HP", async () => {
    const rek = pasangFetch();
    const { signer } = signerBerhitung();
    const sesi = await sesiPesan(signer);
    await postPesan(sesi, {
      id: "00000000-0000-4000-8000-000000000001", penerima: A.address,
      ciphertext: "QQ==", nonce: `0x${"cd".repeat(24)}` as Hex,
    });
    await getRiwayat(sesi, A.address);
    const rahasia = (await A.signTypedData(
      kunciPesanTypedData({ who: A.address, versi: VERSI_KUNCI_PESAN }, CONFIG.verifyingContract))).slice(2).toLowerCase();
    expect(rek.length).toBeGreaterThanOrEqual(3);
    for (const r of rek) {
      const semua = `${r.url} ${String(r.init.body ?? "")} ${JSON.stringify(r.init.headers ?? {})}`.toLowerCase();
      expect(semua).not.toContain(rahasia);
    }
  });

  it("pendaftaran yang gagal tidak disimpan: panggilan berikutnya mencoba lagi", async () => {
    pasangFetch(() => ({ status: 500, body: { code: "x" } }));
    const { signer, tanda } = signerBerhitung();
    await expect(sesiPesan(signer)).rejects.toThrow();
    pasangFetch();
    await sesiPesan(signer);
    expect(tanda).toHaveBeenCalledTimes(4);
  });
});

describe("reqPesan", () => {
  it("tanda request di header terverifikasi dengan kunci tanda sesi, untuk GET dan POST", async () => {
    const rek = pasangFetch();
    const { signer } = signerBerhitung();
    const sesi = await sesiPesan(signer);
    await reqPesan(sesi, "GET", "/pesan/percakapan");
    await reqPesan(sesi, "POST", "/pesan/token-push", { token: "ExponentPushToken[x]" });
    await getRiwayat(sesi, A.address, 1_700_000_000_000);
    for (const r of rek.slice(1)) {
      const h = r.init.headers as Record<string, string>;
      const u = new URL(r.url);
      expect(verifikasiRequest({
        method: r.init.method!, pathDenganQuery: u.pathname + u.search, badan: String(r.init.body ?? ""),
        ts: Number(h["x-nearly-ts"]), who: h["x-nearly-who"]!, tanda: h["x-nearly-tanda"]!,
      }, sesi.kunci.pubTanda)).toBe(true);
    }
  });
});
