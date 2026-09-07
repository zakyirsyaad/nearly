import {
  afterEach, describe, expect, it, vi,
} from "vitest";
import type { Hex } from "viem";
import { Client } from "@bnb-chain/greenfield-js-sdk";
import { createGreenfield } from "../src/greenfield";

const cfg = {
  rpcUrl: "https://gnfd-testnet-fullnode-tendermint-ap.bnbchain.org",
  chainId: "5600",
  bucket: "nearly-feed",
  spEndpoint: "https://gnfd-testnet-sp-2.bnbchain.org",
  privateKey: `0x${"11".repeat(32)}` as Hex,
};

describe("createGreenfield", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // CATATAN JUJUR: Client.create di SDK ini murni sinkron dan tidak
  // menyentuh jaringan sama sekali (lihat client.d.ts — bukan async, tidak
  // ada I/O). Jadi tes ini TIDAK BISA membuktikan "tidak menyentuh
  // jaringan" lewat efek jaringan apa pun — memanggilnya langsung di sini
  // pun tidak akan gagal atau melempar.
  //
  // Yang benar-benar bisa dan perlu dijaga: desain MALAS-nya. Kalau
  // `Client.create(...)` dipindah dari getter malas (`dapatkanKlien`) ke
  // badan `createGreenfield` itu sendiri — regresi persis yang ingin
  // dicegah spec §8.2, supaya API tetap menyala saat Greenfield mati —
  // maka spy di bawah ini akan tertangkap terpanggil, dan tes ini gagal.
  it("mengembalikan port dengan bucket/spEndpoint/upload tanpa memanggil Client.create (desain malas)", () => {
    const spyCreate = vi.spyOn(Client, "create");

    const gf = createGreenfield(cfg);

    expect(gf.bucket).toBe("nearly-feed");
    expect(gf.spEndpoint).toBe("https://gnfd-testnet-sp-2.bnbchain.org");
    expect(typeof gf.upload).toBe("function");
    expect(spyCreate).not.toHaveBeenCalled();
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
