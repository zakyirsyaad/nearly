import {
  afterEach, describe, expect, it, vi,
} from "vitest";
import type { Hex } from "viem";
import { Client } from "@bnb-chain/greenfield-js-sdk";
import {
  createGreenfield, pastikanSpSukses, pastikanTxSukses, unggahLewatKlien,
  type KlienUnggah,
} from "../src/greenfield";

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

/**
 * Bentuk kembalian di bawah ini DIBACA dari node_modules
 * (@bnb-chain/greenfield-js-sdk@2.2.2), bukan ditebak:
 *
 * - `uploadObject` bertipe `SpResponse<null>` =
 *   `{ code: number | string; message?: string; statusCode?: number }`, dan
 *   implementasinya (`putObject`) MENANGKAP galat HTTP dari storage provider
 *   lalu mengembalikan `{ code: error.code || -1, ... }`. SP yang menolak
 *   TIDAK melempar.
 * - `tx.broadcast` bertipe `DeliverTxResponse` (@cosmjs/stargate), yang
 *   kolom `code`-nya berdokumen "sukses jika dan hanya jika code 0".
 *
 * Tes ini tidak menyentuh jaringan sama sekali: klien SDK diganti fake, dan
 * checksum Reed-Solomon diberikan jadi (langkah 1 tidak ikut dijalankan).
 */
const cfgUnggah = { ...cfg };
const ALAMAT = "0x1111111111111111111111111111111111111111";
const ARGS = { objectName: "abc.jpg", mime: "image/jpeg", bytes: new Uint8Array([1, 2, 3]) };

function klienPalsu(a: {
  txCode?: number;
  spHasil?: unknown;
  jejak?: { unggahDipanggil: boolean };
}): KlienUnggah {
  return {
    object: {
      createObject: async () => ({
        simulate: async () => ({ gasLimit: 1200n, gasPrice: "5000000000", gasFee: "1" }),
        broadcast: async () => ({
          code: a.txCode ?? 0,
          transactionHash: "0xdeadbeef",
          rawLog: a.txCode ? "out of gas" : "",
        }),
        metaTxInfo: {},
      }),
      uploadObject: async () => {
        if (a.jejak) a.jejak.unggahDipanggil = true;
        return a.spHasil ?? { code: 0, message: "Put object success.", statusCode: 200 };
      },
    },
  } as unknown as KlienUnggah;
}

describe("penjaga hasil Greenfield", () => {
  it("meloloskan code 0", () => {
    expect(() => pastikanTxSukses({ code: 0, transactionHash: "0x1" }, "createObject")).not.toThrow();
    expect(() => pastikanSpSukses({ code: 0 }, "uploadObject")).not.toThrow();
  });

  it("melempar dengan code dan message di dalam pesannya", () => {
    expect(() => pastikanSpSukses(
      { code: -1, message: "no permission", statusCode: 403 }, "uploadObject",
    )).toThrow(/-1.*no permission/);
  });

  // `code` di SpResponse bertipe `number | string`. Kode galat berupa teks
  // tidak boleh diam-diam lolos.
  it("menolak code berupa string yang bukan nol", () => {
    expect(() => pastikanSpSukses({ code: "InvalidRequest" }, "uploadObject"))
      .toThrow(/InvalidRequest/);
  });

  it("menolak hasil yang tidak ada sama sekali", () => {
    expect(() => pastikanSpSukses(undefined, "uploadObject")).toThrow(/tidak mengembalikan hasil/);
    expect(() => pastikanTxSukses(null, "createObject")).toThrow(/tidak mengembalikan hasil/);
  });
});

describe("unggahLewatKlien", () => {
  it("selesai tanpa melempar ketika kedua langkah mengembalikan code 0", async () => {
    await expect(unggahLewatKlien(klienPalsu({}), cfgUnggah, ALAMAT, ARGS, ["c1"]))
      .resolves.toBeUndefined();
  });

  /**
   * INTI perbaikan ini. Tanpa pemeriksaan nilai kembalian, `upload` selesai
   * dengan sukses, `prosesUnggahGambar` memanggil `setImageDone`, dan
   * unggahan ditandai `ready` dengan URL gambar yang tidak pernah ada —
   * status `failed` yang menjadi tumpuan spec §8.2 dan §11.4 tidak pernah
   * terjadi.
   */
  it("melempar ketika storage provider menolak dengan code bukan nol", async () => {
    const klien = klienPalsu({ spHasil: { code: -1, message: "no permission", statusCode: 403 } });
    await expect(unggahLewatKlien(klien, cfgUnggah, ALAMAT, ARGS, ["c1"]))
      .rejects.toThrow(/uploadObject gagal.*-1.*no permission/);
  });

  it("melempar ketika transaksi createObject gagal dieksekusi", async () => {
    const klien = klienPalsu({ txCode: 11 });
    await expect(unggahLewatKlien(klien, cfgUnggah, ALAMAT, ARGS, ["c1"]))
      .rejects.toThrow(/createObject gagal.*11/);
  });

  // Transaksi yang gagal tetap membawa transactionHash. Meneruskannya ke
  // langkah unggah berarti mengunggah byte dengan hash transaksi yang gagal.
  it("tidak melanjutkan ke langkah unggah ketika transaksi gagal", async () => {
    const jejak = { unggahDipanggil: false };
    const klien = klienPalsu({ txCode: 11, jejak });
    await expect(unggahLewatKlien(klien, cfgUnggah, ALAMAT, ARGS, ["c1"])).rejects.toThrow();
    expect(jejak.unggahDipanggil).toBe(false);
  });
});
