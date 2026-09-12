import type { Address, Hex } from "viem";
import { recoverBlokirSigner } from "@nearly/shared";
import type { BarisBlokir, BlokirDeps } from "./ports";
import { pulihkanTandaTangan } from "./pulihkan-tanda-tangan";

export type BlokirFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "blokir_diri"; httpStatus: 400 };

export type BlokirResult<T> = { ok: true; value: T } | { ok: false; failure: BlokirFailure };

const fail = (failure: BlokirFailure): { ok: false; failure: BlokirFailure } =>
  ({ ok: false, failure });

const samaAlamat = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const sudahLewat = (deps: BlokirDeps, expiresAt: bigint) =>
  deps.nowMs() > Number(expiresAt) * 1000;

export type SetBlokirInput = {
  target: Address; who: Address; blokir: boolean; expiresAt: bigint; sig: Hex;
};

export async function setBlokir(
  input: SetBlokirInput, deps: BlokirDeps,
): Promise<BlokirResult<void>> {
  if (sudahLewat(deps, input.expiresAt)) return fail({ code: "expired", httpStatus: 410 });

  /**
   * Memblokir diri sendiri ditolak DI SINI dan hanya di sini (spec §7.1).
   * Skema Zod sengaja menerimanya; kalau ikut menolak, pemeriksaan ini tidak
   * pernah terjangkau lewat rute dan membusuk jadi kode mati. CHECK di basis
   * data adalah lapis terakhir untuk penulisan di luar jalur rute, bukan
   * pengganti pemeriksaan ini.
   */
  if (samaAlamat(input.target, input.who)) {
    return fail({ code: "blokir_diri", httpStatus: 400 });
  }

  const signer = await pulihkanTandaTangan(() => recoverBlokirSigner(
    {
      target: input.target, who: input.who,
      blokir: input.blokir, expiresAt: input.expiresAt,
    },
    input.sig,
    deps.verifyingContract,
  ));
  if (signer === null || !samaAlamat(signer, input.who)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  await deps.blokir.setBlokir(input.target, input.who, input.blokir);
  return { ok: true, value: undefined };
}

/**
 * Daftar blokir. TIDAK mengembalikan `BlokirResult` karena bukti bacanya
 * diverifikasi di rute (Task 7) — polanya sama dengan `daftarKecocokan` di
 * Fase 3c, dan alasannya sama: bukti baca datang lewat query string, bukan
 * badan permintaan, jadi rutelah yang memegang bentuknya.
 */
export async function daftarBlokir(
  who: Address, deps: BlokirDeps,
): Promise<{ blokir: BarisBlokir[] }> {
  return { blokir: await deps.blokir.diblokirOleh(who) };
}
