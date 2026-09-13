import { isAddress, type Address } from "viem";
import { verifikasiRequest } from "@nearly/shared";
import type { PesanStore } from "./ports";

export const HEADER_WHO = "x-nearly-who";
export const HEADER_TS = "x-nearly-ts";
export const HEADER_TANDA = "x-nearly-tanda";
export const JENDELA_AUTH_DETIK = 300;

export type RequestPesan = {
  method: string;
  /** Persis seperti yang ditandatangani HP: path + query string, tanpa host. */
  pathDenganQuery: string;
  /** Badan mentah sebagai teks; "" untuk GET. */
  badan: string;
  header: (nama: string) => string | undefined;
};

/**
 * Autentikasi request pesan (spec 4c §5.4). Header, bukan query string, supaya
 * tanda tangan tidak masuk log URL.
 *
 * Mengembalikan alamat pemanggil huruf kecil, atau null untuk SEMUA bentuk
 * penolakan — header hilang, `ts` di luar jendela, kunci tak terdaftar, tanda
 * tangan salah maupun cacat. Penolakan tidak dibedakan supaya respons tidak
 * memberi tahu penyerang mengapa ia ditolak.
 *
 * `ambilKunci` sengaja TIDAK dibungkus: store yang mati harus jadi 500.
 * `verifikasiRequest` sendiri total — tidak pernah melempar (packages/shared).
 */
export async function pemanggilPesan(
  r: RequestPesan,
  deps: { pesan: Pick<PesanStore, "ambilKunci">; nowMs: () => number },
): Promise<Address | null> {
  const who = r.header(HEADER_WHO);
  const ts = r.header(HEADER_TS);
  const tanda = r.header(HEADER_TANDA);
  if (!who || !ts || !tanda) return null;
  if (!isAddress(who, { strict: false })) return null;
  if (!/^\d{1,12}$/.test(ts)) return null;
  const detik = Number(ts);
  if (Math.abs(deps.nowMs() / 1000 - detik) > JENDELA_AUTH_DETIK) return null;

  const kunci = await deps.pesan.ambilKunci(who.toLowerCase() as Address);
  if (!kunci) return null;

  const sah = verifikasiRequest({
    method: r.method, pathDenganQuery: r.pathDenganQuery, badan: r.badan, ts: detik, who, tanda,
  }, kunci.kunciTanda);
  return sah ? (who.toLowerCase() as Address) : null;
}
