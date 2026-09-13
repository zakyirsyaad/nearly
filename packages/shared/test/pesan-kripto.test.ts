import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { xchacha20poly1305 } from "@noble/ciphers/chacha";
import {
  bukaPesan, buatIdPesan, enkripsiPesan, kunciPercakapan, kunciPesanTypedData, MAKS_ISI_PESAN,
  stringAmplop, tandaAmplop, tandaRequest, turunkanKunciPesan, verifikasiAmplop,
  verifikasiRequest, VERSI_KUNCI_PESAN, type KunciPesanTurunan,
} from "../src/index";

const VC = "0x0000000000000000000000000000000000000abc" as Address;
const akun = (h: string) => privateKeyToAccount(`0x${h.repeat(32)}` as Hex);
const A = akun("a1");
const B = akun("b2");
const C = akun("c3");
const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");

async function kunciDari(a: typeof A): Promise<KunciPesanTurunan> {
  return turunkanKunciPesan(await a.signTypedData(
    kunciPesanTypedData({ who: a.address, versi: VERSI_KUNCI_PESAN }, VC)));
}

describe("turunkanKunciPesan", () => {
  it("deterministik untuk tanda tangan yang sama", async () => {
    const k1 = await kunciDari(A);
    const k2 = await kunciDari(A);
    expect(k1.pubTanda).toBe(k2.pubTanda);
    expect(k1.pubEnkripsi).toBe(k2.pubEnkripsi);
  });

  it("dompet berbeda, kunci berbeda; kunci tanda ≠ kunci enkripsi", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    expect(ka.pubTanda).not.toBe(kb.pubTanda);
    expect(ka.pubTanda).not.toBe(ka.pubEnkripsi);
    expect(ka.pubTanda).toMatch(/^0x[0-9a-f]{64}$/);
    expect(ka.pubEnkripsi).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("menolak bahan yang bukan 65 byte", () => {
    expect(() => turunkanKunciPesan(`0x${"11".repeat(32)}` as Hex)).toThrow(/65 byte/);
  });
});

describe("kunciPercakapan", () => {
  it("simetris: kedua pihak mendapat kunci yang sama", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const dariA = kunciPercakapan(ka.privEnkripsi, kb.pubEnkripsi, A.address, B.address);
    const dariB = kunciPercakapan(kb.privEnkripsi, ka.pubEnkripsi, B.address, A.address);
    expect(hex(dariA)).toBe(hex(dariB));
  });
});

describe("enkripsiPesan dan bukaPesan", () => {
  it("penerima membuka pesan dan tanda tangannya sah", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const { ciphertext, nonce } = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "halo\nbaris dua", dikirimMs: 1234,
    });
    const hasil = bukaPesan({
      kunci: kb, pubEnkripsiLawan: ka.pubEnkripsi, pubTandaPengirim: ka.pubTanda,
      pengirim: A.address, penerima: B.address, ciphertext, nonce,
    });
    expect(hasil.ok).toBe(true);
    if (hasil.ok) {
      expect(hasil.amplop.isi).toBe("halo\nbaris dua");
      expect(hasil.amplop.dikirimMs).toBe(1234);
      expect(hasil.amplop.pengirim).toBe(A.address.toLowerCase());
    }
  });

  // Riwayat pesan milik sendiri harus terbaca ulang — kalau kunci percakapan
  // tidak simetris, pengirim kehilangan setiap pesan yang pernah ia kirim.
  it("pengirim membuka pesan kirimannya sendiri", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const p = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "catatanku", dikirimMs: 1,
    });
    expect(bukaPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi, pubTandaPengirim: ka.pubTanda,
      pengirim: A.address, penerima: B.address, ...p,
    }).ok).toBe(true);
  });

  it("orang ketiga tidak bisa membuka", async () => {
    const [ka, kb, kc] = await Promise.all([kunciDari(A), kunciDari(B), kunciDari(C)]);
    const p = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "rahasia", dikirimMs: 1,
    });
    expect(bukaPesan({
      kunci: kc, pubEnkripsiLawan: ka.pubEnkripsi, pubTandaPengirim: ka.pubTanda,
      pengirim: A.address, penerima: B.address, ...p,
    }).ok).toBe(false);
  });

  it("ciphertext yang diubah satu karakter ditolak", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const p = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "halo", dikirimMs: 1,
    });
    const diubah = (p.ciphertext[0] === "A" ? "B" : "A") + p.ciphertext.slice(1);
    expect(bukaPesan({
      kunci: kb, pubEnkripsiLawan: ka.pubEnkripsi, pubTandaPengirim: ka.pubTanda,
      pengirim: A.address, penerima: B.address, ciphertext: diubah, nonce: p.nonce,
    }).ok).toBe(false);
  });

  // AAD mengikat arah (spec 4c §5.2): server yang menukar kolom pengirim dan
  // penerima di barisnya harus membuat dekripsi gagal — bahkan kalau
  // pemeriksa memberikan kunci tanda yang "cocok" untuk arah palsu itu.
  it("arah yang ditukar ditolak", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const p = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "halo", dikirimMs: 1,
    });
    expect(bukaPesan({
      kunci: kb, pubEnkripsiLawan: ka.pubEnkripsi, pubTandaPengirim: ka.pubTanda,
      pengirim: B.address, penerima: A.address, ...p,
    }).ok).toBe(false);
  });

  // AAD SENDIRI, tanpa bergantung pada pemeriksaan medan amplop di bukaPesan.
  // Dua asersi sengaja dalam satu tes: AAD yang benar HARUS berhasil, AAD
  // terbalik HARUS gagal. Enkripsi tanpa AAD akan menggagalkan yang pertama.
  it("AAD terikat arah: dekripsi langsung dengan AAD benar berhasil, terbalik gagal", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const p = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "halo", dikirimMs: 1,
    });
    const kunci = kunciPercakapan(kb.privEnkripsi, ka.pubEnkripsi, A.address, B.address);
    const nonce = Buffer.from(p.nonce.slice(2), "hex");
    const ct = Buffer.from(p.ciphertext, "base64");
    const aadBenar = new TextEncoder().encode(`${A.address.toLowerCase()}|${B.address.toLowerCase()}`);
    const aadTerbalik = new TextEncoder().encode(`${B.address.toLowerCase()}|${A.address.toLowerCase()}`);
    expect(() => xchacha20poly1305(kunci, nonce, aadBenar).decrypt(ct)).not.toThrow();
    expect(() => xchacha20poly1305(kunci, nonce, aadTerbalik).decrypt(ct)).toThrow();
  });

  it("kunci tanda pengirim yang salah ditolak", async () => {
    const [ka, kb, kc] = await Promise.all([kunciDari(A), kunciDari(B), kunciDari(C)]);
    const p = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "halo", dikirimMs: 1,
    });
    expect(bukaPesan({
      kunci: kb, pubEnkripsiLawan: ka.pubEnkripsi, pubTandaPengirim: kc.pubTanda,
      pengirim: A.address, penerima: B.address, ...p,
    }).ok).toBe(false);
  });

  it("nonce 24 byte, ciphertext base64", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const p = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "x", dikirimMs: 1,
    });
    expect(p.nonce).toMatch(/^0x[0-9a-f]{48}$/);
    expect(p.ciphertext).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it("isi kosong atau melebihi batas ditolak saat mengenkripsi", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const dasar = { kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi, pengirim: A.address, penerima: B.address, dikirimMs: 1 };
    expect(() => enkripsiPesan({ ...dasar, isi: "" })).toThrow();
    expect(() => enkripsiPesan({ ...dasar, isi: "x".repeat(MAKS_ISI_PESAN + 1) })).toThrow();
    expect(() => enkripsiPesan({ ...dasar, isi: "x".repeat(MAKS_ISI_PESAN) })).not.toThrow();
  });

  // Batas skema ciphertext (Task 3) harus memuat isi terpanjang yang sah,
  // termasuk karakter 4 byte.
  it("isi terpanjang dengan emoji tetap di bawah batas ciphertext 16384", async () => {
    const [ka, kb] = await Promise.all([kunciDari(A), kunciDari(B)]);
    const p = enkripsiPesan({
      kunci: ka, pubEnkripsiLawan: kb.pubEnkripsi,
      pengirim: A.address, penerima: B.address, isi: "😀".repeat(MAKS_ISI_PESAN / 2), dikirimMs: 1,
    });
    expect(p.ciphertext.length).toBeLessThanOrEqual(16384);
  });

  it("bukaPesan tidak pernah melempar untuk masukan sampah", async () => {
    const kb = await kunciDari(B);
    expect(bukaPesan({
      kunci: kb, pubEnkripsiLawan: "0x12" as Hex, pubTandaPengirim: "0xzz" as Hex,
      pengirim: "bukan", penerima: "alamat", ciphertext: "!!!", nonce: "0x00" as Hex,
    }).ok).toBe(false);
  });
});

describe("amplop", () => {
  it("tanda tangan amplop terverifikasi dan menolak perubahan medan mana pun", async () => {
    const ka = await kunciDari(A);
    const isi = { pengirim: A.address, penerima: B.address, dikirimMs: 5, isi: "a\nb" };
    const tanda = tandaAmplop(ka.privTanda, isi);
    expect(verifikasiAmplop({ ...isi, tanda }, ka.pubTanda)).toBe(true);
    expect(verifikasiAmplop({ ...isi, isi: "a\nc", tanda }, ka.pubTanda)).toBe(false);
    expect(verifikasiAmplop({ ...isi, dikirimMs: 6, tanda }, ka.pubTanda)).toBe(false);
    expect(verifikasiAmplop({ ...isi, penerima: C.address, tanda }, ka.pubTanda)).toBe(false);
  });

  // `isi` di posisi terakhir supaya baris baru di dalamnya tidak bisa
  // menggeser medan lain (spec 4c §5.3).
  it("isi di posisi terakhir penyandian kanonik, alamat huruf kecil", () => {
    const s = stringAmplop({ pengirim: "0xAA", penerima: "0xBB", dikirimMs: 7, isi: "x\ny" });
    expect(s).toBe("nearly-pesan-v1\n0xaa\n0xbb\n7\nx\ny");
  });

  it("verifikasiAmplop tidak pernah melempar", () => {
    expect(verifikasiAmplop({ pengirim: "a", penerima: "b", dikirimMs: Number.NaN, isi: "x", tanda: "0x99" }, "zz")).toBe(false);
    expect(verifikasiAmplop({ pengirim: "a", penerima: "b", dikirimMs: 1, isi: "x", tanda: `0x${"99".repeat(64)}` }, `0x${"ff".repeat(32)}`)).toBe(false);
  });
});

describe("tanda request", () => {
  const dasar = { method: "POST", pathDenganQuery: "/pesan", badan: "{\"a\":1}", ts: 1_700_000_000, who: A.address };

  it("terverifikasi, dan setiap medan terikat", async () => {
    const ka = await kunciDari(A);
    const tanda = tandaRequest(ka.privTanda, dasar);
    expect(verifikasiRequest({ ...dasar, tanda }, ka.pubTanda)).toBe(true);
    for (const ubah of [
      { method: "GET" }, { pathDenganQuery: "/pesan?x=1" }, { badan: "{\"a\":2}" },
      { ts: dasar.ts + 1 }, { who: B.address },
    ]) {
      expect(verifikasiRequest({ ...dasar, ...ubah, tanda }, ka.pubTanda)).toBe(false);
    }
  });

  it("verifikasiRequest tidak pernah melempar", () => {
    expect(verifikasiRequest({ ...dasar, tanda: "0x99" }, "bukan-hex")).toBe(false);
  });
});

describe("buatIdPesan", () => {
  it("uuid v4 yang unik", () => {
    const a = buatIdPesan();
    const b = buatIdPesan();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});
