import type { Address, Hex } from "viem";
import { recoverDaftarKunciPesanSigner } from "@nearly/shared";
import type { BarisPesan, KunciPesanTerdaftar, PesanDeps } from "./ports";
import { pulihkanTandaTangan } from "./pulihkan-tanda-tangan";

export const BATAS_LAJU = 30;
export const JENDELA_LAJU_MS = 60_000;
/**
 * Daftar percakapan dibangun dari paling banyak sekian pesan terbaru. Lawan
 * bicara yang pesan terakhirnya lebih tua dari jendela ini tidak muncul di
 * daftar sampai ada pesan baru — batas yang diterima untuk 4c, dicatat di
 * rencana, bukan kebetulan.
 */
export const JENDELA_PERCAKAPAN = 500;
export const MAKS_HALAMAN_RIWAYAT = 50;

export type PesanFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "pesan_diri"; httpStatus: 400 }
  | { code: "tidak_terhubung"; httpStatus: 403 }
  | { code: "terblokir"; httpStatus: 403 }
  | { code: "belum_siap"; httpStatus: 409 }
  | { code: "terlalu_cepat"; httpStatus: 429 };

export type PesanResult<T> = { ok: true; value: T } | { ok: false; failure: PesanFailure };

const fail = (failure: PesanFailure): { ok: false; failure: PesanFailure } => ({ ok: false, failure });
const kecil = (a: string) => a.toLowerCase() as Address;
const samaAlamat = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export type DaftarKunciInput = {
  who: Address; kunciEnkripsi: Hex; kunciTanda: Hex; expiresAt: bigint; sig: Hex;
};

/** Spec 4c §6. Satu-satunya jalur yang mengikat kunci publik pesan ke dompet. */
export async function daftarKunci(input: DaftarKunciInput, deps: PesanDeps): Promise<PesanResult<void>> {
  if (deps.nowMs() > Number(input.expiresAt) * 1000) return fail({ code: "expired", httpStatus: 410 });

  // recoverDaftarKunciPesanSigner dan TIDAK PERNAH yang lain — kunci yang
  // didaftarkan atas nama orang lain membuat pesan untuk dia terbaca penyerang.
  const signer = await pulihkanTandaTangan(() => recoverDaftarKunciPesanSigner(
    {
      who: input.who, kunciEnkripsi: input.kunciEnkripsi,
      kunciTanda: input.kunciTanda, expiresAt: input.expiresAt,
    },
    input.sig,
    deps.verifyingContract,
  ));
  if (signer === null || !samaAlamat(signer, input.who)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  await deps.pesan.simpanKunci(kecil(input.who), {
    kunciEnkripsi: kecil(input.kunciEnkripsi) as Hex, kunciTanda: kecil(input.kunciTanda) as Hex,
  });
  return { ok: true, value: undefined };
}

/**
 * Spec 4c §4 butir (1)(2). Urutannya disengaja: koneksi dulu, baru blokir, dan
 * keberadaan kunci SESUDAH keduanya (di pemanggil). Bukan koneksi tidak boleh
 * bisa membedakan "dia belum memakai pesan" dari "kalian tidak terhubung".
 */
export async function gerbangPasangan(a: Address, b: Address, deps: PesanDeps): Promise<PesanFailure | null> {
  if (samaAlamat(a, b)) return { code: "pesan_diri", httpStatus: 400 };
  if (!(await deps.store.areConnected(kecil(a), kecil(b)))) {
    return { code: "tidak_terhubung", httpStatus: 403 };
  }
  // Pemeriksaan pasangan tepat dua arah (4a I1), bukan memuat seluruh himpunan.
  const [ab, ba] = await Promise.all([
    deps.blokir.adaBlokir(kecil(a), kecil(b)),
    deps.blokir.adaBlokir(kecil(b), kecil(a)),
  ]);
  if (ab || ba) return { code: "terblokir", httpStatus: 403 };
  return null;
}

export async function ambilKunciLawan(
  pemanggil: Address, lawan: Address, deps: PesanDeps,
): Promise<PesanResult<KunciPesanTerdaftar>> {
  const g = await gerbangPasangan(pemanggil, lawan, deps);
  if (g) return fail(g);
  const kunci = await deps.pesan.ambilKunci(kecil(lawan));
  if (!kunci) return fail({ code: "belum_siap", httpStatus: 409 });
  return { ok: true, value: kunci };
}

export type KirimInput = { id: string; penerima: Address; ciphertext: string; nonce: Hex };

export async function kirimPesan(
  pemanggil: Address, input: KirimInput, deps: PesanDeps,
): Promise<PesanResult<{ baru: boolean }>> {
  const g = await gerbangPasangan(pemanggil, input.penerima, deps);
  if (g) return fail(g);
  if (!(await deps.pesan.ambilKunci(kecil(input.penerima)))) {
    return fail({ code: "belum_siap", httpStatus: 409 });
  }

  const terkirim = await deps.pesan.hitungTerkirimSejak(kecil(pemanggil), deps.nowMs() - JENDELA_LAJU_MS);
  if (terkirim >= BATAS_LAJU) return fail({ code: "terlalu_cepat", httpStatus: 429 });

  const hasil = await deps.pesan.simpanPesan({
    id: input.id.toLowerCase(),
    pengirim: kecil(pemanggil),
    penerima: kecil(input.penerima),
    ciphertext: input.ciphertext,
    nonce: kecil(input.nonce) as Hex,
  });
  return { ok: true, value: { baru: hasil === "baru" } };
}

/**
 * Murni. `baris` terbaru dulu; pesan pertama yang terlihat per lawan adalah
 * pesan terakhirnya.
 */
export function kelompokkanPercakapan(
  baris: BarisPesan[], pemanggil: Address, terblokir: ReadonlySet<string>,
): { lawan: Address; terakhir: BarisPesan }[] {
  const aku = pemanggil.toLowerCase();
  const terlihat = new Map<string, BarisPesan>();
  for (const b of baris) {
    const lawan = b.pengirim.toLowerCase() === aku ? b.penerima.toLowerCase() : b.pengirim.toLowerCase();
    if (lawan === aku || terblokir.has(lawan) || terlihat.has(lawan)) continue;
    terlihat.set(lawan, b);
  }
  return [...terlihat.entries()]
    .map(([lawan, terakhir]) => ({ lawan: lawan as Address, terakhir }))
    .sort((x, y) => y.terakhir.createdAtMs - x.terakhir.createdAtMs);
}

export type RingkasanPercakapan = {
  lawan: Address; displayName: string; tier: number; belumDibaca: number; terakhir: BarisPesan;
};

/**
 * Koneksi TIDAK diperiksa ulang per lawan: baris `pesan` hanya tercipta lewat
 * gerbang yang memeriksa koneksi, dan koneksi Nearly permanen. Yang disaring
 * ulang hanya blokir — satu `himpunanUntuk`, bukan N kueri.
 */
export async function daftarPercakapan(pemanggil: Address, deps: PesanDeps): Promise<RingkasanPercakapan[]> {
  const aku = kecil(pemanggil);
  const [baris, terblokir, belum] = await Promise.all([
    deps.pesan.pesanTerbaruUntuk(aku, JENDELA_PERCAKAPAN),
    deps.blokir.himpunanUntuk(aku),
    deps.pesan.belumDibacaPerPengirim(aku),
  ]);
  const grup = kelompokkanPercakapan(baris, aku, terblokir);
  if (grup.length === 0) return [];
  const profil = await deps.meet.profilRingkas(grup.map((g) => g.lawan));
  return grup.map((g) => ({
    ...g,
    displayName: profil.get(g.lawan)?.displayName ?? "",
    tier: profil.get(g.lawan)?.tier ?? 0,
    belumDibaca: belum.get(g.lawan) ?? 0,
  }));
}

export async function riwayatPercakapan(
  pemanggil: Address, lawan: Address, sebelumMs: number | null, batas: number, deps: PesanDeps,
): Promise<PesanResult<BarisPesan[]>> {
  const g = await gerbangPasangan(pemanggil, lawan, deps);
  if (g) return fail(g);
  const jepit = Math.max(1, Math.min(MAKS_HALAMAN_RIWAYAT, Math.floor(batas)));
  return { ok: true, value: await deps.pesan.riwayat(kecil(pemanggil), kecil(lawan), sebelumMs, jepit) };
}

export async function tandaiPercakapanDibaca(
  pemanggil: Address, lawan: Address, sampaiMs: number, deps: PesanDeps,
): Promise<PesanResult<void>> {
  const g = await gerbangPasangan(pemanggil, lawan, deps);
  if (g) return fail(g);
  await deps.pesan.tandaiDibaca(kecil(pemanggil), kecil(lawan), sampaiMs);
  return { ok: true, value: undefined };
}

export async function totalBelumDibaca(pemanggil: Address, deps: PesanDeps): Promise<number> {
  const [belum, terblokir] = await Promise.all([
    deps.pesan.belumDibacaPerPengirim(kecil(pemanggil)),
    deps.blokir.himpunanUntuk(kecil(pemanggil)),
  ]);
  let total = 0;
  for (const [pengirim, n] of belum) if (!terblokir.has(pengirim)) total += n;
  return total;
}

export async function simpanTokenPush(pemanggil: Address, token: string, deps: PesanDeps): Promise<void> {
  await deps.pesan.simpanTokenPush(kecil(pemanggil), token);
}
