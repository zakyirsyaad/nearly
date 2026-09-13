import type { Hex } from "viem";
import { tandaRequest } from "@nearly/shared";
import { req } from "../http";
import type { SesiPesan } from "./sesi";

export type BarisPesanApi = {
  id: string; pengirim: string; penerima: string; ciphertext: string; nonce: Hex;
  createdAtMs: number; dibacaAtMs: number | null;
};

export type RingkasanPercakapanApi = {
  lawan: string; displayName: string; tier: number; belumDibaca: number; terakhir: BarisPesanApi;
};

export type KunciLawan = { kunciEnkripsi: Hex; kunciTanda: Hex };

/**
 * Request pesan terautentikasi (spec 4c §5.4). `path` HARUS persis path +
 * query yang dilihat server — ia masuk ke tanda tangan. Badan diserialisasi
 * SATU kali dan string yang sama yang dikirim dan di-hash.
 */
export function reqPesan<T>(
  sesi: SesiPesan, method: "GET" | "POST", path: string, body?: unknown,
): Promise<T> {
  const badan = body === undefined ? "" : JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000);
  const tanda = tandaRequest(sesi.kunci.privTanda, {
    method, pathDenganQuery: path, badan, ts, who: sesi.address,
  });
  return req<T>(path, {
    method,
    headers: {
      ...(badan ? { "content-type": "application/json" } : {}),
      "x-nearly-who": sesi.address,
      "x-nearly-ts": String(ts),
      "x-nearly-tanda": tanda,
    },
    body: badan || undefined,
  });
}

export const getKunciLawan = (sesi: SesiPesan, lawan: string) =>
  reqPesan<KunciLawan>(sesi, "GET", `/pesan/kunci/${lawan}`);

export const postPesan = (
  sesi: SesiPesan, b: { id: string; penerima: string; ciphertext: string; nonce: Hex },
) => reqPesan<{ ok: true }>(sesi, "POST", "/pesan", b);

export const getPercakapan = (sesi: SesiPesan) =>
  reqPesan<{ percakapan: RingkasanPercakapanApi[] }>(sesi, "GET", "/pesan/percakapan");

export function getRiwayat(sesi: SesiPesan, lawan: string, sebelumMs?: number) {
  const q = new URLSearchParams({ limit: "50" });
  if (sebelumMs !== undefined) q.set("sebelum", String(sebelumMs));
  return reqPesan<{ pesan: BarisPesanApi[] }>(sesi, "GET", `/pesan/dengan/${lawan}?${q.toString()}`);
}

export const postDibaca = (sesi: SesiPesan, lawan: string, sampaiMs: number) =>
  reqPesan<{ ok: true }>(sesi, "POST", `/pesan/dengan/${lawan}/dibaca`, { sampaiMs });

export const getBelumDibaca = (sesi: SesiPesan) =>
  reqPesan<{ total: number }>(sesi, "GET", "/pesan/belum-dibaca");

export const postTokenPush = (sesi: SesiPesan, token: string) =>
  reqPesan<{ ok: true }>(sesi, "POST", "/pesan/token-push", { token });
