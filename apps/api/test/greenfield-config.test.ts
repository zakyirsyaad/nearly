import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { createGreenfield } from "../src/greenfield";

const cfg = {
  rpcUrl: "https://gnfd-testnet-fullnode-tendermint-ap.bnbchain.org",
  chainId: "5600",
  bucket: "nearly-feed",
  spEndpoint: "https://gnfd-testnet-sp-2.bnbchain.org",
  privateKey: `0x${"11".repeat(32)}` as Hex,
};

describe("createGreenfield", () => {
  // Membuat klien TIDAK boleh menyentuh jaringan: kalau ia melakukannya,
  // API gagal menyala saat Greenfield sedang mati — padahal spec §8.2
  // menuntut feed teks tetap hidup dalam keadaan itu.
  it("membuat port tanpa menyentuh jaringan", () => {
    const gf = createGreenfield(cfg);
    expect(gf.bucket).toBe("nearly-feed");
    expect(gf.spEndpoint).toBe("https://gnfd-testnet-sp-2.bnbchain.org");
    expect(typeof gf.upload).toBe("function");
  });

  it("menolak bucket kosong saat dibuat, bukan saat unggahan pertama", () => {
    expect(() => createGreenfield({ ...cfg, bucket: "" }))
      .toThrow(/GREENFIELD_BUCKET/);
  });

  it("menolak endpoint storage provider kosong", () => {
    expect(() => createGreenfield({ ...cfg, spEndpoint: "" }))
      .toThrow(/GREENFIELD_SP_ENDPOINT/);
  });
});
