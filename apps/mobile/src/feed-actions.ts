import type { Address, Hex } from "viem";
import { hapusPostTypedData, laporPostTypedData } from "@nearly/shared";
import { postDelete, postReport } from "./feed-api";

/**
 * Aksi kartu feed yang butuh tanda tangan, dipisah dari layarnya supaya bisa
 * diuji tanpa React Native: layar hanya memanggil fungsi-fungsi ini.
 */
export type PenandaTanganFeed = {
  address: Address;
  signTypedData(data: unknown): Promise<Hex>;
};

/** Jendela berlaku tanda tangan, DETIK — sama dengan tombol suka. */
export const MASA_BERLAKU_DETIK = 300;

/**
 * Alasan baku laporan dari kartu feed. Skema server menuntut `reason`
 * minimal 10 karakter, dan `reason` ikut ditandatangani tipe `LaporPost` —
 * jadi teks ini harus SAMA persis antara yang ditandatangani dan yang
 * dikirim, kalau tidak servernya menolak `bad_signature`.
 */
export const ALASAN_LAPOR = "Melanggar aturan komunitas Nearly.";

/**
 * Tombol hapus hanya boleh muncul untuk unggahan penonton sendiri (spec
 * §10.2). Case-insensitive: alamat bisa datang dalam campuran huruf, dan
 * server pun membandingkannya begitu.
 */
export function bisaHapus(author: string, viewer: string): boolean {
  return author.toLowerCase() === viewer.toLowerCase();
}

const kedaluwarsa = (nowMs: number) =>
  BigInt(Math.floor(nowMs / 1000) + MASA_BERLAKU_DETIK);

export async function laporUnggahan(
  signer: PenandaTanganFeed,
  postId: Hex,
  verifyingContract: Address,
  nowMs: number = Date.now(),
): Promise<void> {
  const expiresAt = kedaluwarsa(nowMs);
  const pesan = {
    postId, reporter: signer.address, reason: ALASAN_LAPOR, expiresAt,
  };
  const sig = await signer.signTypedData(laporPostTypedData(pesan, verifyingContract));
  await postReport(postId, {
    postId,
    reporter: signer.address,
    reason: ALASAN_LAPOR,
    expiresAt: expiresAt.toString(),
    sig,
  });
}

/**
 * Memakai `HapusPost`, BUKAN `Post`: tipe yang berbeda menghasilkan digest
 * yang berbeda, dan itulah satu-satunya hal yang mencegah tanda tangan untuk
 * memposting dipakai ulang sebagai perintah menghapus (spec §5).
 */
export async function hapusUnggahan(
  signer: PenandaTanganFeed,
  postId: Hex,
  verifyingContract: Address,
  nowMs: number = Date.now(),
): Promise<void> {
  const expiresAt = kedaluwarsa(nowMs);
  const pesan = { postId, author: signer.address, expiresAt };
  const sig = await signer.signTypedData(hapusPostTypedData(pesan, verifyingContract));
  await postDelete(postId, {
    postId, author: signer.address, expiresAt: expiresAt.toString(), sig,
  });
}
