import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  bukaPesan, enkripsiPesan, kunciPesanTypedData, recoverReportSigner, reasonHashOf,
  turunkanKunciPesan, VERSI_KUNCI_PESAN,
} from "@nearly/shared";
import { CONFIG } from "../src/config";
import type { SesiPesan } from "../src/pesan/sesi";
import {
  _resetKunciLawanUntukTes, bukaBaris, kirimPesan, laporanSiapDikirim, laporkanPercakapan,
} from "../src/pesan/pesan-actions";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = privateKeyToAccount(`0x${"b2".repeat(32)}` as Hex);

async function sesiDari(akun: typeof A): Promise<SesiPesan> {
  return {
    address: akun.address as Address,
    kunci: turunkanKunciPesan(await akun.signTypedData(
      kunciPesanTypedData({ who: akun.address, versi: VERSI_KUNCI_PESAN }, CONFIG.verifyingContract))),
  };
}

type Rekaman = { url: string; init: RequestInit };
const aslinya = globalThis.fetch;
beforeEach(() => _resetKunciLawanUntukTes());
afterEach(() => { globalThis.fetch = aslinya; });

function pasangFetch(sb: SesiPesan) {
  const rekaman: Rekaman[] = [];
  globalThis.fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
    rekaman.push({ url, init });
    const body = url.includes("/pesan/kunci/")
      ? { kunciEnkripsi: sb.kunci.pubEnkripsi, kunciTanda: sb.kunci.pubTanda }
      : { ok: true };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as never;
  return rekaman;
}

describe("kirimPesan", () => {
  it("mengenkripsi untuk penerima; penerima membuka isi yang sudah dirapikan", async () => {
    const [sa, sb] = await Promise.all([sesiDari(A), sesiDari(B)]);
    const rek = pasangFetch(sb);
    await kirimPesan(sa, B.address, "  halo dari A  ");
    const kirim = rek.find((r) => r.url.endsWith("/pesan") && r.init.method === "POST")!;
    const badan = JSON.parse(String(kirim.init.body)) as { id: string; penerima: string; ciphertext: string; nonce: Hex };
    expect(badan.id).toMatch(/^[0-9a-f-]{36}$/);
    const hasil = bukaPesan({
      kunci: sb.kunci, pubEnkripsiLawan: sa.kunci.pubEnkripsi, pubTandaPengirim: sa.kunci.pubTanda,
      pengirim: A.address, penerima: B.address, ciphertext: badan.ciphertext, nonce: badan.nonce,
    });
    expect(hasil.ok && hasil.amplop.isi).toBe("halo dari A");
    // Server tidak pernah melihat plaintext.
    expect(String(kirim.init.body)).not.toContain("halo dari A");
  });

  it("kunci lawan diambil sekali untuk beberapa pesan", async () => {
    const [sa, sb] = await Promise.all([sesiDari(A), sesiDari(B)]);
    const rek = pasangFetch(sb);
    await kirimPesan(sa, B.address, "satu");
    await kirimPesan(sa, B.address, "dua");
    expect(rek.filter((r) => r.url.includes("/pesan/kunci/"))).toHaveLength(1);
  });

  it("isi kosong atau terlalu panjang ditolak sebelum menyentuh jaringan", async () => {
    const [sa, sb] = await Promise.all([sesiDari(A), sesiDari(B)]);
    const rek = pasangFetch(sb);
    await expect(kirimPesan(sa, B.address, "   ")).rejects.toThrow();
    await expect(kirimPesan(sa, B.address, "x".repeat(2001))).rejects.toThrow();
    expect(rek).toHaveLength(0);
  });
});

describe("bukaBaris", () => {
  it("pesan masuk dan keluar sama-sama terbuka; yang dirusak tidak terverifikasi", async () => {
    const [sa, sb] = await Promise.all([sesiDari(A), sesiDari(B)]);
    const lawanB = { kunciEnkripsi: sb.kunci.pubEnkripsi, kunciTanda: sb.kunci.pubTanda };
    const masuk = enkripsiPesan({ kunci: sb.kunci, pubEnkripsiLawan: sa.kunci.pubEnkripsi, pengirim: B.address, penerima: A.address, isi: "dari B", dikirimMs: 1 });
    const keluar = enkripsiPesan({ kunci: sa.kunci, pubEnkripsiLawan: sb.kunci.pubEnkripsi, pengirim: A.address, penerima: B.address, isi: "dari A", dikirimMs: 2 });
    const baris = (p: { ciphertext: string; nonce: Hex }, pengirim: string, penerima: string) =>
      ({ id: "x", pengirim, penerima, createdAtMs: 0, dibacaAtMs: null, ...p });

    const m = bukaBaris(sa, lawanB, baris(masuk, B.address.toLowerCase(), A.address.toLowerCase()));
    expect(m).toMatchObject({ status: "sah", isi: "dari B", dariAku: false });
    const k = bukaBaris(sa, lawanB, baris(keluar, A.address.toLowerCase(), B.address.toLowerCase()));
    expect(k).toMatchObject({ status: "sah", isi: "dari A", dariAku: true });
    const rusak = bukaBaris(sa, lawanB, baris({ ...masuk, ciphertext: `A${masuk.ciphertext.slice(1)}` }, B.address.toLowerCase(), A.address.toLowerCase()));
    expect(rusak.status).toBe("tidak_terverifikasi");
  });
});

describe("laporkanPercakapan", () => {
  it("Report ditandatangani untuk VouchRegistry, bukti diteruskan apa adanya", async () => {
    const rekaman: Rekaman[] = [];
    globalThis.fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
      rekaman.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as never;
    const signer = { address: A.address as Address, signTypedData: (td: never) => A.signTypedData(td as Parameters<typeof A.signTypedData>[0]) };
    const bukti = [{ pesanId: "00000000-0000-4000-8000-000000000001", isi: "ancaman", dikirimMs: 5, tanda: `0x${"ee".repeat(64)}` as Hex }];

    await laporkanPercakapan(signer, B.address, "  mengirim ancaman berulang kali  ", bukti);

    expect(rekaman[0]!.url).toBe(`${CONFIG.apiUrl}/pesan/laporan`);
    const badan = JSON.parse(String(rekaman[0]!.init.body)) as {
      laporan: { reporter: Address; subject: Address; reason: string; expiresAt: string; sig: Hex }; bukti: unknown;
    };
    expect(badan.bukti).toEqual(bukti);
    expect(badan.laporan.reason).toBe("mengirim ancaman berulang kali");
    const pulih = await recoverReportSigner({
      reporter: badan.laporan.reporter, subject: badan.laporan.subject,
      reasonHash: reasonHashOf(badan.laporan.reason), expiresAt: BigInt(badan.laporan.expiresAt),
    }, badan.laporan.sig, CONFIG.vouchRegistry);
    expect(pulih.toLowerCase()).toBe(A.address.toLowerCase());
  });
});

describe("laporanSiapDikirim", () => {
  it("butuh 1–5 pesan dan alasan minimal 10 karakter setelah dirapikan", () => {
    expect(laporanSiapDikirim(0, "alasan yang cukup")).toBe(false);
    expect(laporanSiapDikirim(1, "alasan yang cukup")).toBe(true);
    expect(laporanSiapDikirim(5, "alasan yang cukup")).toBe(true);
    expect(laporanSiapDikirim(6, "alasan yang cukup")).toBe(false);
    expect(laporanSiapDikirim(1, "   pendek  ")).toBe(false);
  });
});
