import { beforeEach, describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { daftarKunciPesanTypedData, kunciPesanTypedData } from "@nearly/shared";
import {
  ambilKunciLawan, daftarKunci, daftarPercakapan, kirimPesan, riwayatPercakapan,
  tandaiPercakapanDibaca, totalBelumDibaca,
} from "../src/pesan-gate";
import { buatPengguna, duniaPesan, VC_PESAN } from "./support/dunia-pesan";

let A: Awaited<ReturnType<typeof buatPengguna>>;
let B: Awaited<ReturnType<typeof buatPengguna>>;
let C: Awaited<ReturnType<typeof buatPengguna>>;

beforeEach(async () => {
  [A, B, C] = await Promise.all([buatPengguna("a1"), buatPengguna("b2"), buatPengguna("c3")]);
});

const NONCE = `0x${"cd".repeat(24)}` as Hex;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function siapkan(over: Parameters<typeof duniaPesan>[0] = {}) {
  const d = duniaPesan({ koneksi: [[A.address, B.address]], ...over });
  d.db.kunci.set(A.address.toLowerCase(), A.terdaftar);
  d.db.kunci.set(B.address.toLowerCase(), B.terdaftar);
  return d;
}

describe("daftarKunci", () => {
  const exp = (nowMs: number) => BigInt(Math.floor(nowMs / 1000) + 300);

  it("tanda tangan sah menyimpan kunci", async () => {
    const d = duniaPesan();
    const msg = { who: A.address, kunciEnkripsi: A.terdaftar.kunciEnkripsi, kunciTanda: A.terdaftar.kunciTanda, expiresAt: exp(d.jam.sekarang) };
    const sig = await A.akun.signTypedData(daftarKunciPesanTypedData(msg, VC_PESAN));
    expect((await daftarKunci({ ...msg, sig }, d.deps)).ok).toBe(true);
    expect(d.db.kunci.get(A.address.toLowerCase())).toEqual(A.terdaftar);
  });

  it("kedaluwarsa → 410", async () => {
    const d = duniaPesan();
    const msg = { who: A.address, kunciEnkripsi: A.terdaftar.kunciEnkripsi, kunciTanda: A.terdaftar.kunciTanda, expiresAt: BigInt(Math.floor(d.jam.sekarang / 1000) - 1) };
    const sig = await A.akun.signTypedData(daftarKunciPesanTypedData(msg, VC_PESAN));
    expect(await daftarKunci({ ...msg, sig }, d.deps)).toEqual({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  // Mendaftarkan kunci atas nama orang lain = membaca pesan yang dikirim ke dia.
  it("ditandatangani dompet lain → 401, tidak tersimpan", async () => {
    const d = duniaPesan();
    const msg = { who: A.address, kunciEnkripsi: C.terdaftar.kunciEnkripsi, kunciTanda: C.terdaftar.kunciTanda, expiresAt: exp(d.jam.sekarang) };
    const sig = await C.akun.signTypedData(daftarKunciPesanTypedData(msg, VC_PESAN));
    expect(await daftarKunci({ ...msg, sig }, d.deps)).toEqual({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(d.db.kunci.size).toBe(0);
  });

  it("tanda tangan KunciPesan tidak diterima sebagai DaftarKunciPesan → 401", async () => {
    const d = duniaPesan();
    const msg = { who: A.address, kunciEnkripsi: A.terdaftar.kunciEnkripsi, kunciTanda: A.terdaftar.kunciTanda, expiresAt: exp(d.jam.sekarang) };
    const sig = await A.akun.signTypedData(kunciPesanTypedData({ who: A.address, versi: 1 }, VC_PESAN));
    expect((await daftarKunci({ ...msg, sig }, d.deps)).ok).toBe(false);
  });

  it("tanda tangan cacat bentuk → 401, bukan lemparan", async () => {
    const d = duniaPesan();
    const msg = { who: A.address, kunciEnkripsi: A.terdaftar.kunciEnkripsi, kunciTanda: A.terdaftar.kunciTanda, expiresAt: exp(d.jam.sekarang) };
    await expect(daftarKunci({ ...msg, sig: `0x${"9".repeat(130)}` as Hex }, d.deps))
      .resolves.toEqual({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
  });
});

describe("gerbangPasangan lewat ambilKunciLawan", () => {
  it("diri sendiri → 400 pesan_diri", async () => {
    const d = siapkan();
    expect(await ambilKunciLawan(A.address, A.address, d.deps)).toEqual({ ok: false, failure: { code: "pesan_diri", httpStatus: 400 } });
  });

  // INTI spec 4c §4: bukan koneksi tidak boleh bisa membedakan "dia punya
  // kunci" dari "dia belum memakai pesan". Keduanya 403 tidak_terhubung.
  it("bukan koneksi → 403 tidak_terhubung, sama persis entah lawan punya kunci atau tidak", async () => {
    const d = siapkan();
    const punyaKunci = await ambilKunciLawan(C.address, A.address, d.deps);
    const d2 = siapkan();
    d2.db.kunci.delete(A.address.toLowerCase());
    const tanpaKunci = await ambilKunciLawan(C.address, A.address, d2.deps);
    expect(punyaKunci).toEqual({ ok: false, failure: { code: "tidak_terhubung", httpStatus: 403 } });
    expect(tanpaKunci).toEqual(punyaKunci);
    expect(d.deps.pesan.ambilKunci).not.toHaveBeenCalled();
  });

  it("A memblokir B → keduanya 403 terblokir", async () => {
    const d = siapkan({ blokir: [{ blocker: A.address, blocked: B.address }] });
    expect((await ambilKunciLawan(A.address, B.address, d.deps))).toEqual({ ok: false, failure: { code: "terblokir", httpStatus: 403 } });
    expect((await ambilKunciLawan(B.address, A.address, d.deps))).toEqual({ ok: false, failure: { code: "terblokir", httpStatus: 403 } });
  });

  it("koneksi tanpa kunci lawan → 409 belum_siap", async () => {
    const d = siapkan();
    d.db.kunci.delete(B.address.toLowerCase());
    expect(await ambilKunciLawan(A.address, B.address, d.deps)).toEqual({ ok: false, failure: { code: "belum_siap", httpStatus: 409 } });
  });

  it("koneksi dengan kunci → kunci lawan", async () => {
    const d = siapkan();
    expect(await ambilKunciLawan(A.address, B.address, d.deps)).toEqual({ ok: true, value: B.terdaftar });
  });
});

describe("kirimPesan", () => {
  const masukan = (n = 1) => ({ id: id(n), penerima: B.address, ciphertext: "QUJD", nonce: NONCE });

  it("sah → baru, tersimpan huruf kecil", async () => {
    const d = siapkan();
    expect(await kirimPesan(A.address, masukan(), d.deps)).toEqual({ ok: true, value: { baru: true } });
    expect(d.db.pesan[0]).toMatchObject({ pengirim: A.address.toLowerCase(), penerima: B.address.toLowerCase() });
  });

  it("id yang sama dua kali → satu baris, kedua kalinya baru=false", async () => {
    const d = siapkan();
    await kirimPesan(A.address, masukan(), d.deps);
    expect(await kirimPesan(A.address, masukan(), d.deps)).toEqual({ ok: true, value: { baru: false } });
    expect(d.db.pesan).toHaveLength(1);
  });

  it("tiga puluh dalam enam puluh detik diterima, berikutnya 429; lewat jendela diterima lagi", async () => {
    const d = siapkan();
    for (let i = 0; i < 30; i++) {
      expect((await kirimPesan(A.address, masukan(i), d.deps)).ok).toBe(true);
    }
    expect(await kirimPesan(A.address, masukan(30), d.deps)).toEqual({ ok: false, failure: { code: "terlalu_cepat", httpStatus: 429 } });
    d.jam.sekarang += 60_001;
    expect((await kirimPesan(A.address, masukan(31), d.deps)).ok).toBe(true);
  });

  it("terblokir → 403 dan tidak tersimpan", async () => {
    const d = siapkan({ blokir: [{ blocker: B.address, blocked: A.address }] });
    expect((await kirimPesan(A.address, masukan(), d.deps)).ok).toBe(false);
    expect(d.db.pesan).toHaveLength(0);
  });

  it("penerima tanpa kunci → 409 dan tidak tersimpan", async () => {
    const d = siapkan();
    d.db.kunci.delete(B.address.toLowerCase());
    expect(await kirimPesan(A.address, masukan(), d.deps)).toEqual({ ok: false, failure: { code: "belum_siap", httpStatus: 409 } });
    expect(d.db.pesan).toHaveLength(0);
  });
});

describe("daftarPercakapan dan belum dibaca", () => {
  it("per lawan: pesan terakhir, jumlah belum dibaca, nama tampilan", async () => {
    const d = siapkan({ koneksi: [[A.address, B.address], [A.address, C.address]], nama: { [B.address]: "Budi" } });
    d.db.kunci.set(C.address.toLowerCase(), C.terdaftar);
    await kirimPesan(B.address, { id: id(1), penerima: A.address, ciphertext: "QQ==", nonce: NONCE }, d.deps);
    d.jam.sekarang += 1000;
    await kirimPesan(B.address, { id: id(2), penerima: A.address, ciphertext: "Qg==", nonce: NONCE }, d.deps);
    d.jam.sekarang += 1000;
    await kirimPesan(A.address, { id: id(3), penerima: C.address, ciphertext: "Qw==", nonce: NONCE }, d.deps);

    const daftar = await daftarPercakapan(A.address, d.deps);
    expect(daftar.map((p) => p.lawan)).toEqual([C.address.toLowerCase(), B.address.toLowerCase()]);
    const budi = daftar.find((p) => p.lawan === B.address.toLowerCase())!;
    expect(budi.terakhir.id).toBe(id(2));
    expect(budi.belumDibaca).toBe(2);
    expect(budi.displayName).toBe("Budi");
    expect(await totalBelumDibaca(A.address, d.deps)).toBe(2);
  });

  it("lawan yang berhubungan blokir ke arah mana pun tidak muncul dan tidak dihitung", async () => {
    const d = siapkan();
    await kirimPesan(B.address, { id: id(1), penerima: A.address, ciphertext: "QQ==", nonce: NONCE }, d.deps);
    d.pasangBlokir(B.address, A.address);
    expect(await daftarPercakapan(A.address, d.deps)).toEqual([]);
    expect(await totalBelumDibaca(A.address, d.deps)).toBe(0);
    expect(await daftarPercakapan(B.address, d.deps)).toEqual([]);
  });
});

describe("riwayat dan tandai dibaca", () => {
  it("bukan koneksi → 403", async () => {
    const d = siapkan();
    expect((await riwayatPercakapan(C.address, A.address, null, 50, d.deps)).ok).toBe(false);
    expect((await tandaiPercakapanDibaca(C.address, A.address, 1, d.deps)).ok).toBe(false);
  });

  it("riwayat dua arah, batas dijepit ke 50", async () => {
    const d = siapkan();
    await kirimPesan(A.address, { id: id(1), penerima: B.address, ciphertext: "QQ==", nonce: NONCE }, d.deps);
    d.jam.sekarang += 1;
    await kirimPesan(B.address, { id: id(2), penerima: A.address, ciphertext: "Qg==", nonce: NONCE }, d.deps);
    const r = await riwayatPercakapan(A.address, B.address, null, 999, d.deps);
    expect(r.ok && r.value.map((p) => p.id)).toEqual([id(2), id(1)]);
    expect(d.deps.pesan.riwayat).toHaveBeenCalledWith(A.address.toLowerCase(), B.address.toLowerCase(), null, 50);
  });

  it("tandai dibaca menurunkan belum dibaca ke nol", async () => {
    const d = siapkan();
    await kirimPesan(B.address, { id: id(1), penerima: A.address, ciphertext: "QQ==", nonce: NONCE }, d.deps);
    expect((await tandaiPercakapanDibaca(A.address, B.address, d.jam.sekarang, d.deps)).ok).toBe(true);
    expect(await totalBelumDibaca(A.address, d.deps)).toBe(0);
  });
});
