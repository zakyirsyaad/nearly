import { beforeEach, describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import { reasonHashOf, reportTypedData, tandaAmplop } from "@nearly/shared";
import { laporkanPesan } from "../src/pesan-laporan";
import { buatPengguna, duniaPesan, VC_PESAN, VOUCH_PESAN } from "./support/dunia-pesan";

let A: Awaited<ReturnType<typeof buatPengguna>>; // pelapor
let B: Awaited<ReturnType<typeof buatPengguna>>; // terlapor
let C: Awaited<ReturnType<typeof buatPengguna>>;

beforeEach(async () => {
  [A, B, C] = await Promise.all([buatPengguna("a1"), buatPengguna("b2"), buatPengguna("c3")]);
});

const ID1 = "00000000-0000-4000-8000-000000000001";
const ALASAN = "mengirim ancaman berulang kali";

/** Dunia dengan satu pesan SUNGGUHAN dari B ke A, dan bukti bertanda tangan B. */
function siapkan(over: Parameters<typeof duniaPesan>[0] = {}) {
  const d = duniaPesan({ koneksi: [[A.address, B.address]], ...over });
  d.db.kunci.set(A.address.toLowerCase(), A.terdaftar);
  d.db.kunci.set(B.address.toLowerCase(), B.terdaftar);
  d.db.pesan.push({
    id: ID1, pengirim: B.address.toLowerCase() as Address, penerima: A.address.toLowerCase() as Address,
    ciphertext: "QQ==", nonce: `0x${"cd".repeat(24)}` as Hex, createdAtMs: d.jam.sekarang, dibacaAtMs: null,
  });
  const isi = { pengirim: B.address, penerima: A.address, dikirimMs: 1234, isi: "kutunggu di parkiran" };
  const bukti = { pesanId: ID1, isi: isi.isi, dikirimMs: isi.dikirimMs, tanda: tandaAmplop(B.kunci.privTanda, isi) };
  return { d, bukti };
}

async function laporanDari(
  pelapor: typeof A, subject: Address, nowMs: number,
  kontrak: Address = VOUCH_PESAN, expiresAt = BigInt(Math.floor(nowMs / 1000) + 300),
) {
  const msg = { reporter: pelapor.address, subject, reasonHash: reasonHashOf(ALASAN), expiresAt };
  const sig = await pelapor.akun.signTypedData(reportTypedData(msg, kontrak));
  return { reporter: pelapor.address, subject, reason: ALASAN, expiresAt, sig };
}

describe("laporkanPesan", () => {
  it("bukti sah → laporan tercatat dan bukti tersimpan dengan kunci tanda terlapor", async () => {
    const { d, bukti } = siapkan();
    const hasil = await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang), bukti: [bukti] }, d.deps);
    expect(hasil).toEqual({ ok: true, value: { laporanId: 1 } });
    expect(d.laporan).toEqual([{ id: 1, reporter: A.address.toLowerCase(), subject: B.address.toLowerCase(), reason: ALASAN }]);
    expect(d.db.bukti.get(1)).toEqual([{ ...bukti, kunciTanda: B.terdaftar.kunciTanda }]);
  });

  // Pelapor tidak bisa mengarang pesan atas nama terlapor.
  it("tanda tangan bukti dari kunci lain → 422, tidak ada yang tercatat", async () => {
    const { d, bukti } = siapkan();
    const palsu = { ...bukti, tanda: tandaAmplop(C.kunci.privTanda, { pengirim: B.address, penerima: A.address, dikirimMs: bukti.dikirimMs, isi: bukti.isi }) };
    expect(await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang), bukti: [palsu] }, d.deps))
      .toEqual({ ok: false, failure: { code: "bukti_tidak_sah", httpStatus: 422 } });
    expect(d.laporan).toEqual([]);
    expect(d.db.bukti.size).toBe(0);
  });

  it("isi bukti diubah → 422", async () => {
    const { d, bukti } = siapkan();
    expect((await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang), bukti: [{ ...bukti, isi: "isi lain" }] }, d.deps)).ok).toBe(false);
  });

  it("pesanId fiktif → 422", async () => {
    const { d, bukti } = siapkan();
    expect((await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang), bukti: [{ ...bukti, pesanId: "00000000-0000-4000-8000-00000000dead" }] }, d.deps)).ok).toBe(false);
  });

  // Pelapor hanya bisa melaporkan pesan yang DITUJUKAN kepadanya.
  it("pesan yang bukan untuk pelapor → 422", async () => {
    const { d, bukti } = siapkan({ koneksi: [[A.address, B.address], [C.address, B.address]] });
    d.db.kunci.set(C.address.toLowerCase(), C.terdaftar);
    expect((await laporkanPesan({ laporan: await laporanDari(C, B.address, d.jam.sekarang), bukti: [bukti] }, d.deps)).ok).toBe(false);
  });

  it("satu bukti sah dan satu palsu → 422, tidak ada yang tercatat", async () => {
    const { d, bukti } = siapkan();
    expect((await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang), bukti: [bukti, { ...bukti, isi: "x" }] }, d.deps)).ok).toBe(false);
    expect(d.laporan).toEqual([]);
  });

  it("pesanId ganda → 422", async () => {
    const { d, bukti } = siapkan();
    expect((await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang), bukti: [bukti, bukti] }, d.deps)).ok).toBe(false);
  });

  // Spec 4c §8.2 butir 2: blokir TIDAK menghalangi lapor.
  it("pasangan yang sudah terblokir tetap bisa melapor", async () => {
    const { d, bukti } = siapkan({ blokir: [{ blocker: A.address, blocked: B.address }] });
    expect((await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang), bukti: [bukti] }, d.deps)).ok).toBe(true);
  });

  it("bukan koneksi → 403", async () => {
    const { d, bukti } = siapkan({ koneksi: [] });
    expect(await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang), bukti: [bukti] }, d.deps))
      .toEqual({ ok: false, failure: { code: "tidak_terhubung", httpStatus: 403 } });
  });

  it("Report ditandatangani untuk ConnectionRegistry, bukan VouchRegistry → 401", async () => {
    const { d, bukti } = siapkan();
    expect(await laporkanPesan({ laporan: await laporanDari(A, B.address, d.jam.sekarang, VC_PESAN), bukti: [bukti] }, d.deps))
      .toEqual({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
  });

  it("Report kedaluwarsa → 410", async () => {
    const { d, bukti } = siapkan();
    const lap = await laporanDari(A, B.address, d.jam.sekarang, VOUCH_PESAN, BigInt(Math.floor(d.jam.sekarang / 1000) - 1));
    expect(await laporkanPesan({ laporan: lap, bukti: [bukti] }, d.deps))
      .toEqual({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("melaporkan diri sendiri → 400", async () => {
    const { d, bukti } = siapkan();
    expect(await laporkanPesan({ laporan: await laporanDari(A, A.address, d.jam.sekarang), bukti: [bukti] }, d.deps))
      .toEqual({ ok: false, failure: { code: "lapor_diri", httpStatus: 400 } });
  });

  it("tanda tangan Report cacat bentuk → 401, bukan lemparan", async () => {
    const { d, bukti } = siapkan();
    const lap = { ...(await laporanDari(A, B.address, d.jam.sekarang)), sig: `0x${"9".repeat(130)}` as Hex };
    await expect(laporkanPesan({ laporan: lap, bukti: [bukti] }, d.deps))
      .resolves.toEqual({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
  });
});
