import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { recoverTypedDataAddress, type Address, type Hex } from "viem";
import {
  aturProfilTypedData, blokirTypedData, inginBertemuTypedData, lihatBlokirTypedData,
  lihatFeedTypedData, lihatKecocokanTypedData, lihatProfilTypedData, recoverAturProfilSigner,
  tandaiDilihatTypedData, VISIBILITAS,
} from "../src/index";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = privateKeyToAccount(`0x${"b2".repeat(32)}` as Hex);
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const EXP = 1_800_000_000n;

const msg = { who: A.address, displayName: "Budi", visibilitas: "terlihat" as const, expiresAt: EXP };

const sama = (x: string, y: string) => x.toLowerCase() === y.toLowerCase();

describe("AturProfil", () => {
  it("pulih ke penandatangannya", async () => {
    const sig = await A.signTypedData(aturProfilTypedData(msg, VC));
    expect(sama(await recoverAturProfilSigner(msg, sig, VC), A.address)).toBe(true);
  });

  it("dompet lain tidak pulih sebagai who", async () => {
    const sig = await B.signTypedData(aturProfilTypedData(msg, VC));
    expect(sama(await recoverAturProfilSigner(msg, sig, VC), A.address)).toBe(false);
  });

  // Visibilitas ikut ditandatangani. Tanpa itu, siapa pun yang menangkap satu
  // permintaan bisa memutarnya ulang dengan visibilitas dibalik.
  it("menukar visibilitas membatalkan tanda tangan", async () => {
    const sig = await A.signTypedData(aturProfilTypedData(msg, VC));
    const dibalik = { ...msg, visibilitas: "tersembunyi" as const };
    expect(sama(await recoverAturProfilSigner(dibalik, sig, VC), A.address)).toBe(false);
  });

  it("mengubah nama membatalkan tanda tangan", async () => {
    const sig = await A.signTypedData(aturProfilTypedData(msg, VC));
    expect(sama(await recoverAturProfilSigner({ ...msg, displayName: "Budi " }, sig, VC), A.address)).toBe(false);
  });

  it("domain terikat verifyingContract", async () => {
    const sig = await A.signTypedData(aturProfilTypedData(msg, VC));
    const lain = "0x0000000000000000000000000000000000000def" as Address;
    expect(sama(await recoverAturProfilSigner(msg, sig, lain), A.address)).toBe(false);
  });

  it("VISIBILITAS persis dua mode", () => {
    expect(VISIBILITAS).toEqual(["terlihat", "tersembunyi"]);
  });
});

/**
 * Ruling 23: nama tipe baca ≠ tulis. AturProfil tidak punya tipe baca
 * pasangan, tapi ia hidup di domain yang SAMA dengan keluarga meet, blokir,
 * dan feed. Tanda tangan dari tipe mana pun di domain itu tidak boleh sah
 * sebagai AturProfil — dan sebaliknya.
 */
describe("AturProfil tidak tertukar dengan tipe lain di domain yang sama", () => {
  const who = A.address;
  const target = B.address;
  const lain = [
    () => lihatFeedTypedData({ who, expiresAt: EXP }, VC),
    () => lihatBlokirTypedData({ who, expiresAt: EXP }, VC),
    () => lihatKecocokanTypedData({ who, expiresAt: EXP }, VC),
    () => tandaiDilihatTypedData({ who, expiresAt: EXP }, VC),
    () => lihatProfilTypedData({ target, who, expiresAt: EXP }, VC),
    () => inginBertemuTypedData({ target, who, ingin: true, expiresAt: EXP }, VC),
    () => blokirTypedData({ target, who, blokir: true, expiresAt: EXP }, VC),
  ];

  it("tanda tangan tipe lain tidak pulih sebagai AturProfil", async () => {
    for (const td of lain) {
      const sig = await A.signTypedData(td() as Parameters<typeof A.signTypedData>[0]);
      expect(sama(await recoverAturProfilSigner(msg, sig, VC), A.address)).toBe(false);
    }
  });

  it("tanda tangan AturProfil tidak pulih sebagai tipe lain", async () => {
    const sig = await A.signTypedData(aturProfilTypedData(msg, VC));
    for (const td of lain) {
      const pulih = await recoverTypedDataAddress({ ...(td() as never as object), signature: sig } as never);
      expect(sama(pulih, A.address)).toBe(false);
    }
  });
});
