import { afterEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { recoverAturProfilSigner, turunkanKunciPesan, verifikasiRequest } from "@nearly/shared";
import { CONFIG } from "../src/config";
import { getRadar, postDetak, simpanProfil } from "../src/radar/radar-api";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const EVENT = `0x${"e1".repeat(32)}`;

const aslinya = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = aslinya;
});

function pasangFetch() {
  const rekaman: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    rekaman.push({ url, init });
    return new Response(JSON.stringify({ hadir: true }), { status: 200 });
  }) as never;
  return rekaman;
}

async function sesi() {
  const kunci = turunkanKunciPesan(`0x${"77".repeat(65)}` as Hex);
  return { address: A.address as Address, kunci };
}

describe("radar-api", () => {
  it("postDetak menandatangani path dan badan persis yang dikirim", async () => {
    const rek = pasangFetch();
    const s = await sesi();
    await postDetak(s, EVENT, "qqguv1r");
    const { url, init } = rek[0]!;
    expect(url).toBe(`${CONFIG.apiUrl}/radar/${EVENT}/detak`);
    const h = init.headers as Record<string, string>;
    expect(init.body).toBe(JSON.stringify({ cell: "qqguv1r" }));
    expect(
      verifikasiRequest(
        {
          method: "POST",
          pathDenganQuery: `/radar/${EVENT}/detak`,
          badan: String(init.body),
          ts: Number(h["x-nearly-ts"]),
          who: h["x-nearly-who"]!,
          tanda: h["x-nearly-tanda"]!,
        },
        s.kunci.pubTanda,
      ),
    ).toBe(true);
  });

  it("getRadar tanpa badan", async () => {
    const rek = pasangFetch();
    await getRadar(await sesi(), EVENT);
    expect(rek[0]!.url).toBe(`${CONFIG.apiUrl}/radar/${EVENT}`);
    expect(rek[0]!.init.body).toBeUndefined();
  });

  it("simpanProfil: tanda tangan AturProfil pulih ke dompet, atas medan yang persis dikirim", async () => {
    const rek = pasangFetch();
    const signer = {
      address: A.address as Address,
      signTypedData: (td: never) => A.signTypedData(td),
    };
    await simpanProfil(signer, { displayName: "Budi", visibilitas: "tersembunyi" });
    const badan = JSON.parse(String(rek[0]!.init.body)) as {
      who: Address;
      displayName: string;
      visibilitas: "terlihat" | "tersembunyi";
      expiresAt: string;
      sig: Hex;
    };
    expect(rek[0]!.url).toBe(`${CONFIG.apiUrl}/profil`);
    const pulih = await recoverAturProfilSigner(
      {
        who: badan.who,
        displayName: badan.displayName,
        visibilitas: badan.visibilitas,
        expiresAt: BigInt(badan.expiresAt),
      },
      badan.sig,
      CONFIG.verifyingContract,
    );
    expect(pulih.toLowerCase()).toBe(A.address.toLowerCase());
    expect(badan.visibilitas).toBe("tersembunyi");
  });
});
