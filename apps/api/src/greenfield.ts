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

/**
 * Bentuk kembalian yang BENAR-BENAR dipakai SDK, dibaca langsung dari
 * node_modules (@bnb-chain/greenfield-js-sdk@2.2.2) — bukan ditebak:
 *
 * - `object.uploadObject` mengembalikan `SpResponse<null>`
 *   (`dist/cjs/types/types/sp/SuccessResponse.d.ts`):
 *   `{ code: number | string; message?: string; statusCode?: number; ... }`.
 *   Implementasinya (`putObject`) MENANGKAP galat HTTP dari storage provider
 *   dan mengembalikannya sebagai `{ code: error.code || -1, message, statusCode }`.
 *   Sukses adalah `{ code: 0, message: "Put object success.", statusCode }`.
 *   Artinya: SP menolak unggahan TIDAK melempar. Kalau nilai kembaliannya
 *   diabaikan, kegagalan hilang tanpa suara.
 *
 * - `tx.broadcast` mengembalikan `DeliverTxResponse` dari @cosmjs/stargate:
 *   `{ code: number; transactionHash: string; rawLog?: string; ... }`, dan
 *   dokumentasi kolomnya menyatakan "transaksi sukses jika dan hanya jika
 *   code 0". Kegagalan CheckTx memang melempar, tapi kegagalan EKSEKUSI
 *   (DeliverTx) kembali sebagai `code` bukan nol — dan `transactionHash`
 *   tetap terisi, jadi langkah unggah berikutnya akan memakai hash
 *   transaksi yang gagal.
 */
type SpHasil = { code: number | string; message?: string; statusCode?: number };
type TxHasil = { code: number; transactionHash: string; rawLog?: string };

/**
 * `code` nol berarti sukses; apa pun selain itu kegagalan. Dilempar, bukan
 * dikembalikan, karena satu-satunya pemanggil `upload` adalah
 * `prosesUnggahGambar` yang menangkap lemparan dan menyetel `image_status`
 * jadi `failed` (spec §8.2 dan §11.4). Tanpa lemparan ini, status `failed`
 * yang menjadi tumpuan spec TIDAK PERNAH terjadi: unggahan ditandai `ready`
 * dengan URL gambar yang tidak pernah ada.
 */
export function pastikanTxSukses(res: TxHasil | null | undefined, langkah: string): TxHasil {
  if (!res) throw new Error(`Greenfield ${langkah} tidak mengembalikan hasil`);
  if (res.code !== 0) {
    throw new Error(
      `Greenfield ${langkah} gagal: code=${res.code}`
      + `${res.rawLog ? ` ${res.rawLog}` : ""}`,
    );
  }
  return res;
}

/** Sama untuk balasan storage provider, yang `code`-nya bisa angka ATAU string. */
export function pastikanSpSukses(res: SpHasil | null | undefined, langkah: string): SpHasil {
  if (!res) throw new Error(`Greenfield ${langkah} tidak mengembalikan hasil`);
  // Dibandingkan sebagai string supaya `0` dan `"0"` sama-sama lolos, dan
  // code non-numerik (SP mengembalikan kode galat berupa teks) tidak
  // diam-diam jadi NaN yang lolos perbandingan.
  if (String(res.code) !== "0") {
    throw new Error(
      `Greenfield ${langkah} gagal: code=${res.code}`
      + `${res.message ? ` ${res.message}` : ""}`
      + `${res.statusCode ? ` (HTTP ${res.statusCode})` : ""}`,
    );
  }
  return res;
}

export type GreenfieldConfig = {
  rpcUrl: string;
  chainId: string;
  bucket: string;
  spEndpoint: string;
  privateKey: Hex;
};

/**
 * Cukup permukaan klien SDK yang dipakai langkah 2 dan 3. Diambil dengan
 * `Pick` dari tipe klien asli, jadi klien sungguhan selalu memenuhi bentuk
 * ini — dan tes bisa memberikan klien palsu tanpa menyentuh jaringan.
 */
export type KlienUnggah = {
  object: Pick<ReturnType<typeof Client.create>["object"], "createObject" | "uploadObject">;
};

/**
 * Langkah 2 dan 3 unggahan, dipisah dari `createGreenfield` supaya jalur
 * penanganan kegagalannya bisa diuji tanpa jaringan maupun worker Reed-Solomon.
 * Checksum diterima jadi, bukan dihitung di sini.
 */
export async function unggahLewatKlien(
  client: KlienUnggah,
  cfg: GreenfieldConfig,
  alamat: string,
  args: { objectName: string; mime: string; bytes: Uint8Array },
  checksums: string[],
): Promise<void> {
  const { objectName, mime, bytes } = args;

  // Langkah 2 — createObject: transaksi on-chain DI GREENFIELD, bukan BSC.
  // Gasnya dibayar dari saldo akun ini di chain Greenfield.
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

  // Diperiksa SEBELUM langkah 3. Kegagalan eksekusi tidak melempar, dan
  // `transactionHash` tetap terisi — meneruskannya ke uploadObject berarti
  // mengunggah byte dengan hash transaksi yang gagal.
  pastikanTxSukses(res, "createObject");

  // Langkah 3 — byte-nya sendiri, lewat HTTP ke storage provider.
  const unggah = await client.object.uploadObject(
    {
      bucketName: cfg.bucket,
      objectName,
      body: { name: objectName, type: mime, size: bytes.byteLength, content: Buffer.from(bytes) },
      txnHash: res.transactionHash,
    },
    { type: "ECDSA", privateKey: cfg.privateKey },
  );

  // SP yang menolak TIDAK melempar — ia mengembalikan code bukan nol.
  // Mengabaikannya berarti unggahan ditandai `ready` dengan URL yang kosong.
  pastikanSpSukses(unggah, "uploadObject");
}

/** Keempat nama env Greenfield, sebagai satu unit. */
export const ENV_GREENFIELD = [
  "GREENFIELD_RPC", "GREENFIELD_CHAIN_ID", "GREENFIELD_BUCKET", "GREENFIELD_SP_ENDPOINT",
] as const;

export type HasilKonfigurasiGreenfield =
  | { mode: "aktif"; cfg: Omit<GreenfieldConfig, "privateKey"> }
  | { mode: "nonaktif" };

/**
 * Memutuskan apakah API menyala DENGAN atau TANPA lampiran gambar.
 *
 * Kenapa ini ada. Sebelumnya keempat env ini wajib saat boot, jadi Greenfield
 * yang tidak dikonfigurasi mematikan SELURUH API — handshake, trust, vouch,
 * event, teks feed, dan meet, yang tidak satu pun menyentuh Greenfield. Itu
 * radius ledakan yang tidak sebanding untuk satu fitur pinggiran, dan ia
 * bertentangan dengan prinsip yang spec 3b §8.2 nyatakan sendiri: "Greenfield
 * mati tidak mematikan feed". Desainnya sudah memperlakukan Greenfield yang
 * tidak tersedia sebagai keadaan normal DI RUNTIME; aturan boot memperlakukan
 * keadaan yang sama sebagai fatal.
 *
 * Yang TIDAK dibuang: gagal-cepat untuk salah konfigurasi. Aturan lama
 * menyamakan dua hal yang berbeda —
 *
 *   kosong semua  → penyebaran yang memang tidak memakai fitur gambar (CI,
 *                   mesin kedua, kontributor baru). Bukan kesalahan.
 *   terisi separuh → salah ketik. Harus ketahuan saat API menyala, bukan
 *                   berjam-jam kemudian saat orang pertama mengunggah gambar.
 *
 * Jadi yang dilempar hanya kasus kedua, dan pesannya menyebut persis mana yang
 * kurang.
 */
export function bacaKonfigurasiGreenfield(
  env: Record<string, string | undefined>,
): HasilKonfigurasiGreenfield {
  const isi = (k: string) => (env[k] ?? "").trim();
  const terisi = ENV_GREENFIELD.filter((k) => isi(k) !== "");

  if (terisi.length === 0) return { mode: "nonaktif" };
  if (terisi.length < ENV_GREENFIELD.length) {
    const kurang = ENV_GREENFIELD.filter((k) => isi(k) === "");
    throw new Error(
      `Konfigurasi Greenfield separuh: ${terisi.join(", ")} terisi, `
      + `tapi ${kurang.join(", ")} kosong. Isi keempatnya, atau kosongkan `
      + `keempatnya untuk menjalankan API tanpa lampiran gambar.`,
    );
  }
  return {
    mode: "aktif",
    cfg: {
      rpcUrl: isi("GREENFIELD_RPC"),
      chainId: isi("GREENFIELD_CHAIN_ID"),
      bucket: isi("GREENFIELD_BUCKET"),
      spEndpoint: isi("GREENFIELD_SP_ENDPOINT"),
    },
  };
}

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

      await unggahLewatKlien(client, cfg, alamat, { objectName, mime, bytes }, checksums);
    },
  };
}
