import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  inginBertemuTypedData, lihatKecocokanTypedData, lihatProfilTypedData, tandaiDilihatTypedData,
} from "@nearly/shared";
import { daftarKecocokan, setTanda, tandaiDilihat } from "../src/meet-gate";
import type { BlokirStore, MeetDeps, MeetStore } from "../src/ports";

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
    ...over,
  };
}

// Fake BlokirStore dengan tepat lima metode (lihat METODE_BLOKIR_STORE di
// ports.ts) — `himpunanUntuk` kosong secara default supaya tes-tes lama
// (yang tidak peduli blokir) tetap berjalan seperti sebelum Task 10.
function blokirPalsu(over: Partial<BlokirStore> = {}): BlokirStore {
  return {
    setBlokir: vi.fn(async () => {}),
    adaBlokir: vi.fn(async () => false),
    diblokirOleh: vi.fn(async () => []),
    himpunanUntuk: vi.fn(async () => new Set<string>()),
    pemblokirUntuk: vi.fn(async () => new Set<string>()),
    ...over,
  };
}

const deps = (meet: MeetStore, blokir: BlokirStore = blokirPalsu()): MeetDeps =>
  ({ meet, blokir, verifyingContract: KONTRAK, nowMs: () => NOW });

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

  /**
   * Fake adaBlokir yang MEMBEDAKAN arah: hanya pasangan (blocker, blocked)
   * yang disebut yang terblokir. Dengan ini tes di bawah bisa membuktikan
   * KEDUA arah diperiksa — fake yang selalu `true` akan lolos juga untuk
   * gerbang yang hanya memeriksa satu arah.
   */
  const blokirArah = (blocker: string, blocked: string) => vi.fn(
    async (x: Address, y: Address) =>
      x.toLowerCase() === blocker.toLowerCase() && y.toLowerCase() === blocked.toLowerCase(),
  );

  /**
   * R5 (putusan pengawas atas brief Task 10). Spec §5.2 menolak MENANDAI
   * selagi terblokir — bukan mencabut. Pemeriksaan ini hanya menyala saat
   * `ingin === true`.
   */
  it("menolak memasang tanda baru saat PENANDA memblokir target", async () => {
    const s = store();
    const b = blokirPalsu({ adaBlokir: blokirArah(aku.address, TARGET) });
    const hasil = await setTanda(await masukan(), deps(s, b));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "terblokir", httpStatus: 403 } });
    expect(s.setTanda).not.toHaveBeenCalled();
  });

  it("menolak memasang tanda baru saat TARGET memblokir penanda", async () => {
    const s = store();
    const b = blokirPalsu({ adaBlokir: blokirArah(TARGET, aku.address) });
    const hasil = await setTanda(await masukan(), deps(s, b));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "terblokir", httpStatus: 403 } });
    expect(s.setTanda).not.toHaveBeenCalled();
  });

  /**
   * I1 review akhir. Pemeriksaan pasangan TEPAT dua arah, bukan memuat
   * seluruh himpunan blokir penanda: himpunan itu bisa dibanjiri ribuan
   * baris dari luar, dan satu pasangan cukup dua pencarian primary key.
   */
  it("memeriksa adaBlokir di kedua arah dan tidak memuat himpunanUntuk", async () => {
    const adaBlokir = vi.fn(async () => false);
    const himpunanUntuk = vi.fn(async () => new Set<string>());
    const s = store();
    const hasil = await setTanda(await masukan(), deps(s, blokirPalsu({ adaBlokir, himpunanUntuk })));
    expect(hasil.ok).toBe(true);
    expect(adaBlokir).toHaveBeenCalledTimes(2);
    expect(adaBlokir).toHaveBeenCalledWith(aku.address, TARGET);
    expect(adaBlokir).toHaveBeenCalledWith(TARGET, aku.address);
    expect(himpunanUntuk).not.toHaveBeenCalled();
  });

  /**
   * R5. Mencabut tanda TETAP diizinkan walau terblokir — menolaknya akan
   * memaksa pemblokir membuka blokir hanya untuk menghapus tanda lamanya
   * sendiri, padahal membuka blokir justru memulihkan PERSIS tanda yang ingin
   * dihapusnya.
   */
  it("tetap mengizinkan mencabut tanda saat terblokir", async () => {
    const pesan = { target: TARGET, who: aku.address, ingin: false, expiresAt: EXP };
    const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    const s = store();
    const b = blokirPalsu({ adaBlokir: vi.fn(async () => true) });
    const hasil = await setTanda({ ...pesan, sig }, deps(s, b));
    expect(hasil.ok).toBe(true);
    expect(s.setTanda).toHaveBeenCalledWith(TARGET, aku.address, false);
  });

  /**
   * Mutasi B (Step 7 brief): pemeriksaan `terblokir` HARUS ada SETELAH
   * verifikasi tanda tangan, bukan sebelumnya — kalau tidak, ia jadi orakel
   * yang membocorkan keberadaan blokir ke siapa pun tanpa tanda tangan sah.
   * Tanda tangan di bawah ini SAMPAH (bukan sekadar tanda tangan orang lain),
   * jadi hasilnya wajib `bad_signature`, bukan `terblokir`, walau pasangannya
   * memang terblokir.
   */
  it("tanda tangan sampah tetap ditolak bad_signature walau terblokir (bukan orakel)", async () => {
    const s = store();
    const adaBlokir = vi.fn(async () => true);
    const b = blokirPalsu({ adaBlokir });
    const hasil = await setTanda(
      { target: TARGET, who: aku.address, ingin: true, expiresAt: EXP, sig: "0xbukan" as Hex },
      deps(s, b),
    );
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(s.setTanda).not.toHaveBeenCalled();
    expect(adaBlokir).not.toHaveBeenCalled();
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

  /**
   * Task 10: himpunan blokir pemanggil dibaca SEKALI lalu diteruskan sebagai
   * `kecuali` ke KEDUA arah (`tandaOleh` dan `tandaKe`) — bukan dibaca ulang
   * per metode.
   */
  it("meneruskan himpunan blokir pemanggil sebagai kecuali ke tandaOleh dan tandaKe", async () => {
    const s = store();
    const himpunanUntuk = vi.fn(async () => new Set(["0xblok1", "0xblok2"]));
    const b = blokirPalsu({ himpunanUntuk });
    await daftarKecocokan(aku.address, deps(s, b));
    expect(himpunanUntuk).toHaveBeenCalledTimes(1);
    expect(himpunanUntuk).toHaveBeenCalledWith(aku.address);
    expect(s.tandaOleh).toHaveBeenCalledWith(
      aku.address, expect.arrayContaining(["0xblok1", "0xblok2"]),
    );
    expect(s.tandaKe).toHaveBeenCalledWith(
      aku.address, expect.arrayContaining(["0xblok1", "0xblok2"]),
    );
  });
});
