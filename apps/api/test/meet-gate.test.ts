import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  inginBertemuTypedData, lihatKecocokanTypedData, lihatProfilTypedData, tandaiDilihatTypedData,
} from "@nearly/shared";
import { daftarKecocokan, setTanda, tandaiDilihat } from "../src/meet-gate";
import type { MeetDeps, MeetStore } from "../src/ports";

const aku = privateKeyToAccount(`0x${"11".repeat(32)}` as Hex);
const lain = privateKeyToAccount(`0x${"22".repeat(32)}` as Hex);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const TARGET = "0x000000000000000000000000000000000000dead" as Address;
const NOW = 1_800_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);

function store(over: Partial<MeetStore> = {}): MeetStore {
  return {
    setTanda: vi.fn(async () => {}),
    hitungTanda: vi.fn(async () => 0),
    adaTanda: vi.fn(async () => false),
    tandaOleh: vi.fn(async () => []),
    tandaKe: vi.fn(async () => []),
    cocokDilihatAtMs: vi.fn(async () => null),
    setCocokDilihat: vi.fn(async () => {}),
    profilRingkas: vi.fn(async () => new Map()),
    hitungTandaBanyak: vi.fn(async () => new Map()),
    ...over,
  };
}

const deps = (meet: MeetStore): MeetDeps =>
  ({ meet, verifyingContract: KONTRAK, nowMs: () => NOW });

async function masukan(over: Record<string, unknown> = {}) {
  const pesan = { target: TARGET, who: aku.address, ingin: true, expiresAt: EXP };
  const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
  return { ...pesan, sig, ...over };
}

describe("setTanda", () => {
  it("menyimpan tanda yang tanda tangannya sah", async () => {
    const s = store();
    const hasil = await setTanda(await masukan(), deps(s));
    expect(hasil.ok).toBe(true);
    expect(s.setTanda).toHaveBeenCalledWith(TARGET, aku.address, true);
  });

  it("menyimpan pencabutan", async () => {
    const pesan = { target: TARGET, who: aku.address, ingin: false, expiresAt: EXP };
    const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    const s = store();
    await setTanda({ ...pesan, sig }, deps(s));
    expect(s.setTanda).toHaveBeenCalledWith(TARGET, aku.address, false);
  });

  it("menolak tanda tangan orang lain", async () => {
    const pesan = { target: TARGET, who: aku.address, ingin: true, expiresAt: EXP };
    const sig = await lain.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    const s = store();
    const hasil = await setTanda({ ...pesan, sig }, deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(s.setTanda).not.toHaveBeenCalled();
  });

  it("menolak permintaan kedaluwarsa", async () => {
    const lampau = BigInt(Math.floor(NOW / 1000) - 1);
    const pesan = { target: TARGET, who: aku.address, ingin: true, expiresAt: lampau };
    const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    const hasil = await setTanda({ ...pesan, sig }, deps(store()));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  /**
   * Pin batas kedaluwarsa. `sudahLewat` memakai `>` KETAT
   * (`deps.nowMs() > Number(expiresAt) * 1000`), jadi permintaan yang
   * expiresAt-nya PERSIS SAMA dengan waktu server masih dianggap BELUM lewat
   * dan diterima. Ini bukan celah yang lolos tanpa disadari: `expiresAt`
   * adalah batas atas dari rentang waktu yang MASIH SAH, jadi detik itu
   * sendiri semestinya masih berlaku, bukan sudah kedaluwarsa. Tes ini
   * sengaja mengunci sisi `>` tersebut — kalau operatornya ditukar jadi
   * `>=`, permintaan tepat di batas ini akan ditolak sebagai kedaluwarsa dan
   * tes ini merah.
   */
  it("permintaan tepat di detik kedaluwarsa masih diterima (batas > ketat)", async () => {
    const tepat = BigInt(NOW / 1000);
    const pesan = { target: TARGET, who: aku.address, ingin: true, expiresAt: tepat };
    const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    const s = store();
    const hasil = await setTanda({ ...pesan, sig }, deps(s));
    expect(hasil.ok).toBe(true);
    expect(s.setTanda).toHaveBeenCalledWith(TARGET, aku.address, true);
  });

  /**
   * INVARIAN spec §13.7. Skema Zod sengaja MENERIMA target === who supaya
   * pemeriksaan ini benar-benar terjangkau lewat rute dan tidak membusuk
   * sebagai kode mati.
   */
  it("menolak menandai diri sendiri", async () => {
    const pesan = { target: aku.address, who: aku.address, ingin: true, expiresAt: EXP };
    const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    const s = store();
    const hasil = await setTanda({ ...pesan, sig }, deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "tandai_diri", httpStatus: 400 } });
    expect(s.setTanda).not.toHaveBeenCalled();
  });

  it("menolak menandai diri sendiri walau beda besar-kecil huruf", async () => {
    // toLowerCase(), BUKAN toUpperCase(): alamat checksum viem valid sebagai
    // huruf kecil semua tanpa validasi checksum, tapi huruf besar semua
    // (termasuk prefiks "0X") ditolak oleh isAddress/hashTypedData viem
    // sendiri — signTypedData akan melempar InvalidAddressError sebelum
    // setTanda sempat dipanggil, dan tes gagal karena alasan yang salah.
    const target = aku.address.toLowerCase() as Address;
    const pesan = { target, who: aku.address, ingin: true, expiresAt: EXP };
    const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    const hasil = await setTanda({ ...pesan, sig }, deps(store()));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "tandai_diri" } });
  });

  /**
   * INVARIAN. `ingin` ikut ditandatangani justru supaya satu tanda tangan
   * tidak bisa dipakai dua arah. Kalau gerbang memulihkan memakai nilai yang
   * dikarang server alih-alih yang dikirim, penjagaan itu hilang.
   */
  it("tanda tangan ingin:true tidak bisa dipakai mencabut", async () => {
    const sigTrue = (await masukan()).sig;
    const s = store();
    const hasil = await setTanda(
      { target: TARGET, who: aku.address, ingin: false, expiresAt: EXP, sig: sigTrue }, deps(s),
    );
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature" } });
    expect(s.setTanda).not.toHaveBeenCalled();
  });

  /**
   * INVARIAN Ruling 23. Bukti baca LihatProfil berkeliaran di query string;
   * kalau ia sah di sini, siapa pun yang menangkapnya bisa menandai orang
   * atas nama korban — dan menandai memicu pengungkapan identitas.
   */
  it("tanda tangan LihatProfil TIDAK diterima sebagai perintah menandai", async () => {
    const sigBaca = await aku.signTypedData(
      lihatProfilTypedData({ target: TARGET, who: aku.address, expiresAt: EXP }, KONTRAK));
    const s = store();
    const hasil = await setTanda(
      { target: TARGET, who: aku.address, ingin: true, expiresAt: EXP, sig: sigBaca }, deps(s),
    );
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(s.setTanda).not.toHaveBeenCalled();
  });
});

describe("tandaiDilihat", () => {
  async function masukanDilihat() {
    const pesan = { who: aku.address, expiresAt: EXP };
    const sig = await aku.signTypedData(tandaiDilihatTypedData(pesan, KONTRAK));
    return { ...pesan, sig };
  }

  it("menyetel waktu dilihat dari deps.nowMs, bukan jam klien", async () => {
    const s = store();
    const hasil = await tandaiDilihat(await masukanDilihat(), deps(s));
    expect(hasil.ok).toBe(true);
    expect(s.setCocokDilihat).toHaveBeenCalledWith(aku.address, NOW);
  });

  it("menolak tanda tangan orang lain", async () => {
    const pesan = { who: aku.address, expiresAt: EXP };
    const sig = await lain.signTypedData(tandaiDilihatTypedData(pesan, KONTRAK));
    const s = store();
    const hasil = await tandaiDilihat({ ...pesan, sig }, deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature" } });
    expect(s.setCocokDilihat).not.toHaveBeenCalled();
  });

  // Cermin dari "menolak permintaan kedaluwarsa" milik setTanda.
  // `TandaiDilihat` adalah perintah TULIS yang membungkam lencana kecocokan
  // (lihat doc comment `TandaiDilihatMessage` di packages/shared/src/meet.ts)
  // — tanpa penjagaan kedaluwarsa ini, satu tanda tangan yang tertangkap bisa
  // dipakai berulang-ulang, selamanya, untuk mencegah korban pernah melihat
  // bahwa ia sudah saling menandai dengan seseorang.
  it("menolak permintaan kedaluwarsa", async () => {
    const lampau = BigInt(Math.floor(NOW / 1000) - 1);
    const pesan = { who: aku.address, expiresAt: lampau };
    const sig = await aku.signTypedData(tandaiDilihatTypedData(pesan, KONTRAK));
    const s = store();
    const hasil = await tandaiDilihat({ ...pesan, sig }, deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "expired", httpStatus: 410 } });
    expect(s.setCocokDilihat).not.toHaveBeenCalled();
  });

  // Sama seperti di atas: bukti baca tidak boleh jadi perintah tulis. Kalau
  // lolos, siapa pun bisa menghapus lencana kecocokan orang lain.
  it("tanda tangan LihatProfil TIDAK diterima", async () => {
    const sigBaca = await aku.signTypedData(
      lihatProfilTypedData({ target: TARGET, who: aku.address, expiresAt: EXP }, KONTRAK));
    const s = store();
    const hasil = await tandaiDilihat(
      { who: aku.address, expiresAt: EXP, sig: sigBaca }, deps(s),
    );
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature" } });
    expect(s.setCocokDilihat).not.toHaveBeenCalled();
  });

  /**
   * INVARIAN inti fase ini. `LihatKecocokan` (bukti BACA) dan `TandaiDilihat`
   * (perintah TULIS) punya bentuk field yang IDENTIK — `{who, expiresAt}` —
   * dan itu disengaja (lihat doc comment `LihatKecocokanMessage` di
   * packages/shared/src/meet.ts). Hanya NAMA TIPE EIP-712 yang memisahkan
   * keduanya. Tanda tangan di bawah ini SAH, oleh kunci yang BENAR, atas
   * nilai `{who, expiresAt}` yang BENAR — cuma primaryType-nya beda. Ini
   * pasangan yang berbahaya, bukan `LihatProfil` di atas (bentuknya beda,
   * jadi kasusnya mudah). Kalau tes ini tidak ada, pelebaran di masa depan
   * yang mencoba `recoverLihatKecocokanSigner` sebagai fallback di
   * `tandaiDilihat` akan lolos tanpa terdeteksi test manapun.
   */
  it("tanda tangan LihatKecocokan (bentuk field identik) TIDAK diterima sebagai TandaiDilihat", async () => {
    const sigBaca = await aku.signTypedData(
      lihatKecocokanTypedData({ who: aku.address, expiresAt: EXP }, KONTRAK));
    const s = store();
    const hasil = await tandaiDilihat(
      { who: aku.address, expiresAt: EXP, sig: sigBaca }, deps(s),
    );
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(s.setCocokDilihat).not.toHaveBeenCalled();
  });
});

describe("daftarKecocokan", () => {
  const T = NOW - 10_000;

  it("mengembalikan irisan dua arah beserta hitungan baru", async () => {
    const s = store({
      tandaOleh: vi.fn(async () => [{ address: TARGET, atMs: T }]),
      tandaKe: vi.fn(async () => [{ address: TARGET, atMs: T + 500 }]),
      cocokDilihatAtMs: vi.fn(async () => null),
      profilRingkas: vi.fn(async () => new Map([
        [TARGET.toLowerCase(), { displayName: "Andi", tier: 2 }],
      ])),
    });
    const hasil = await daftarKecocokan(aku.address, deps(s));
    expect(hasil.kecocokan).toHaveLength(1);
    expect(hasil.kecocokan[0]).toMatchObject({
      address: TARGET.toLowerCase(), displayName: "Andi", tier: 2, sejakMs: T + 500,
    });
    expect(hasil.baru).toBe(1);
  });

  it("menandai satu arah tidak menghasilkan kecocokan", async () => {
    const s = store({ tandaOleh: vi.fn(async () => [{ address: TARGET, atMs: T }]) });
    const hasil = await daftarKecocokan(aku.address, deps(s));
    expect(hasil.kecocokan).toHaveLength(0);
    expect(hasil.baru).toBe(0);
  });

  it("kecocokan lebih lama dari waktu dilihat tidak dihitung baru", async () => {
    const s = store({
      tandaOleh: vi.fn(async () => [{ address: TARGET, atMs: T }]),
      tandaKe: vi.fn(async () => [{ address: TARGET, atMs: T }]),
      cocokDilihatAtMs: vi.fn(async () => T + 1000),
    });
    const hasil = await daftarKecocokan(aku.address, deps(s));
    expect(hasil.kecocokan).toHaveLength(1);
    expect(hasil.baru).toBe(0);
  });

  // Nama kosong wajar: profil tidak mewajibkan nama, alamat-lah identitasnya.
  it("profil tanpa nama tetap muncul dengan nama kosong dan tier nol", async () => {
    const s = store({
      tandaOleh: vi.fn(async () => [{ address: TARGET, atMs: T }]),
      tandaKe: vi.fn(async () => [{ address: TARGET, atMs: T }]),
    });
    const hasil = await daftarKecocokan(aku.address, deps(s));
    expect(hasil.kecocokan[0]).toMatchObject({ displayName: "", tier: 0 });
  });
});
