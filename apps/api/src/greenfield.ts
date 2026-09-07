// Adapter BNB Greenfield. Diverifikasi manual saat deploy (Task 15), bukan
// oleh tes — seluruh tes memakai fake di balik GreenfieldPort.
//
// Versi SDK DISEMATKAN di package.json dengan sengaja: SDK ini bergerak
// cepat, dan versi mengambang membuat kegagalan muncul tanpa perubahan kode
// apa pun di sisi kita.
//
// Terpasang: @bnb-chain/greenfield-js-sdk@2.2.2, @bnb-chain/reed-solomon@1.1.4.
// Semua nama ekspor di brief (Client, RedundancyType, VisibilityType,
// bytesFromBase64, Long, NodeAdapterReedSolomon) terverifikasi cocok persis
// dengan paket yang benar-benar terpasang — tidak ada penyesuaian nama.
import {
  Client, RedundancyType, VisibilityType, bytesFromBase64, Long,
} from "@bnb-chain/greenfield-js-sdk";
import { NodeAdapterReedSolomon } from "@bnb-chain/reed-solomon/node.adapter";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import type { GreenfieldPort } from "./ports";

export type GreenfieldConfig = {
  rpcUrl: string;
  chainId: string;
  bucket: string;
  spEndpoint: string;
  privateKey: Hex;
};

export function createGreenfield(cfg: GreenfieldConfig): GreenfieldPort {
  // Divalidasi saat pembuatan, bukan saat unggahan pertama: salah konfigurasi
  // harus ketahuan waktu API menyala, bukan berjam-jam kemudian ketika
  // seseorang mengunggah gambar pertamanya.
  if (!cfg.bucket) throw new Error("env GREENFIELD_BUCKET wajib diisi");
  if (!cfg.spEndpoint) throw new Error("env GREENFIELD_SP_ENDPOINT wajib diisi");
  if (!cfg.rpcUrl) throw new Error("env GREENFIELD_RPC wajib diisi");

  const alamat = privateKeyToAccount(cfg.privateKey).address;

  // Klien dibuat malas: Client.create bisa menyentuh jaringan, dan API harus
  // tetap menyala saat Greenfield mati (spec §8.2).
  let klien: ReturnType<typeof Client.create> | null = null;
  const dapatkanKlien = () => {
    klien ??= Client.create(cfg.rpcUrl, cfg.chainId);
    return klien;
  };

  return {
    bucket: cfg.bucket,
    spEndpoint: cfg.spEndpoint,

    async upload({ objectName, mime, bytes }) {
      const client = dapatkanKlien();

      // Langkah 1 — checksum Reed-Solomon. Wajib ada SEBELUM createObject:
      // rantai menyimpan checksum ini, dan storage provider menolak byte
      // yang tidak cocok.
      //
      // SENGAJA memakai encodeInSubWorker, BUKAN encodeInWorker, meski
      // encodeInWorker terlihat lebih "eksplisit" (menerima path file
      // sendiri). encodeInWorker ditandai @deprecated di SDK, dan argumen
      // pertamanya harus berupa path ke berkas worker yang membuat
      // bootstrap-nya sendiri lewat `parentPort` saat `isMainThread` false
      // (lihat dist/node.adapter.js). File ini (greenfield.ts) tidak punya
      // bootstrap semacam itu, dan apps/api dijalankan sebagai .ts mentah
      // lewat tsx tanpa loader worker — jadi memakai __filename di sini akan
      // memuat worker yang tidak pernah mengirim balik hasilnya (checksum
      // kosong/salah, tanpa error yang kelihatan). encodeInSubWorker tidak
      // punya masalah ini: ia memakai sub-worker.js yang sudah dibundel di
      // paket (dist/sub-worker.js), jadi tidak bergantung pada berkas
      // pemanggil sama sekali.
      const rs = new NodeAdapterReedSolomon();
      const checksums = await rs.encodeInSubWorker(bytes);

      // Langkah 2 — createObject: transaksi on-chain DI GREENFIELD, bukan
      // BSC. Gasnya dibayar dari saldo akun ini di chain Greenfield.
      const tx = await client.object.createObject({
        bucketName: cfg.bucket,
        objectName,
        creator: alamat,
        visibility: VisibilityType.VISIBILITY_TYPE_PUBLIC_READ,
        contentType: mime,
        redundancyType: RedundancyType.REDUNDANCY_EC_TYPE,
        payloadSize: Long.fromInt(bytes.byteLength),
        expectChecksums: checksums.map((c: string) => bytesFromBase64(c)),
      });
      const sim = await tx.simulate({ denom: "BNB" });
      const res = await tx.broadcast({
        denom: "BNB",
        gasLimit: Number(sim?.gasLimit),
        gasPrice: sim?.gasPrice || "5000000000",
        payer: alamat,
        granter: "",
        privateKey: cfg.privateKey,
      });

      // Langkah 3 — byte-nya sendiri, lewat HTTP ke storage provider.
      await client.object.uploadObject(
        {
          bucketName: cfg.bucket,
          objectName,
          body: { name: objectName, type: mime, size: bytes.byteLength, content: Buffer.from(bytes) },
          txnHash: res.transactionHash,
        },
        { type: "ECDSA", privateKey: cfg.privateKey },
      );
    },
  };
}
