import type { Address, Hex } from "viem";
import { recoverInginBertemuSigner, recoverTandaiDilihatSigner } from "@nearly/shared";
import { hitungBaru, kecocokanDari } from "./meet-rank";
import type { MeetDeps } from "./ports";

export type MeetFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "tandai_diri"; httpStatus: 400 };

export type MeetResult<T> = { ok: true; value: T } | { ok: false; failure: MeetFailure };

const fail = (failure: MeetFailure): { ok: false; failure: MeetFailure } =>
  ({ ok: false, failure });

const sudahLewat = (deps: MeetDeps, expiresAt: bigint) =>
  deps.nowMs() > Number(expiresAt) * 1000;

const samaAlamat = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export type SetTandaInput = {
  target: Address; who: Address; ingin: boolean; expiresAt: bigint; sig: Hex;
};

export async function setTanda(
  input: SetTandaInput, deps: MeetDeps,
): Promise<MeetResult<void>> {
  if (sudahLewat(deps, input.expiresAt)) return fail({ code: "expired", httpStatus: 410 });

  // Spec §13.7: ditolak DI GERBANG, bukan hanya oleh check di database.
  // Skema Zod sengaja menerimanya supaya pemeriksaan ini benar-benar
  // terjangkau lewat rute dan tidak membusuk sebagai kode mati.
  if (samaAlamat(input.target, input.who)) {
    return fail({ code: "tandai_diri", httpStatus: 400 });
  }

  // `ingin` dari MASUKAN, bukan nilai karangan server. Ini yang membuat satu
  // tanda tangan tidak bisa dipakai dua arah.
  //
  // recoverInginBertemuSigner, BUKAN recoverLihatProfilSigner: yang kedua
  // adalah bukti BACA yang berkeliaran di query string, dan kalau ia sah di
  // sini, siapa pun yang menangkapnya bisa menandai orang atas nama korban —
  // lalu menandai memicu pengungkapan identitas. Kelas kesalahan Ruling 23.
  //
  // Dibungkus try/catch: byte `v` yang cacat bentuknya (tapi lolos regex
  // panjang skema Zod) membuat viem melempar synchronously, bukan
  // mengembalikan alamat yang salah. Tanpa ini badan permintaan seperti
  // sig 0x99...99 membuat rute berakhir 500, bukan 401 seperti kegagalan
  // tanda tangan lainnya.
  let signer: Address;
  try {
    signer = await recoverInginBertemuSigner(
      {
        target: input.target, who: input.who,
        ingin: input.ingin, expiresAt: input.expiresAt,
      },
      input.sig,
      deps.verifyingContract,
    );
  } catch {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }
  if (!samaAlamat(signer, input.who)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  await deps.meet.setTanda(input.target, input.who, input.ingin);
  return { ok: true, value: undefined };
}

export type TandaiDilihatInput = { who: Address; expiresAt: bigint; sig: Hex };

export async function tandaiDilihat(
  input: TandaiDilihatInput, deps: MeetDeps,
): Promise<MeetResult<void>> {
  if (sudahLewat(deps, input.expiresAt)) return fail({ code: "expired", httpStatus: 410 });

  // Sama seperti di setTanda: byte `v` yang cacat bentuknya membuat viem
  // melempar, bukan mengembalikan alamat yang salah.
  let signer: Address;
  try {
    signer = await recoverTandaiDilihatSigner(
      { who: input.who, expiresAt: input.expiresAt },
      input.sig,
      deps.verifyingContract,
    );
  } catch {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }
  if (!samaAlamat(signer, input.who)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  // Waktu dari server, bukan jam klien: jam perangkat bisa digeser ke masa
  // depan, dan itu akan membungkam lencana selamanya.
  await deps.meet.setCocokDilihat(input.who, deps.nowMs());
  return { ok: true, value: undefined };
}

export type BarisKecocokan = {
  address: Address; displayName: string; tier: number; sejakMs: number;
};

/**
 * TIDAK mengembalikan MeetResult: pemanggilnya (rute) sudah membuktikan
 * `who` lebih dulu, jadi tidak ada kegagalan yang bisa terjadi di sini.
 */
export async function daftarKecocokan(
  who: Address, deps: MeetDeps,
): Promise<{ kecocokan: BarisKecocokan[]; baru: number }> {
  const [oleh, ke, dilihat] = await Promise.all([
    deps.meet.tandaOleh(who),
    deps.meet.tandaKe(who),
    deps.meet.cocokDilihatAtMs(who),
  ]);

  const cocok = kecocokanDari(oleh, ke);
  const profil = await deps.meet.profilRingkas(cocok.map((k) => k.address));

  return {
    kecocokan: cocok.map((k) => {
      const p = profil.get(k.address.toLowerCase());
      return {
        address: k.address,
        displayName: p?.displayName ?? "",
        tier: p?.tier ?? 0,
        sejakMs: k.sejakMs,
      };
    }),
    baru: hitungBaru(cocok, dilihat),
  };
}
