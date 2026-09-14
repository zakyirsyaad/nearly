import type { Address, Hex } from "viem";
import { periksaNamaTampilan, recoverAturProfilSigner, type Visibilitas } from "@nearly/shared";
import type { ProfilDeps, ProfilSaya } from "./ports";
import { pulihkanTandaTangan } from "./pulihkan-tanda-tangan";

/** `expiresAt` paling jauh satu jam ke depan (spec 4b+5 §7.2 langkah 2). */
export const MAKS_UMUR_ATUR_PROFIL_DETIK = 60 * 60;

export type ProfilFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "nama_tidak_sah"; httpStatus: 400 };

export type ProfilResult<T> = { ok: true; value: T } | { ok: false; failure: ProfilFailure };

const fail = (failure: ProfilFailure): { ok: false; failure: ProfilFailure } => ({ ok: false, failure });

export type AturProfilInput = {
  who: Address; displayName: string; visibilitas: Visibilitas; expiresAt: bigint; sig: Hex;
};

/**
 * `POST /profil`, langkah 2–5 (spec 4b+5 §7.2). Langkah 1 (badan) milik rute.
 *
 * Nama diperiksa SETELAH tanda tangan: tanpa tanda tangan sah, tidak ada yang
 * bisa memakai rute ini untuk menguji aturan nama. Yang disimpan adalah nama
 * setelah trim, sedangkan yang ditandatangani adalah nama apa adanya — HP
 * mengirim nama yang sudah di-trim, jadi keduanya sama pada jalur normal.
 */
export async function aturProfil(input: AturProfilInput, deps: ProfilDeps): Promise<ProfilResult<void>> {
  const nowMs = deps.nowMs();
  const exp = Number(input.expiresAt);
  if (nowMs > exp * 1000 || exp > Math.floor(nowMs / 1000) + MAKS_UMUR_ATUR_PROFIL_DETIK) {
    return fail({ code: "expired", httpStatus: 410 });
  }

  // Lewat pulihkanTandaTangan: byte `v` cacat membuat viem melempar → 401, bukan 500.
  const signer = await pulihkanTandaTangan(() => recoverAturProfilSigner(
    { who: input.who, displayName: input.displayName, visibilitas: input.visibilitas, expiresAt: input.expiresAt },
    input.sig,
    deps.verifyingContract,
  ));
  if (signer === null || signer.toLowerCase() !== input.who.toLowerCase()) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  const nama = periksaNamaTampilan(input.displayName);
  if (!nama.ok) return fail({ code: "nama_tidak_sah", httpStatus: 400 });

  // Upsert DULU, baru hapus kehadiran. Urutan terbalik membuka celah: detak
  // yang tiba di antaranya masih membaca `terlihat` dan menulis baris baru.
  await deps.profilSaya.aturProfil(input.who, { displayName: nama.nama, visibilitas: input.visibilitas });
  if (input.visibilitas === "tersembunyi") await deps.radar.hapusSemuaKehadiran(input.who);
  return { ok: true, value: undefined };
}

/** `GET /profil/saya`. Pemanggil sudah terautentikasi sesi (R1). Hanya dua kunci ini. */
export async function ambilProfilSaya(pemanggil: Address, deps: ProfilDeps): Promise<ProfilSaya> {
  const p = await deps.profilSaya.profilSaya(pemanggil);
  return { displayName: p.displayName, visibilitas: p.visibilitas };
}
