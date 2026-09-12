import type { Address, Hex } from "viem";
import { recoverInginBertemuSigner, recoverTandaiDilihatSigner } from "@nearly/shared";
import { hitungBaru, kecocokanDari } from "./meet-rank";
import type { MeetDeps } from "./ports";
import { pulihkanTandaTangan } from "./pulihkan-tanda-tangan";

export type MeetFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "tandai_diri"; httpStatus: 400 }
  | { code: "terblokir"; httpStatus: 403 };

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
  // Lewat pulihkanTandaTangan: byte `v` yang cacat bentuknya lolos regex
  // panjang skema Zod lalu membuat viem melempar, bukan mengembalikan alamat
  // yang salah. Lihat alasan lengkapnya di berkas helper-nya.
  const signer = await pulihkanTandaTangan(() => recoverInginBertemuSigner(
    {
      target: input.target, who: input.who,
      ingin: input.ingin, expiresAt: input.expiresAt,
    },
    input.sig,
    deps.verifyingContract,
  ));
  if (signer === null || !samaAlamat(signer, input.who)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  // Selama terblokir, keduanya tidak bisa saling MENANDAI (spec §5.2) — tapi
  // MENCABUT tetap boleh: menolaknya akan memaksa pemblokir membuka blokir
  // hanya untuk menghapus tanda lamanya sendiri, padahal membuka blokir justru
  // memulihkan PERSIS tanda yang ingin dihapusnya. Karena itu pemeriksaan ini
  // hanya menyala saat `input.ingin === true`.
  //
  // Diperiksa SETELAH tanda tangan supaya tidak menjadi orakel: tanpa tanda
  // tangan yang sah, tidak ada yang bisa memancing keberadaan blokir.
  if (input.ingin) {
    const terblokir = await deps.blokir.himpunanUntuk(input.who)
      .then((s) => s.has(input.target.toLowerCase()));
    if (terblokir) return fail({ code: "terblokir", httpStatus: 403 });
  }

  await deps.meet.setTanda(input.target, input.who, input.ingin);
  return { ok: true, value: undefined };
}

export type TandaiDilihatInput = { who: Address; expiresAt: bigint; sig: Hex };

export async function tandaiDilihat(
  input: TandaiDilihatInput, deps: MeetDeps,
): Promise<MeetResult<void>> {
  if (sudahLewat(deps, input.expiresAt)) return fail({ code: "expired", httpStatus: 410 });

  // Sama seperti di setTanda.
  const signer = await pulihkanTandaTangan(() => recoverTandaiDilihatSigner(
    { who: input.who, expiresAt: input.expiresAt },
    input.sig,
    deps.verifyingContract,
  ));
  if (signer === null || !samaAlamat(signer, input.who)) {
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
  // Satu pembacaan himpunan blokir per permintaan, dipakai KEDUA arah di
  // bawah — bukan satu panggilan per metode.
  const kecuali = [...await deps.blokir.himpunanUntuk(who)];
  const [oleh, ke, dilihat] = await Promise.all([
    deps.meet.tandaOleh(who, kecuali),
    deps.meet.tandaKe(who, kecuali),
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
