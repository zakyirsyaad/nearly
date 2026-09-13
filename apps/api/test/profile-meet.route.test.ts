import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { inginBertemuTypedData, lihatProfilTypedData } from "@nearly/shared";
import { profileRoutes } from "../src/routes/profile";
import type { BlokirStore, MeetStore } from "../src/ports";
import { duniaBlokir } from "./support/dunia-blokir";

const aku = privateKeyToAccount(`0x${"55".repeat(32)}` as Hex);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const TARGET = "0x000000000000000000000000000000000000dead" as Address;
const NOW = 1_800_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);

function meetStore(over: Partial<MeetStore> = {}): MeetStore {
  return {
    setTanda: vi.fn(async () => {}),
    hitungTanda: vi.fn(async () => 7),
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

function app(meet: MeetStore, blokir: BlokirStore = blokirPalsu()) {
  const deps = {
    profiles: {
      listConnections: vi.fn(async () => []),
      countConnections: vi.fn(async () => 3),
      getDisplayName: vi.fn(async () => "Andi"),
    },
    identity: { ensName: vi.fn(async () => null), txCount: vi.fn(async () => 0) },
    meet,
    blokir,
    verifyingContract: KONTRAK,
    nowMs: () => NOW,
  };
  const a = new Hono();
  a.route("/", profileRoutes(deps as never));
  return a;
}

async function buktiBaca(over: Record<string, string> = {}) {
  const pesan = { target: TARGET, who: aku.address, expiresAt: EXP };
  const sig = await aku.signTypedData(lihatProfilTypedData(pesan, KONTRAK));
  const q = new URLSearchParams({
    who: aku.address, expiresAt: EXP.toString(), sig, ...over,
  });
  return `/profile/${TARGET}?${q.toString()}`;
}

describe("GET /profile/:address — angka publik", () => {
  it("inginBertemuCount SELALU keluar, tanpa bukti apa pun", async () => {
    const res = await app(meetStore()).request(`/profile/${TARGET}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ inginBertemuCount: 7 });
  });

  /**
   * Store mati BUKAN "nol orang". Layar profil mencetak angka ini sebagai
   * "0 orang ingin bertemu dia" — klaim faktual tentang orang lain, lahir
   * dari store yang sedang tersendat. Klien sudah merender ketiadaan kunci
   * ini dengan benar (tidak menampilkan apa-apa), jadi kegagalan harus
   * MENGHILANGKAN kuncinya, bukan mengarang nol.
   */
  it("kunci HILANG kalau store gagal, bukan jadi 0", async () => {
    const s = meetStore({
      hitungTanda: vi.fn(async () => { throw new Error("store mati"); }),
    });
    const res = await app(s).request(`/profile/${TARGET}`);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(json, "inginBertemuCount")).toBe(false);
    expect(json.inginBertemuCount).toBeUndefined();
    // Sisa profil publiknya tetap keluar — kegagalan satu angka tidak boleh
    // menjatuhkan seluruh layar.
    expect(json.address).toBe(TARGET.toLowerCase());
    expect(json.connectionCount).toBe(3);
  });

  it("0 sungguhan tetap keluar sebagai 0", async () => {
    const res = await app(meetStore({ hitungTanda: vi.fn(async () => 0) }))
      .request(`/profile/${TARGET}`);
    const json = await res.json() as Record<string, unknown>;
    expect(json.inginBertemuCount).toBe(0);
  });

  /**
   * R6 (putusan pengawas atas brief Task 10). Pembacaan himpunan blokir DI
   * DALAM rantai yang sama dengan `hitungTanda`, bukan `.catch()` sendiri
   * yang jatuh ke himpunan kosong: himpunan kosong berarti TIDAK ADA yang
   * disaring, jadi kegagalan store blokir akan mengarang angka publik yang
   * ikut menghitung tanda dari orang yang memblokir `addr` — bukan sekadar
   * kunci yang hilang. Sejak C2 himpunan itu `pemblokirUntuk`, bukan
   * `himpunanUntuk`; aturannya tetap.
   */
  it("kunci HILANG kalau pemblokirUntuk gagal, bukan jatuh ke himpunan kosong", async () => {
    const hitungTanda = vi.fn(async () => 7);
    const s = meetStore({ hitungTanda });
    const blokir = blokirPalsu({
      pemblokirUntuk: vi.fn(async () => { throw new Error("blokir mati"); }),
    });
    const res = await app(s, blokir).request(`/profile/${TARGET}`);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(json, "inginBertemuCount")).toBe(false);
    // hitungTanda TIDAK PERNAH dipanggil — membuktikan kedua await berada
    // dalam SATU rantai yang sama, bukan dipanggil terlepas dengan fallback
    // himpunan kosong yang membuat hitungTanda tetap jalan dan mengarang
    // angka.
    expect(hitungTanda).not.toHaveBeenCalled();
  });

  /**
   * Membalikkan angka publik ke `hitungTanda(addr, [])` akan tetap lolos
   * tes yang tidak memeriksa ARGUMEN kedua `hitungTanda`. Tes ini memasang
   * mata-mata pada kedua pembaca blokir DAN `hitungTanda`: yang diteruskan
   * wajib himpunan PEMBLOKIR `addr`, dan himpunan dua arah `addr` tidak
   * boleh dibaca sama sekali untuk angka ini (C2).
   */
  it("hitungTanda menerima pemblokirUntuk(addr), bukan array kosong dan bukan himpunan dua arah", async () => {
    const hitungTanda = vi.fn(async (_t: Address, _k: readonly string[]) => 7);
    const pemblokirUntuk = vi.fn(async (_addr: Address) => new Set(["0xblok1", "0xblok2"]));
    const himpunanUntuk = vi.fn(async (_addr: Address) => new Set(["0xdua-arah"]));
    const blokir = blokirPalsu({ pemblokirUntuk, himpunanUntuk });
    const res = await app(meetStore({ hitungTanda }), blokir).request(`/profile/${TARGET}`);
    expect(res.status).toBe(200);
    expect(pemblokirUntuk).toHaveBeenCalledWith(TARGET.toLowerCase());
    expect(himpunanUntuk).not.toHaveBeenCalled();
    expect(hitungTanda).toHaveBeenCalledWith(
      TARGET.toLowerCase(), expect.arrayContaining(["0xblok1", "0xblok2"]),
    );
    expect(hitungTanda.mock.calls[0]?.[1]).not.toContain("0xdua-arah");
  });

  it("medan lama tidak berubah", async () => {
    const res = await app(meetStore()).request(`/profile/${TARGET}`);
    const json = await res.json() as Record<string, unknown>;
    for (const k of ["address", "displayName", "ens", "txCount", "connectionCount"]) {
      expect(json).toHaveProperty(k);
    }
  });
});

describe("GET /profile/:address — bendera pribadi", () => {
  /**
   * INTI TASK INI. Tanpa bukti, siapa pun bisa menanyakan satu alamat demi
   * satu alamat dan memetakan siapa menginginkan siapa — membatalkan
   * anonimitas yang jadi syarat fitur (spec induk §7.6).
   */
  it("TIDAK keluar tanpa tanda tangan sama sekali", async () => {
    const res = await app(meetStore({ adaTanda: vi.fn(async () => true) }))
      .request(`/profile/${TARGET}?who=${aku.address}`);
    const json = await res.json() as Record<string, unknown>;
    expect(json.sudahKutandai).toBeUndefined();
    expect(json.salingMenandai).toBeUndefined();
  });

  it("keluar dengan bukti LihatProfil yang sah", async () => {
    const s = meetStore({ adaTanda: vi.fn(async () => true) });
    const res = await app(s).request(await buktiBaca());
    const json = await res.json() as Record<string, unknown>;
    expect(json.sudahKutandai).toBe(true);
    expect(json.salingMenandai).toBe(true);
  });

  /**
   * Task 10. Himpunan blokir PEMANGGIL (bukan `addr`) dibaca sekali lalu
   * diteruskan ke KEDUA panggilan `adaTanda`. Ini yang membuat
   * `diaMenandaiku` (dan karenanya `salingMenandai`) jatuh ke false untuk
   * pasangan yang terblokir — `sudahKutandai` sendiri tetap tidak berubah
   * (menyaring kolom `who` dengan himpunan pemanggil sendiri adalah no-op,
   * lihat komentar di dekat `sudahKutandai` di routes/profile.ts) karena
   * baris itu memang masih ada dan pemanggil (si pemblokir) tetap boleh
   * mencabutnya (R5).
   */
  it("meneruskan himpunan blokir pemanggil ke sudahKutandai dan diaMenandaiku", async () => {
    const adaTanda = vi.fn(async () => true);
    const himpunanUntuk = vi.fn(async (_who: Address) => new Set(["0xblok"]));
    const blokir = blokirPalsu({ himpunanUntuk });
    const res = await app(meetStore({ adaTanda }), blokir).request(await buktiBaca());
    expect(res.status).toBe(200);
    // HANYA SEKALI untuk satu permintaan, untuk pemanggil, diteruskan ke
    // KEDUA panggilan adaTanda di bawah — bukan dibaca ulang per metode.
    // Angka publik tidak ikut membacanya lagi sejak C2 (ia memakai
    // `pemblokirUntuk(addr)`).
    expect(himpunanUntuk).toHaveBeenCalledTimes(1);
    expect(himpunanUntuk).toHaveBeenCalledWith(aku.address.toLowerCase());
    expect(adaTanda).toHaveBeenCalledWith(
      TARGET.toLowerCase(), aku.address.toLowerCase(), expect.arrayContaining(["0xblok"]),
    );
    expect(adaTanda).toHaveBeenCalledWith(
      aku.address.toLowerCase(), TARGET.toLowerCase(), expect.arrayContaining(["0xblok"]),
    );
  });

  /**
   * R6 (putusan pengawas). Bendera pribadi HANYA keluar setelah pemanggil
   * membuktikan dirinya, jadi kegagalan store blokir di sini BOLEH menjadi
   * 500 — beda dari angka publik di atas, tidak boleh diam-diam disaring
   * dengan himpunan kosong (yang akan menyingkap `sudahKutandai`/
   * `salingMenandai` yang seharusnya tersaring untuk pasangan terblokir).
   */
  it("500 kalau himpunanUntuk blokir gagal untuk bendera pribadi, bukan disaring kosong", async () => {
    const blokir = blokirPalsu({
      himpunanUntuk: vi.fn(async () => { throw new Error("blokir mati"); }),
    });
    const res = await app(meetStore({ adaTanda: vi.fn(async () => true) }), blokir)
      .request(await buktiBaca());
    expect(res.status).toBe(500);
  });

  it("membedakan sudahKutandai dari salingMenandai", async () => {
    // Aku menandai dia, dia belum menandaiku.
    const s = meetStore({
      adaTanda: vi.fn(async (target: Address) =>
        target.toLowerCase() === TARGET.toLowerCase()),
    });
    const res = await app(s).request(await buktiBaca());
    const json = await res.json() as Record<string, unknown>;
    expect(json.sudahKutandai).toBe(true);
    expect(json.salingMenandai).toBe(false);
  });

  /**
   * Task 13. `sudahKublokir` adalah bendera pribadi ketiga — siapa memblokir
   * siapa bukan informasi publik, jadi kuncinya harus HILANG tanpa bukti,
   * bukan `false` (yang adalah klaim, bukan ketiadaan jawaban).
   */
  it("sudahKublokir TIDAK keluar tanpa bukti", async () => {
    const blokir = blokirPalsu({ adaBlokir: vi.fn(async () => true) });
    const res = await app(meetStore(), blokir)
      .request(`/profile/${TARGET}?who=${aku.address}`);
    const json = await res.json() as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(json, "sudahKublokir")).toBe(false);
    expect(json.sudahKublokir).toBeUndefined();
  });

  /**
   * `adaBlokir` cuma satu arah: "apakah blocker memblokir blocked". Server
   * mencatat penanda tangan sebagai blocker, jadi `sudahKublokir` harus
   * memanggil `adaBlokir(pemanggil, addr)` — dalam urutan itu — bukan
   * sebaliknya.
   */
  it("sudahKublokir true kalau pemanggil memblokir addr, dan adaBlokir dipanggil (pemanggil, addr)", async () => {
    const adaBlokir = vi.fn(async () => true);
    const res = await app(meetStore(), blokirPalsu({ adaBlokir })).request(await buktiBaca());
    const json = await res.json() as Record<string, unknown>;
    expect(json.sudahKublokir).toBe(true);
    expect(adaBlokir).toHaveBeenCalledWith(aku.address.toLowerCase(), TARGET.toLowerCase());
  });

  /**
   * Kebalikannya: kalau HANYA `addr` yang memblokir pemanggil (bukan
   * sebaliknya), `sudahKublokir` harus `false` — "aku memblokir dia" itu
   * pertanyaan berbeda dari "dia memblokir aku", dan bertukar arah di sini
   * akan membuat korban blokir sepihak melihat tombol "Cabut blokir" untuk
   * blokir yang tidak pernah ia pasang.
   */
  it("sudahKublokir false kalau hanya addr yang memblokir pemanggil (arah terbalik)", async () => {
    const adaBlokir = vi.fn(async (blocker: Address, blocked: Address) =>
      blocker.toLowerCase() === TARGET.toLowerCase()
      && blocked.toLowerCase() === aku.address.toLowerCase());
    const res = await app(meetStore(), blokirPalsu({ adaBlokir })).request(await buktiBaca());
    const json = await res.json() as Record<string, unknown>;
    expect(json.sudahKublokir).toBe(false);
  });

  it("TIDAK keluar untuk tanda tangan orang lain", async () => {
    const lain = privateKeyToAccount(`0x${"66".repeat(32)}` as Hex);
    const pesan = { target: TARGET, who: aku.address, expiresAt: EXP };
    const sig = await lain.signTypedData(lihatProfilTypedData(pesan, KONTRAK));
    const res = await app(meetStore()).request(await buktiBaca({ sig }));
    expect((await res.json() as Record<string, unknown>).sudahKutandai).toBeUndefined();
  });

  it("TIDAK keluar untuk tanda tangan kedaluwarsa", async () => {
    const lampau = BigInt(Math.floor(NOW / 1000) - 1);
    const pesan = { target: TARGET, who: aku.address, expiresAt: lampau };
    const sig = await aku.signTypedData(lihatProfilTypedData(pesan, KONTRAK));
    const res = await app(meetStore())
      .request(await buktiBaca({ expiresAt: lampau.toString(), sig }));
    expect((await res.json() as Record<string, unknown>).sudahKutandai).toBeUndefined();
  });

  /**
   * INVARIAN Ruling 23. `InginBertemu` adalah perintah TULIS; kalau ia sah
   * sebagai bukti baca, arah sebaliknya juga akan tergoda untuk disamakan —
   * dan tanda tangan baca yang bocor bisa dipakai menandai atas nama korban.
   */
  it("TIDAK keluar untuk tanda tangan InginBertemu", async () => {
    const sig = await aku.signTypedData(inginBertemuTypedData(
      { target: TARGET, who: aku.address, ingin: true, expiresAt: EXP }, KONTRAK));
    const res = await app(meetStore()).request(await buktiBaca({ sig }));
    expect((await res.json() as Record<string, unknown>).sudahKutandai).toBeUndefined();
  });

  /**
   * Ini persis replay yang dicegah field `target` di LihatProfil. Bukti ini
   * sah di segala hal lain — penanda tangan benar (aku), `who` benar, belum
   * kedaluwarsa — dan HANYA `target`-nya yang beda dari profil yang diminta.
   * `target` juga disertakan di query (menyamai pesan yang ditandatangani)
   * untuk membuktikan rute TIDAK PERNAH memakai `target` bawaan pemanggil
   * sendiri — ia wajib memakai alamat dari parameter rute (`addr`). Kalau
   * rute merekonstruksi pesan pakai `q.target`, satu tanda tangan ini akan
   * membuka bendera pribadi di profil siapa pun, cukup dengan menyertakan
   * `target` yang cocok dengan yang ditandatangani di query string.
   */
  it("bukti untuk target lain TIDAK berlaku di profil ini — replay silang ditolak", async () => {
    const TARGET_LAIN = "0x000000000000000000000000000000000000cafe" as Address;
    const pesan = { target: TARGET_LAIN, who: aku.address, expiresAt: EXP };
    const sig = await aku.signTypedData(lihatProfilTypedData(pesan, KONTRAK));
    const q = new URLSearchParams({
      who: aku.address, expiresAt: EXP.toString(), sig, target: TARGET_LAIN,
    });
    const res = await app(meetStore({ adaTanda: vi.fn(async () => true) }))
      .request(`/profile/${TARGET}?${q.toString()}`);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.inginBertemuCount).toBe(7);
    expect(json.sudahKutandai).toBeUndefined();
    expect(json.salingMenandai).toBeUndefined();
  });

  /**
   * Rute profil tidak boleh GAGAL untuk orang asing yang membuka tautan
   * (spec §5.1). Ini sengaja berbeda dari GET /kecocokan yang menolak 403.
   */
  it("tanda tangan cacat bentuknya tetap 200, bukan galat", async () => {
    const res = await app(meetStore()).request(await buktiBaca({ sig: "0xbukan" }));
    expect(res.status).toBe(200);
    expect((await res.json() as Record<string, unknown>).inginBertemuCount).toBe(7);
  });

  /**
   * `0x` + 130 digit hex valid secara panjang tapi rusak isinya — jalur viem
   * yang berbeda dari `"0xbukan"` di atas (recovery `v` tidak valid, bukan
   * gagal parse hex). Bentuk tanda tangan yang sama persis pernah lolos jadi
   * bug produksi 500 di Task 8 fase ini (recover yang tak terbungkus
   * try/catch). Di sini juga harus tetap 200 dengan angka publik saja.
   */
  it("tanda tangan panjang sah tapi isinya rusak tetap 200, bukan galat", async () => {
    const sigRusak = ("0x" + "9".repeat(130)) as Hex;
    const res = await app(meetStore()).request(await buktiBaca({ sig: sigRusak }));
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, unknown>;
    expect(json.inginBertemuCount).toBe(7);
    expect(json.sudahKutandai).toBeUndefined();
    expect(json.salingMenandai).toBeUndefined();
  });
});

/**
 * C2 review akhir — INVARIAN, diuji lewat rute dengan dunia yang membedakan
 * kedua arah blokir.
 *
 * Serangannya: X membaca angka publiknya sendiri (n), memblokir B, membaca
 * lagi. Kalau angkanya n−1, B pernah diam-diam menandai X — lalu X mencabut
 * blokirnya tanpa jejak. Keputusan pemilik: "hanya sisi yang diblokir". Angka
 * publik T hanya membuang tanda dari orang yang MEMBLOKIR T; tindakan blokir
 * T sendiri tidak pernah menggerakkan angka T.
 */
describe("GET /profile/:address — angka publik tidak jadi oracle blokir (C2)", () => {
  const X = "0x00000000000000000000000000000000000000a1" as Address;
  const B = "0x00000000000000000000000000000000000000b2" as Address;
  const C = "0x00000000000000000000000000000000000000c3" as Address;

  async function angka(a: Hono, siapa: Address) {
    const json = await (await a.request(`/profile/${siapa}`)).json() as Record<string, unknown>;
    return json.inginBertemuCount;
  }

  it("(a) X memblokir B yang pernah menandai X → angka publik X TIDAK berubah", async () => {
    const d = duniaBlokir({ tanda: [{ who: B, target: X }, { who: C, target: X }] });
    const a = app(d.meet, d.blokir);
    const sebelum = await angka(a, X);
    d.pasangBlokir(X, B);
    const sesudah = await angka(a, X);
    expect(sebelum).toBe(2);
    expect(sesudah).toBe(2);
  });

  it("(b) B memblokir X → tanda dari pemblokir X dibuang dari angka publik X", async () => {
    const d = duniaBlokir({ tanda: [{ who: B, target: X }, { who: C, target: X }] });
    const a = app(d.meet, d.blokir);
    expect(await angka(a, X)).toBe(2);
    d.pasangBlokir(B, X);
    expect(await angka(a, X)).toBe(1);
  });

  it("tanda X ke B berhenti terhitung di angka publik B saat X memblokir B", async () => {
    const d = duniaBlokir({ tanda: [{ who: X, target: B }] });
    const a = app(d.meet, d.blokir);
    expect(await angka(a, B)).toBe(1);
    d.pasangBlokir(X, B);
    expect(await angka(a, B)).toBe(0);
  });
});
