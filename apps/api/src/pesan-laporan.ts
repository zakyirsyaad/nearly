import type { Address, Hex } from "viem";
import { reasonHashOf, recoverReportSigner, verifikasiAmplop } from "@nearly/shared";
import type { PesanDeps } from "./ports";
import { pulihkanTandaTangan } from "./pulihkan-tanda-tangan";

export type LaporanFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "lapor_diri"; httpStatus: 400 }
  | { code: "tidak_terhubung"; httpStatus: 403 }
  | { code: "bukti_tidak_sah"; httpStatus: 422 };

export type LaporanInput = {
  laporan: {
    reporter: Address; subject: Address; reason: string; evidence?: string;
    expiresAt: bigint; sig: Hex;
  };
  bukti: { pesanId: string; isi: string; dikirimMs: number; tanda: Hex }[];
};

type Hasil = { ok: true; value: { laporanId: number } } | { ok: false; failure: LaporanFailure };

const fail = (failure: LaporanFailure): Hasil => ({ ok: false, failure });
const kecil = (a: string) => a.toLowerCase();

/**
 * Lapor dari percakapan dengan bukti yang bisa diverifikasi (spec 4c §8.2).
 *
 * Laporannya sendiri persis `POST /report`: tipe `Report`, ditandatangani
 * dompet, domain VouchRegistry. Gerbang anti-brigading spec induk §9.3 berlaku
 * utuh — laporan hanya memicu peninjauan.
 *
 * Buktinya membuktikan terlapor MENULIS teks itu untuk pelapor. Ia tidak
 * membuktikan teks itu sama dengan ciphertext tersimpan (spec 4c §11.8).
 *
 * SELURUH verifikasi selesai sebelum tulisan pertama: satu bukti gagal berarti
 * tidak ada laporan tercatat.
 */
export async function laporkanPesan(input: LaporanInput, deps: PesanDeps): Promise<Hasil> {
  const l = input.laporan;
  if (deps.nowMs() > Number(l.expiresAt) * 1000) return fail({ code: "expired", httpStatus: 410 });

  const signer = await pulihkanTandaTangan(() => recoverReportSigner(
    { reporter: l.reporter, subject: l.subject, reasonHash: reasonHashOf(l.reason), expiresAt: l.expiresAt },
    l.sig,
    deps.vouchContract,
  ));
  if (signer === null || kecil(signer) !== kecil(l.reporter)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }
  if (kecil(l.reporter) === kecil(l.subject)) return fail({ code: "lapor_diri", httpStatus: 400 });

  const pelapor = kecil(l.reporter) as Address;
  const terlapor = kecil(l.subject) as Address;

  // Koneksi saja — blokir TIDAK menghalangi lapor (spec 4c §8.2 butir 2).
  if (!(await deps.store.areConnected(pelapor, terlapor))) {
    return fail({ code: "tidak_terhubung", httpStatus: 403 });
  }

  const ids = input.bukti.map((b) => kecil(b.pesanId));
  if (new Set(ids).size !== ids.length) return fail({ code: "bukti_tidak_sah", httpStatus: 422 });

  const [baris, kunci] = await Promise.all([
    deps.pesan.pesanBerdasarkanId(ids),
    deps.pesan.ambilKunci(terlapor),
  ]);
  if (!kunci) return fail({ code: "bukti_tidak_sah", httpStatus: 422 });

  const perId = new Map(baris.map((b) => [kecil(b.id), b]));
  for (const b of input.bukti) {
    const row = perId.get(kecil(b.pesanId));
    if (!row || kecil(row.pengirim) !== terlapor || kecil(row.penerima) !== pelapor) {
      return fail({ code: "bukti_tidak_sah", httpStatus: 422 });
    }
    const sah = verifikasiAmplop(
      { pengirim: terlapor, penerima: pelapor, dikirimMs: b.dikirimMs, isi: b.isi, tanda: b.tanda },
      kunci.kunciTanda,
    );
    if (!sah) return fail({ code: "bukti_tidak_sah", httpStatus: 422 });
  }

  const laporanId = await deps.reports.recordReport({
    reporter: pelapor, subject: terlapor, reason: l.reason, evidence: l.evidence,
  });
  await deps.pesan.gantiBuktiLaporan(laporanId, input.bukti.map((b) => ({
    pesanId: kecil(b.pesanId), isi: b.isi, dikirimMs: b.dikirimMs,
    tanda: kecil(b.tanda) as Hex, kunciTanda: kunci.kunciTanda,
  })));
  return { ok: true, value: { laporanId } };
}
