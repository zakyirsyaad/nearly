import { describe, expect, it } from "vitest";
import { CHAIN_ID, KONTRAK, tautanBscScan } from "../src/kontrak";

describe("kontrak testnet", () => {
  it("kelima kontrak Nearly, nama unik, alamat 20 byte", () => {
    expect(KONTRAK.map((k) => k.nama).sort()).toEqual([
      "AttendanceRegistry", "ConnectionRegistry", "NearlyResolver", "TrustAttestor", "VouchRegistry",
    ]);
    for (const k of KONTRAK) expect(k.alamat).toMatch(/^0x[0-9a-f]{40}$/);
    expect(new Set(KONTRAK.map((k) => k.alamat)).size).toBe(5);
  });

  it("BSC testnet chainId 97 dengan tautan BscScan testnet", () => {
    expect(CHAIN_ID).toBe(97);
    expect(tautanBscScan("0xabc")).toBe("https://testnet.bscscan.com/address/0xabc");
  });
});
