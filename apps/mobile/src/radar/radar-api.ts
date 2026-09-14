import type { Address, Hex } from "viem";
import { aturProfilTypedData, type Visibilitas } from "@nearly/shared";
import { CONFIG } from "../config";
import { postJson } from "../http";
import type { PenandaSigner } from "../meet-api";
import { reqPesan } from "../pesan/pesan-api";
import type { SesiPesan } from "../pesan/sesi";

export type JawabanDetakApi =
  | { hadir: true }
  | { hadir: false; alasan: "tersembunyi" | "di_luar_area" };

export type KartuRadarApi = {
  address: string;
  displayName: string;
  tierLabel: string;
  pernahBertemu: boolean;
  salingInginBertemu: boolean;
};

const UMUR_DETIK = 300;

export const postDetak = (sesi: SesiPesan, eventId: string, cell: string) =>
  reqPesan<JawabanDetakApi>(sesi, "POST", `/radar/${eventId}/detak`, { cell });

export const getRadar = (sesi: SesiPesan, eventId: string) =>
  reqPesan<{ kartu: KartuRadarApi[]; jumlah: number }>(sesi, "GET", `/radar/${eventId}`);

export const getProfilSaya = (sesi: SesiPesan) =>
  reqPesan<{ displayName: string; visibilitas: Visibilitas }>(sesi, "GET", "/profil/saya");

export async function simpanProfil(
  signer: PenandaSigner,
  profil: { displayName: string; visibilitas: Visibilitas },
): Promise<{ ok: true }> {
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + UMUR_DETIK);
  const msg = {
    who: signer.address as Address,
    displayName: profil.displayName,
    visibilitas: profil.visibilitas,
    expiresAt,
  };
  const sig: Hex = await signer.signTypedData(
    aturProfilTypedData(msg, CONFIG.verifyingContract) as never,
  );
  return postJson<{ ok: true }>("/profil", {
    ...msg,
    expiresAt: expiresAt.toString(),
    sig,
  });
}
