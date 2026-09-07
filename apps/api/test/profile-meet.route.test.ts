import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { inginBertemuTypedData, lihatProfilTypedData } from "@nearly/shared";
import { profileRoutes } from "../src/routes/profile";
import type { MeetStore } from "../src/ports";

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

function app(meet: MeetStore) {
  const deps = {
    profiles: {
      listConnections: vi.fn(async () => []),
      countConnections: vi.fn(async () => 3),
      getDisplayName: vi.fn(async () => "Andi"),
    },
    identity: { ensName: vi.fn(async () => null), txCount: vi.fn(async () => 0) },
    meet,
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
