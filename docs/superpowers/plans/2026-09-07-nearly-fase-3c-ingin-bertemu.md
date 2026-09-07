# Fase 3c — "Ingin Bertemu" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun penanda "ingin bertemu" beserta angka publiknya, pengungkapan saat dua orang saling menandai, dan loop yang menyambungkannya ke event.

**Architecture:** Penanda hidup di satu tabel dengan primary key `(target, who)`; mencabut adalah penghapusan baris. Kecocokan tidak disimpan — ia adalah irisan dua arah, dihitung oleh fungsi murni. Membaca bendera pribadi butuh tanda tangan bukti baca, karena "X menandai Y" tidak publik di mana pun. Tidak ada bagian fase ini yang menyentuh blockchain.

**Tech Stack:** pnpm monorepo · TypeScript strict · Hono · Supabase (service role) · viem (EIP-712) · Zod · Vitest · Expo Router / React Native

**Spec:** `docs/superpowers/specs/2026-09-07-nearly-fase-3c-ingin-bertemu-design.md`

## Global Constraints

- **`packages/trust` TIDAK BOLEH DISENTUH.** Dibuktikan `git diff --stat <base>..HEAD -- packages/trust` kosong (spec §13.5).
- **`recomputeTrust` TIDAK dipanggil dari rute mana pun di fase ini** (spec §9). Menandai bukan bertemu.
- **Tidak ada bagian fase ini yang menyentuh blockchain** — tanpa kontrak, transaksi, maupun relayer (spec §2.3).
- **Keempat tipe EIP-712 baru tidak boleh punya pasangan typehash di Solidity mana pun** (spec §5).
- Setelah fase ini aplikasi punya **sembilan belas** tipe EIP-712, dan tidak satu pun boleh bertabrakan (spec §5.2).
- Domain EIP-712: `{ name: "Nearly", version: "1", chainId: 97, verifyingContract: <ConnectionRegistry> }`.
- **Tidak ada penyaring bot** — semua tap dihitung (spec §2.2).
- **Mencabut tanda menurunkan angka** (spec §2.1).
- **Menandai diri sendiri ditolak di gerbang**, bukan hanya di database (spec §13.7).
- `GET /profile/:address` — bendera pribadi hanya keluar dengan bukti `LihatProfil`; tanda tangan cacat **bukan galat** (spec §5.1).
- `GET /kecocokan` **menolak 403** tanpa bukti sah — bukan mengembalikan daftar kosong (spec §6.2).
- Loop event hanya **angka**, tidak pernah daftar nama (spec §4.3).
- RLS menyala di tabel baru, **tanpa policy**.
- Semua teks yang terlihat pengguna berbahasa Indonesia.

---

## Struktur Berkas

| Berkas | Tanggung jawab |
|---|---|
| `packages/shared/src/meet.ts` | Empat tipe EIP-712 + recover |
| `packages/shared/src/schema.ts` (ubah) | Skema Zod permintaan meet |
| `packages/shared/src/index.ts` (ubah) | Ekspor `./meet` |
| `supabase/migrations/0005_meet.sql` | Tabel `ingin_bertemu` + kolom `cocok_dilihat_at` |
| `apps/api/src/ports.ts` (ubah) | `Tanda`, `Kecocokan`, `MeetStore`, `MeetDeps`; `EventStore.rsvpAddresses` |
| `apps/api/src/meet-rank.ts` | Fungsi murni: kecocokan, lencana, irisan |
| `apps/api/src/meet-gate.ts` | Gerbang tandai/cabut, tandai-dilihat, daftar kecocokan |
| `apps/api/src/meet-store.ts` | Akses Supabase |
| `apps/api/src/routes/meet.ts` | Tiga endpoint |
| `apps/api/src/routes/profile.ts` (ubah) | Tiga medan + bukti baca `LihatProfil` |
| `apps/api/src/routes/events.ts` (ubah) | Dua angka loop di cabang terbukti |
| `apps/api/src/event-store.ts` (ubah) | `rsvpAddresses` |
| `apps/api/src/app.ts`, `index.ts` (ubah) | Perakitan |
| `apps/mobile/src/meet-api.ts` | Pembangun bukti baca + pembacaan kecocokan |
| `apps/mobile/src/meet-actions.ts` | Satu-satunya tempat `InginBertemu` ditandatangani |
| `apps/mobile/src/messages.ts` (ubah) | `meetErrorMessage` |
| `apps/mobile/app/kecocokan.tsx` | Layar kecocokan |
| `apps/mobile/app/index.tsx` (ubah) | Tautan berlencana |
| `apps/mobile/app/feed/index.tsx` (ubah) | Tombol + tautan profil |
| `apps/mobile/app/profile/[address].tsx` (ubah) | Angka + tombol |
| `apps/mobile/app/events/[id].tsx` (ubah) | Dua baris loop |
| `docs/superpowers/specs/2026-09-03-nearly-design.md` (ubah) | Perbaiki dua kalimat §7.6 |

---

## Task 1: Empat tipe EIP-712 meet

**Files:**
- Create: `packages/shared/src/meet.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/test/meet.test.ts`, `packages/shared/test/typehash-semua.test.ts`

**Interfaces:**
- Consumes: `NEARLY_CHAIN_ID` dari `packages/shared/src/handshake.ts`.
- Produces:
  - `type InginBertemuMessage = { target: Address; who: Address; ingin: boolean; expiresAt: bigint }`
  - `type LihatProfilMessage = { target: Address; who: Address; expiresAt: bigint }`
  - `type LihatKecocokanMessage = { who: Address; expiresAt: bigint }`
  - `type TandaiDilihatMessage = { who: Address; expiresAt: bigint }`
  - `inginBertemuTypedData`, `lihatProfilTypedData`, `lihatKecocokanTypedData`, `tandaiDilihatTypedData`
  - `recoverInginBertemuSigner`, `recoverLihatProfilSigner`, `recoverLihatKecocokanSigner`, `recoverTandaiDilihatSigner`
  - `MEET_TYPES`

**Kenapa empat tipe terpisah — ini jantung task.** `LihatProfil` dan `LihatKecocokan` adalah bukti **BACA**; `InginBertemu` dan `TandaiDilihat` adalah perintah **TULIS**.

Perhatikan khusus pasangan `LihatKecocokan` dan `TandaiDilihat`: **bentuk fieldnya IDENTIK** (`{ who, expiresAt }`), dan hanya nama tipenya yang memisahkan bukti baca dari perintah tulis. Itu bukan kecerobohan — itu justru pelajaran Ruling 23 dipakai dengan sengaja. Kalau keduanya digabung jadi satu tipe, tanda tangan baca yang bocor lewat query string bisa dipakai menghapus lencana kecocokan orang lain, menyembunyikan dari mereka bahwa seseorang baru saja saling menandai. Kalau bukti baca sah sebagai perintah tulis, tanda tangan yang berkeliaran di query string — log akses, proxy, siapa pun yang membaca URL dalam masa berlakunya — bisa dipakai **menandai orang atas nama korban**, dan menandai bisa memicu pengungkapan identitas. Ini kelas kesalahan Ruling 23 dari Fase 3a, dan di fase ini taruhannya paling tinggi.

- [ ] **Step 1: Tulis tes yang gagal**

`packages/shared/test/meet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  inginBertemuTypedData, lihatKecocokanTypedData, lihatProfilTypedData, tandaiDilihatTypedData,
  recoverInginBertemuSigner, recoverLihatKecocokanSigner, recoverLihatProfilSigner,
  recoverTandaiDilihatSigner,
} from "../src/meet";

const aku = privateKeyToAccount(`0x${"aa".repeat(32)}` as Hex);
const lain = privateKeyToAccount(`0x${"bb".repeat(32)}` as Hex);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const TARGET = "0x000000000000000000000000000000000000dead" as Address;
const EXP = 1_800_000_000n;

describe("tanda tangan InginBertemu", () => {
  const pesan = { target: TARGET, who: aku.address, ingin: true, expiresAt: EXP };

  it("memulihkan penanda tangan", async () => {
    const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    expect((await recoverInginBertemuSigner(pesan, sig, KONTRAK)).toLowerCase())
      .toBe(aku.address.toLowerCase());
  });

  // `ingin` bool berarti PENCABUTAN ikut ditandatangani. Tanpa ini, satu tanda
  // tangan bisa dipakai menandai DAN mencabut.
  it("tanda tangan ingin:true TIDAK sah sebagai ingin:false", async () => {
    const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    const cabut = { ...pesan, ingin: false };
    expect((await recoverInginBertemuSigner(cabut, sig, KONTRAK)).toLowerCase())
      .not.toBe(aku.address.toLowerCase());
  });

  // Target ikut ditandatangani: tanda tangan untuk menandai A tidak boleh
  // dipakai menandai B.
  it("target yang ditukar membuat pemulihan meleset", async () => {
    const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    const ditukar = { ...pesan, target: lain.address };
    expect((await recoverInginBertemuSigner(ditukar, sig, KONTRAK)).toLowerCase())
      .not.toBe(aku.address.toLowerCase());
  });
});

describe("tanda tangan LihatProfil", () => {
  const pesan = { target: TARGET, who: aku.address, expiresAt: EXP };

  it("memulihkan penanda tangan", async () => {
    const sig = await aku.signTypedData(lihatProfilTypedData(pesan, KONTRAK));
    expect((await recoverLihatProfilSigner(pesan, sig, KONTRAK)).toLowerCase())
      .toBe(aku.address.toLowerCase());
  });
});

describe("tanda tangan TandaiDilihat", () => {
  const pesan = { who: aku.address, expiresAt: EXP };

  it("memulihkan penanda tangan", async () => {
    const sig = await aku.signTypedData(tandaiDilihatTypedData(pesan, KONTRAK));
    expect((await recoverTandaiDilihatSigner(pesan, sig, KONTRAK)).toLowerCase())
      .toBe(aku.address.toLowerCase());
  });
});

/**
 * INTI TASK INI. `LihatProfil` adalah bukti BACA yang berkeliaran di query
 * string; `InginBertemu` dan `TandaiDilihat` adalah perintah TULIS. Kalau
 * salah satu tes di bawah berubah menjadi "cocok", tanda tangan baca bisa
 * dipakai menandai orang atas nama korban — dan menandai memicu pengungkapan
 * identitas. Kelas kesalahan Ruling 23.
 */
describe("tanda tangan tidak boleh menyeberang antar perintah", () => {
  const dasar = { target: TARGET, who: aku.address, expiresAt: EXP };

  it("LihatProfil TIDAK sah sebagai InginBertemu", async () => {
    const sig = await aku.signTypedData(lihatProfilTypedData(dasar, KONTRAK));
    const tulis = { ...dasar, ingin: true };
    expect((await recoverInginBertemuSigner(tulis, sig, KONTRAK)).toLowerCase())
      .not.toBe(aku.address.toLowerCase());
  });

  it("InginBertemu TIDAK sah sebagai LihatProfil", async () => {
    const sig = await aku.signTypedData(
      inginBertemuTypedData({ ...dasar, ingin: true }, KONTRAK));
    expect((await recoverLihatProfilSigner(dasar, sig, KONTRAK)).toLowerCase())
      .not.toBe(aku.address.toLowerCase());
  });

  it("LihatProfil TIDAK sah sebagai TandaiDilihat", async () => {
    const sig = await aku.signTypedData(lihatProfilTypedData(dasar, KONTRAK));
    expect((await recoverTandaiDilihatSigner(
      { who: aku.address, expiresAt: EXP }, sig, KONTRAK)).toLowerCase())
      .not.toBe(aku.address.toLowerCase());
  });

  it("TandaiDilihat TIDAK sah sebagai InginBertemu", async () => {
    const sig = await aku.signTypedData(
      tandaiDilihatTypedData({ who: aku.address, expiresAt: EXP }, KONTRAK));
    const tulis = { ...dasar, ingin: true };
    expect((await recoverInginBertemuSigner(tulis, sig, KONTRAK)).toLowerCase())
      .not.toBe(aku.address.toLowerCase());
  });

  /**
   * PASANGAN PALING BERBAHAYA. `LihatKecocokan` dan `TandaiDilihat` punya
   * bentuk field IDENTIK — hanya nama tipenya yang memisahkan bukti BACA dari
   * perintah TULIS. Kalau tes ini berubah menjadi "cocok", tanda tangan baca
   * yang bocor lewat query string bisa dipakai menghapus lencana kecocokan
   * orang lain, menyembunyikan dari mereka bahwa seseorang baru saja saling
   * menandai.
   */
  it("LihatKecocokan TIDAK sah sebagai TandaiDilihat", async () => {
    const pesan = { who: aku.address, expiresAt: EXP };
    const sig = await aku.signTypedData(lihatKecocokanTypedData(pesan, KONTRAK));
    expect((await recoverTandaiDilihatSigner(pesan, sig, KONTRAK)).toLowerCase())
      .not.toBe(aku.address.toLowerCase());
  });

  it("TandaiDilihat TIDAK sah sebagai LihatKecocokan", async () => {
    const pesan = { who: aku.address, expiresAt: EXP };
    const sig = await aku.signTypedData(tandaiDilihatTypedData(pesan, KONTRAK));
    expect((await recoverLihatKecocokanSigner(pesan, sig, KONTRAK)).toLowerCase())
      .not.toBe(aku.address.toLowerCase());
  });

  it("LihatKecocokan memulihkan penanda tangannya sendiri", async () => {
    const pesan = { who: aku.address, expiresAt: EXP };
    const sig = await aku.signTypedData(lihatKecocokanTypedData(pesan, KONTRAK));
    expect((await recoverLihatKecocokanSigner(pesan, sig, KONTRAK)).toLowerCase())
      .toBe(aku.address.toLowerCase());
  });
});
```

- [ ] **Step 2: Tulis tes typehash lintas SELURUH aplikasi**

`packages/shared/test/typehash-semua.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { HANDSHAKE_TYPES } from "../src/handshake";
import { VOUCH_TYPES } from "../src/vouch";
import { EVENT_TYPES } from "../src/event";
import { FEED_TYPES } from "../src/feed";
import { MEET_TYPES } from "../src/meet";

type Field = { name: string; type: string };

function encodeType(nama: string, fields: readonly Field[]): string {
  return `${nama}(${fields.map((f) => `${f.type} ${f.name}`).join(",")})`;
}

/**
 * Menyebar kelima keluarga ke SATU objek. Kalau dua keluarga memakai nama
 * tipe yang sama, penyebaran ini diam-diam menelan salah satunya dan
 * jumlahnya turun — itulah yang diperiksa asersi jumlah di bawah.
 *
 * Tabrakan lintas keluarga justru yang paling mungkin lolos, karena tidak ada
 * satu berkas pun yang memuat semuanya.
 */
const SEMUA: Record<string, readonly Field[]> = {
  ...HANDSHAKE_TYPES, ...VOUCH_TYPES, ...EVENT_TYPES, ...FEED_TYPES, ...MEET_TYPES,
};

const JUMLAH_TIPE = 19;

const SOL_DIR = fileURLToPath(new URL("../../contracts/src/", import.meta.url));

describe("typehash seluruh aplikasi", () => {
  it("tidak ada nama tipe yang bertabrakan lintas keluarga", () => {
    const total = Object.keys(HANDSHAKE_TYPES).length + Object.keys(VOUCH_TYPES).length
      + Object.keys(EVENT_TYPES).length + Object.keys(FEED_TYPES).length
      + Object.keys(MEET_TYPES).length;
    expect(total).toBe(JUMLAH_TIPE);
    expect(Object.keys(SEMUA)).toHaveLength(JUMLAH_TIPE);
  });

  it("kesembilan belas encodeType unik", () => {
    const semua = Object.entries(SEMUA).map(([n, f]) => encodeType(n, f));
    expect(new Set(semua).size).toBe(JUMLAH_TIPE);
  });

  // Ketiga tipe meet TIDAK PERNAH naik on-chain (spec §2.3). Typehash-nya di
  // Solidity berarti seseorang mulai mengirimnya ke chain, dan anonimitas yang
  // jadi syarat fitur ini hilang.
  it("tidak ada typehash meet di Solidity mana pun", () => {
    const berkasSol = readdirSync(SOL_DIR).filter((f) => f.endsWith(".sol"));
    expect(berkasSol.length).toBeGreaterThan(0);
    for (const berkas of berkasSol) {
      const sumber = readFileSync(`${SOL_DIR}${berkas}`, "utf8");
      for (const nama of Object.keys(MEET_TYPES)) {
        expect(sumber).not.toContain(`${nama}(`);
      }
    }
  });

  it("encodeType meet persis seperti spec §5", () => {
    expect(encodeType("InginBertemu", MEET_TYPES.InginBertemu))
      .toBe("InginBertemu(address target,address who,bool ingin,uint64 expiresAt)");
    expect(encodeType("LihatProfil", MEET_TYPES.LihatProfil))
      .toBe("LihatProfil(address target,address who,uint64 expiresAt)");
    expect(encodeType("TandaiDilihat", MEET_TYPES.TandaiDilihat))
      .toBe("TandaiDilihat(address who,uint64 expiresAt)");
    expect(encodeType("LihatKecocokan", MEET_TYPES.LihatKecocokan))
      .toBe("LihatKecocokan(address who,uint64 expiresAt)");
  });
});
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/shared test`
Expected: FAIL — `Cannot find module '../src/meet'`

- [ ] **Step 4: Tulis implementasinya**

`packages/shared/src/meet.ts`:

```ts
import { recoverTypedDataAddress, type Address, type Hex } from "viem";
import { NEARLY_CHAIN_ID } from "./handshake";

/**
 * Perintah TULIS: menandai seseorang, atau mencabut tanda itu.
 *
 * `ingin` sengaja bool, bukan dua tipe terpisah: dengan begini PENCABUTAN
 * ikut ditandatangani. Tanpa itu, siapa pun bisa mencabut tanda orang lain
 * lewat badan permintaan.
 *
 * TIDAK PERNAH naik on-chain (spec §2.3) — apa pun yang naik ke chain publik
 * selamanya, dan penanda ini WAJIB anonim.
 */
export type InginBertemuMessage = {
  target: Address;
  who: Address;
  ingin: boolean;
  expiresAt: bigint;
};

/**
 * Bukti BACA yang mengaku sebagai `who`, dipakai HANYA untuk membuka bendera
 * `sudahKutandai` dan `salingMenandai` di GET /profile/:address.
 *
 * Tipe terpisah dari `InginBertemu`, dan itu wajib. Bukti baca berkeliaran di
 * query string — log akses, proxy, siapa pun yang membaca URL dalam masa
 * berlakunya. Kalau ia sah sebagai perintah tulis, tanda tangan yang bocor
 * bisa dipakai MENANDAI ORANG ATAS NAMA KORBAN, dan menandai bisa memicu
 * pengungkapan identitas. Kelas kesalahan Ruling 23 dari Fase 3a.
 */
export type LihatProfilMessage = {
  target: Address;
  who: Address;
  expiresAt: bigint;
};

/**
 * Bukti BACA untuk daftar kecocokan sendiri. TIDAK mengikat `target` karena
 * membaca kecocokanmu sendiri tidak berbicara tentang satu orang tertentu —
 * yang dibuktikan cuma "aku adalah `who`".
 *
 * Bentuk fieldnya IDENTIK dengan `TandaiDilihat` di bawah, dan itu disengaja.
 * Hanya nama tipenya yang memisahkan bukti BACA dari perintah TULIS, dan
 * itulah satu-satunya hal yang mencegah tanda tangan baca yang bocor lewat
 * query string dipakai menghapus lencana kecocokan orang lain.
 */
export type LihatKecocokanMessage = {
  who: Address;
  expiresAt: bigint;
};

/**
 * Perintah TULIS ke baris sendiri: menandai kecocokan sudah dilihat.
 *
 * Tidak memuat `target` sama sekali karena ia tidak berbicara tentang orang
 * lain. Tipe tersendiri, bukan `LihatProfil` yang dipakai ulang — alasan yang
 * sama seperti di atas: kalau bukti baca sah di sini, siapa pun yang
 * menangkapnya bisa menghapus lencana kecocokan orang lain, menyembunyikan
 * dari mereka bahwa seseorang baru saja saling menandai.
 */
export type TandaiDilihatMessage = {
  who: Address;
  expiresAt: bigint;
};

const TYPES = {
  InginBertemu: [
    { name: "target", type: "address" },
    { name: "who", type: "address" },
    { name: "ingin", type: "bool" },
    { name: "expiresAt", type: "uint64" },
  ],
  LihatProfil: [
    { name: "target", type: "address" },
    { name: "who", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
  LihatKecocokan: [
    { name: "who", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
  TandaiDilihat: [
    { name: "who", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const MEET_TYPES = TYPES;

function domain(verifyingContract: Address) {
  return { name: "Nearly", version: "1", chainId: NEARLY_CHAIN_ID, verifyingContract } as const;
}

export function inginBertemuTypedData(msg: InginBertemuMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { InginBertemu: TYPES.InginBertemu },
    primaryType: "InginBertemu",
    message: msg,
  } as const;
}

export function lihatProfilTypedData(msg: LihatProfilMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { LihatProfil: TYPES.LihatProfil },
    primaryType: "LihatProfil",
    message: msg,
  } as const;
}

export function lihatKecocokanTypedData(msg: LihatKecocokanMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { LihatKecocokan: TYPES.LihatKecocokan },
    primaryType: "LihatKecocokan",
    message: msg,
  } as const;
}

export function tandaiDilihatTypedData(msg: TandaiDilihatMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { TandaiDilihat: TYPES.TandaiDilihat },
    primaryType: "TandaiDilihat",
    message: msg,
  } as const;
}

export function recoverInginBertemuSigner(
  msg: InginBertemuMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...inginBertemuTypedData(msg, verifyingContract), signature });
}

export function recoverLihatProfilSigner(
  msg: LihatProfilMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...lihatProfilTypedData(msg, verifyingContract), signature });
}

export function recoverLihatKecocokanSigner(
  msg: LihatKecocokanMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...lihatKecocokanTypedData(msg, verifyingContract), signature });
}

export function recoverTandaiDilihatSigner(
  msg: TandaiDilihatMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...tandaiDilihatTypedData(msg, verifyingContract), signature });
}
```

- [ ] **Step 5: Ekspor dari barrel**

Tambahkan satu baris di akhir `packages/shared/src/index.ts`:

```ts
export * from "./meet";
```

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/shared test && pnpm --filter @nearly/shared typecheck`
Expected: PASS

- [ ] **Step 7: Buktikan tes tabrakan nama benar-benar menggigit**

Berkas ini punya DUA asersi yang menjaga hal berbeda, dan satu mutasi tidak
bisa membuktikan keduanya. Jalankan dua-duanya, kembalikan setiap mutasi
sebelum lanjut, dan jangan commit versi yang bertabrakan.

**Mutasi A — jalur pertumbuhan.** Tambahkan sementara tipe dengan nama yang
BENAR-BENAR belum ada di kelima keluarga (periksa dulu dengan grep). Jalankan
`pnpm --filter @nearly/shared test typehash-semua`. Harapkan: jumlah per
keluarga naik 19→20 DAN `SEMUA` naik 19→20 — dua-duanya merah karena alasan
jujur "sekarang memang ada 20 tipe".

**Mutasi B — jalur tabrakan.** Jangan tambah apa pun. Ganti NAMA satu tipe
yang sudah ada di satu keluarga supaya bertabrakan dengan tipe di keluarga
lain (misalnya `FEED_TYPES.Like` jadi `Rsvp`, yang sudah dipakai
`EVENT_TYPES`). Harapkan: jumlah per keluarga tetap 19 sehingga asersi jumlah
HIJAU, sementara `Object.keys(SEMUA)` turun ke 18 sehingga asersi SEMUA yang
MERAH. Inilah jalur yang membuktikan penjaga tabrakan nama benar-benar
bekerja.

**Jangan pakai nama yang sudah ada sebagai umpan Mutasi A.** Versi rencana
sebelumnya menyuruh menambahkan `Rsvp` ke `MEET_TYPES` — padahal `Rsvp` sudah
ada di `EVENT_TYPES`, jadi mutasi itu diam-diam adalah tabrakan, bukan
pertumbuhan. Yang merah cuma asersi jumlah (19→20); asersi `SEMUA` justru
LULUS, karena spread menimpa `EVENT_TYPES.Rsvp` dan jumlah kunci tetap 19.
Vitest berhenti di `expect` pertama yang gagal, jadi asersi yang seharusnya
diuji tidak pernah dijalankan. Itulah kenapa kedua asersi hidup di blok `it`
terpisah.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/meet.ts packages/shared/src/index.ts packages/shared/test/meet.test.ts packages/shared/test/typehash-semua.test.ts
git commit -m "feat(shared): empat tipe EIP-712 meet dengan pemisah baca-tulis"
```

---

## Task 2: Skema Zod permintaan meet

**Files:**
- Modify: `packages/shared/src/schema.ts`
- Test: `packages/shared/test/schema-meet.test.ts`

**Interfaces:**
- Consumes: helper privat `address`, `signature`, `unixSeconds` yang SUDAH ADA di `schema.ts`.
- Produces: `InginBertemuRequestSchema`, `TandaiDilihatRequestSchema`.

**Dua catatan wajib untuk implementer:**

1. **Jangan memakai `.refine` yang memanggil `BigInt()`.** Zod tetap menjalankan `.refine` walau validasi field sudah gagal — statusnya "dirty", bukan "aborted" — sehingga `BigInt("besok")` melempar `SyntaxError` yang lolos dari `safeParse` dan berubah jadi 500, bukan 400. Kegagalan nyata dari Fase 3a.

2. **Penolakan menandai diri sendiri TIDAK ditaruh di sini.** Spec §13.7 menempatkannya di gerbang (Task 7). Menaruhnya di kedua tempat membuat pemeriksaan di gerbang tidak pernah terjangkau lewat rute, dan kode yang tidak pernah dijalankan adalah kode yang diam-diam membusuk. Satu tempat, dan tempat itu gerbang.

- [ ] **Step 1: Tulis tes yang gagal**

`packages/shared/test/schema-meet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { InginBertemuRequestSchema, TandaiDilihatRequestSchema } from "../src/schema";

const A = `0x${"a".repeat(40)}`;
const B = `0x${"b".repeat(40)}`;
const SIG = `0x${"c".repeat(130)}`;

function tanda(over: Record<string, unknown> = {}) {
  return { target: A, who: B, ingin: true, expiresAt: "1800000000", sig: SIG, ...over };
}

describe("InginBertemuRequestSchema", () => {
  it("menerima permintaan menandai", () => {
    expect(InginBertemuRequestSchema.safeParse(tanda()).success).toBe(true);
  });

  it("menerima permintaan mencabut", () => {
    expect(InginBertemuRequestSchema.safeParse(tanda({ ingin: false })).success).toBe(true);
  });

  // "true" string BUKAN boolean. Tipe EIP-712-nya bool, jadi menerima string
  // menghasilkan digest yang berbeda tanpa suara.
  it("menolak ingin berupa string", () => {
    expect(InginBertemuRequestSchema.safeParse(tanda({ ingin: "true" })).success).toBe(false);
  });

  it("menolak alamat yang bukan heksa 40 digit", () => {
    expect(InginBertemuRequestSchema.safeParse(tanda({ target: "0xbukan" })).success).toBe(false);
  });

  // Penolakan menandai diri sendiri ada di GERBANG (spec §13.7), bukan di
  // sini. Skema sengaja menerimanya supaya pemeriksaan gerbang benar-benar
  // terjangkau lewat rute dan tidak membusuk sebagai kode mati.
  it("MENERIMA target sama dengan who — itu urusan gerbang", () => {
    expect(InginBertemuRequestSchema.safeParse(tanda({ target: A, who: A })).success).toBe(true);
  });

  // Bukan 500. Fase 3a menemukan bahwa refine yang memanggil BigInt() atas
  // masukan bukan angka melempar SyntaxError yang lolos dari safeParse.
  it("menolak expiresAt bukan angka tanpa melempar", () => {
    expect(() => InginBertemuRequestSchema.safeParse(tanda({ expiresAt: "besok" }))).not.toThrow();
    expect(InginBertemuRequestSchema.safeParse(tanda({ expiresAt: "besok" })).success).toBe(false);
  });
});

describe("TandaiDilihatRequestSchema", () => {
  const dasar = { who: A, expiresAt: "1800000000", sig: SIG };

  it("menerima permintaan yang benar", () => {
    expect(TandaiDilihatRequestSchema.safeParse(dasar).success).toBe(true);
  });

  // Tipe TandaiDilihat tidak berbicara tentang orang lain, jadi skemanya pun
  // tidak boleh menuntut target.
  it("tidak menuntut target", () => {
    expect("target" in TandaiDilihatRequestSchema.parse(dasar)).toBe(false);
  });

  it("menolak tanda tangan yang panjangnya salah", () => {
    expect(TandaiDilihatRequestSchema.safeParse({ ...dasar, sig: "0xabc" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/shared test schema-meet`
Expected: FAIL — `InginBertemuRequestSchema is not exported`

- [ ] **Step 3: Tambahkan skema di akhir `packages/shared/src/schema.ts`**

```ts
/**
 * Menandai atau mencabut. `ingin` wajib boolean asli: tipe EIP-712-nya `bool`,
 * dan "true" berupa string akan menghasilkan digest yang berbeda tanpa suara.
 *
 * Skema ini sengaja TIDAK menolak `target === who`. Penolakan menandai diri
 * sendiri ada di gerbang (spec §13.7); menaruhnya di dua tempat membuat
 * pemeriksaan gerbang tidak pernah terjangkau lewat rute.
 */
export const InginBertemuRequestSchema = z.object({
  target: address,
  who: address,
  ingin: z.boolean(),
  expiresAt: unixSeconds,
  sig: signature,
});

/** Tidak memuat `target` — ia tidak berbicara tentang orang lain. */
export const TandaiDilihatRequestSchema = z.object({
  who: address,
  expiresAt: unixSeconds,
  sig: signature,
});
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/shared test && pnpm --filter @nearly/shared typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schema.ts packages/shared/test/schema-meet.test.ts
git commit -m "feat(shared): skema Zod permintaan meet"
```

---

## Task 3: Migrasi `0005_meet.sql`

**Files:**
- Create: `supabase/migrations/0005_meet.sql`

**Interfaces:**
- Produces: tabel `ingin_bertemu` dan kolom `profiles.cocok_dilihat_at`, dipakai Task 6.

**Catatan:** migrasi ini **tidak dijalankan** di task ini — Supabase CLI tidak terpasang di mesin pengembangan. Penerapannya masuk Task 14 bersama verifikasi lapangan, persis seperti `0003_events.sql` dan `0004_feed.sql` di dua fase sebelumnya.

- [ ] **Step 1: Tulis migrasinya**

`supabase/migrations/0005_meet.sql`:

```sql
-- Fase 3c — Penanda "ingin bertemu". Tidak ada bagian fase ini yang menyentuh
-- blockchain: apa pun yang naik ke chain publik selamanya, dan penanda ini
-- WAJIB anonim (spec §2.3).

create table if not exists ingin_bertemu (
  target     text not null references profiles(address) on delete cascade,
  who        text not null references profiles(address) on delete cascade,
  created_at timestamptz not null default now(),
  -- Satu tanda per pasangan. Mencabut adalah PENGHAPUSAN baris, dan angka
  -- publiknya adalah hitungan baris untuk satu target (spec §2.1).
  primary key (target, who),
  -- Menandai diri sendiri tidak berarti apa-apa dan akan mengotori angka.
  -- Lapis kedua; lapis pertamanya ada di gerbang (spec §13.7).
  constraint ingin_bertemu_bukan_diri check (target <> who)
);

-- Kecocokan dan loop event membaca dari KEDUA arah: "siapa yang menandaiku"
-- memakai primary key, "siapa yang kutandai" memakai indeks ini.
create index if not exists ingin_bertemu_who_idx on ingin_bertemu (who);

-- Kecocokan tidak disimpan (spec §4.1), jadi "sudah dilihat" tidak bisa
-- ditempelkan padanya. Satu kolom nullable cukup: lencana menghitung
-- kecocokan yang lebih baru dari nilai ini, dan null berarti semuanya baru.
alter table profiles add column if not exists cocok_dilihat_at timestamptz;

-- RLS menyala tanpa policy, sama seperti setiap tabel lain di proyek ini.
alter table ingin_bertemu enable row level security;
```

- [ ] **Step 2: Periksa bentuk migrasinya**

Run: `grep -c "enable row level security" supabase/migrations/0005_meet.sql`
Expected: `1`

Run: `grep -c "references profiles(address)" supabase/migrations/0005_meet.sql`
Expected: `2`

Run: `grep -n "0-9a-fA-F" supabase/migrations/0005_meet.sql`
Expected: tidak ada hasil — seluruh proyek memakai heksa huruf kecil saja.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_meet.sql
git commit -m "feat(db): migrasi tabel ingin_bertemu dan kolom cocok_dilihat_at"
```

---

## Task 4: Port dan tipe meet

**Files:**
- Modify: `apps/api/src/ports.ts`, `apps/api/src/event-store.ts`
- Test: `apps/api/test/meet-ports.test.ts`

**Interfaces:**
- Produces (dipakai Task 5–10):

```ts
type Tanda      = { address: Address; atMs: number };
type Kecocokan  = { address: Address; sejakMs: number };
type ProfilRingkas = { displayName: string; tier: number };
type MeetStore  = { … sembilan metode, lihat Step 3 … }
type MeetDeps   = { meet: MeetStore; verifyingContract: Address; nowMs: () => number };
```
  plus `EventStore.rsvpAddresses(eventId: Hex): Promise<Address[]>`.

**Kenapa `rsvpAddresses` ditaruh di `EventStore`, bukan `MeetStore`.** Tabel `rsvps` dimiliki fase event, dan store yang membacanya harus store yang memilikinya. Loop event (Task 10) mengambil alamat RSVP dari `EventStore` lalu memotongnya dengan tanda dari `MeetStore` — dua store, satu fungsi murni yang menyatukannya.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/meet-ports.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { METODE_MEET_STORE } from "../src/ports";

/**
 * Tes bentuk, bukan perilaku. Ia ada supaya penambahan atau penghapusan
 * metode di MeetStore menjadi tindakan sadar: setiap fake di tes gerbang
 * harus ikut diperbarui, dan tanpa daftar ini yang gagal cuma typecheck di
 * berkas yang jauh dari sumber perubahan.
 */
describe("bentuk MeetStore", () => {
  it("punya sembilan metode dengan nama yang tepat", () => {
    expect(METODE_MEET_STORE).toEqual([
      "setTanda", "hitungTanda", "adaTanda", "tandaOleh", "tandaKe",
      "cocokDilihatAtMs", "setCocokDilihat", "profilRingkas", "hitungTandaBanyak",
    ]);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test meet-ports`
Expected: FAIL — `METODE_MEET_STORE is not exported`

- [ ] **Step 3: Tambahkan di akhir `apps/api/src/ports.ts`**

```ts
/** Satu tanda: siapa, dan kapan tanda itu dibuat. MILIDETIK. */
export type Tanda = { address: Address; atMs: number };

/**
 * Dua orang saling menandai. `sejakMs` adalah waktu tanda KEDUA dibuat —
 * kecocokan baru ada saat yang kedua menandai.
 */
export type Kecocokan = { address: Address; sejakMs: number };

export type ProfilRingkas = { displayName: string; tier: number };

export type MeetStore = {
  /** `ingin` false berarti MENGHAPUS baris — angka publik ikut turun (spec §2.1). */
  setTanda(target: Address, who: Address, ingin: boolean): Promise<void>;
  hitungTanda(target: Address): Promise<number>;
  adaTanda(target: Address, who: Address): Promise<boolean>;
  /** Yang DITANDAI oleh `who`. */
  tandaOleh(who: Address): Promise<Tanda[]>;
  /** Yang MENANDAI `target`. */
  tandaKe(target: Address): Promise<Tanda[]>;
  cocokDilihatAtMs(who: Address): Promise<number | null>;
  setCocokDilihat(who: Address, atMs: number): Promise<void>;
  profilRingkas(addresses: Address[]): Promise<Map<string, ProfilRingkas>>;
  /** Hitungan tanda untuk BANYAK target sekaligus, dipotong per kelompok. */
  hitungTandaBanyak(targets: Address[]): Promise<Map<string, number>>;
};

/**
 * Daftar nama metode MeetStore, dipakai tes bentuk di meet-ports.test.ts.
 * Menambah metode tanpa memperbarui daftar ini membuat tes itu merah — dan
 * itulah gunanya: setiap fake di tes gerbang harus ikut diperbarui.
 */
export const METODE_MEET_STORE = [
  "setTanda", "hitungTanda", "adaTanda", "tandaOleh", "tandaKe",
  "cocokDilihatAtMs", "setCocokDilihat", "profilRingkas", "hitungTandaBanyak",
] as const;

export type MeetDeps = {
  meet: MeetStore;
  /** Alamat ConnectionRegistry — domain EIP-712 meet terikat padanya (spec §5). */
  verifyingContract: Address;
  nowMs: () => number;
};
```

Lalu tambahkan satu metode ke tipe `EventStore` yang sudah ada, tepat setelah `attendanceSummary`:

```ts
  /**
   * Alamat yang RSVP di satu event. Dipakai loop event (spec §4.3) untuk
   * dipotong dengan himpunan tanda. Tabel `rsvps` dimiliki fase event, jadi
   * store inilah yang membacanya.
   */
  rsvpAddresses(eventId: Hex): Promise<Address[]>;
```

- [ ] **Step 4: Implementasikan `rsvpAddresses` di `apps/api/src/event-store.ts`**

Tambahkan di dalam objek yang dikembalikan `createEventStore`, tepat setelah `attendanceSummary`:

```ts
    async rsvpAddresses(eventId) {
      const { data, error } = await db
        .from("rsvps").select("address").eq("event_id", eventId.toLowerCase());
      if (error) throw new Error(`baca rsvp gagal: ${error.message}`);
      return (data ?? []).map((r) => String(r.address).toLowerCase() as Address);
    },
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test && pnpm --filter @nearly/api typecheck`
Expected: PASS

Kalau `typecheck` mengeluh bahwa fake `EventStore` di berkas tes lain kehilangan `rsvpAddresses`, tambahkan stub `async () => []` di sana. Itu konsekuensi struktural yang diharapkan, bukan penyimpangan — sebutkan di laporan berkas mana saja yang kamu sentuh.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ports.ts apps/api/src/event-store.ts apps/api/test/meet-ports.test.ts
git commit -m "feat(api): port dan tipe meet, plus rsvpAddresses di EventStore"
```

---

## Task 5: Fungsi murni — kecocokan, lencana, irisan

**Files:**
- Create: `apps/api/src/meet-rank.ts`
- Test: `apps/api/test/meet-rank.test.ts`

**Interfaces:**
- Consumes: `Tanda`, `Kecocokan` dari Task 4.
- Produces: `kecocokanDari(tandaOleh: Tanda[], tandaKe: Tanda[]): Kecocokan[]`, `hitungBaru(kecocokan: Kecocokan[], dilihatAtMs: number | null): number`, `irisan(a: readonly string[], b: readonly string[]): number`.

**Kenapa ketiganya murni.** Inilah tiga hal yang sebenarnya bisa salah di fase ini. Kalau mereka hidup di store, satu-satunya cara mengujinya adalah Supabase sungguhan — dan kasus tepi seperti pencabutan di tengah, alamat beda kapitalisasi, atau `cocok_dilihat_at` bernilai `null` tidak akan pernah punya tes.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/meet-rank.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { hitungBaru, irisan, kecocokanDari } from "../src/meet-rank";
import type { Tanda } from "../src/ports";

const A = "0x00000000000000000000000000000000000000aa" as Address;
const B = "0x00000000000000000000000000000000000000bb" as Address;
const C = "0x00000000000000000000000000000000000000cc" as Address;
const T = 1_800_000_000_000;

const tanda = (address: Address, atMs: number): Tanda => ({ address, atMs });

describe("kecocokanDari", () => {
  it("dua orang yang saling menandai menghasilkan satu kecocokan", () => {
    const k = kecocokanDari([tanda(A, T)], [tanda(A, T + 1000)]);
    expect(k).toHaveLength(1);
    expect(k[0]!.address).toBe(A.toLowerCase());
  });

  // Kecocokan baru ADA saat tanda kedua dibuat, bukan yang pertama.
  it("sejakMs adalah waktu tanda yang LEBIH BARU", () => {
    expect(kecocokanDari([tanda(A, T)], [tanda(A, T + 5000)])[0]!.sejakMs).toBe(T + 5000);
    expect(kecocokanDari([tanda(A, T + 5000)], [tanda(A, T)])[0]!.sejakMs).toBe(T + 5000);
  });

  it("menandai satu arah saja bukan kecocokan", () => {
    expect(kecocokanDari([tanda(A, T)], [])).toHaveLength(0);
    expect(kecocokanDari([], [tanda(A, T)])).toHaveLength(0);
  });

  // Inilah yang membuat pencabutan bekerja tanpa kode penghapus: begitu satu
  // baris hilang, irisannya hilang.
  it("pencabutan satu pihak menghilangkan kecocokan", () => {
    const sebelum = kecocokanDari([tanda(A, T)], [tanda(A, T)]);
    const sesudah = kecocokanDari([], [tanda(A, T)]);
    expect(sebelum).toHaveLength(1);
    expect(sesudah).toHaveLength(0);
  });

  it("pencocokan tidak peka besar-kecil huruf", () => {
    const k = kecocokanDari(
      [tanda(A.toUpperCase() as Address, T)], [tanda(A, T)],
    );
    expect(k).toHaveLength(1);
    expect(k[0]!.address).toBe(A.toLowerCase());
  });

  it("mengurutkan yang terbaru lebih dulu", () => {
    const k = kecocokanDari(
      [tanda(A, T), tanda(B, T + 9000)],
      [tanda(A, T), tanda(B, T + 9000)],
    );
    expect(k.map((x) => x.address)).toEqual([B.toLowerCase(), A.toLowerCase()]);
  });

  // Tanpa pemecah seri, urutan dua kecocokan berwaktu sama bergantung urutan
  // masukan — dan itu membuat tes tidak bisa diandalkan.
  it("urutan deterministik untuk waktu yang sama", () => {
    const satu = kecocokanDari([tanda(A, T), tanda(B, T)], [tanda(A, T), tanda(B, T)]);
    const dua = kecocokanDari([tanda(B, T), tanda(A, T)], [tanda(B, T), tanda(A, T)]);
    expect(satu.map((x) => x.address)).toEqual(dua.map((x) => x.address));
  });

  it("himpunan kosong menghasilkan daftar kosong", () => {
    expect(kecocokanDari([], [])).toEqual([]);
  });
});

describe("hitungBaru", () => {
  const k = [
    { address: A, sejakMs: T + 5000 },
    { address: B, sejakMs: T + 1000 },
  ];

  // Belum pernah membuka layar kecocokan: SEMUANYA baru.
  it("dilihatAtMs null berarti semuanya baru", () => {
    expect(hitungBaru(k, null)).toBe(2);
  });

  it("menghitung hanya yang lebih baru dari waktu dilihat", () => {
    expect(hitungBaru(k, T + 2000)).toBe(1);
  });

  it("kecocokan tepat pada waktu dilihat TIDAK dihitung baru", () => {
    expect(hitungBaru(k, T + 5000)).toBe(0);
  });

  it("daftar kosong menghasilkan nol", () => {
    expect(hitungBaru([], null)).toBe(0);
  });
});

describe("irisan", () => {
  it("menghitung alamat yang ada di kedua himpunan", () => {
    expect(irisan([A, B, C], [B, C])).toBe(2);
  });

  it("tidak peka besar-kecil huruf", () => {
    expect(irisan([A.toUpperCase()], [A])).toBe(1);
  });

  // Duplikat di sisi kiri tidak boleh menggandakan hitungan — kalau tidak,
  // angka loop event bisa melebihi jumlah orang yang sebenarnya.
  it("duplikat dihitung sekali", () => {
    expect(irisan([A, A, A], [A])).toBe(1);
  });

  it("himpunan kosong menghasilkan nol", () => {
    expect(irisan([], [A])).toBe(0);
    expect(irisan([A], [])).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test meet-rank`
Expected: FAIL — `Cannot find module '../src/meet-rank'`

- [ ] **Step 3: Tulis implementasinya**

`apps/api/src/meet-rank.ts`:

```ts
import type { Address } from "viem";
import type { Kecocokan, Tanda } from "./ports";

/**
 * Kecocokan adalah IRISAN dua arah, dihitung bukan disimpan (spec §4.1).
 *
 * Konsekuensinya: kalau salah satu mencabut, kecocokannya lenyap dengan
 * sendirinya. Tidak ada tabel yang bisa desinkron dari tanda yang menjadi
 * sumbernya, dan tidak ada jalur kode yang bisa lupa menghapusnya.
 */
export function kecocokanDari(tandaOleh: Tanda[], tandaKe: Tanda[]): Kecocokan[] {
  const balik = new Map<string, number>();
  for (const t of tandaKe) balik.set(t.address.toLowerCase(), t.atMs);

  const keluar: Kecocokan[] = [];
  for (const t of tandaOleh) {
    const a = t.address.toLowerCase();
    const waktuBalik = balik.get(a);
    if (waktuBalik === undefined) continue;
    // Kecocokan baru ADA saat tanda KEDUA dibuat.
    keluar.push({ address: a as Address, sejakMs: Math.max(t.atMs, waktuBalik) });
  }

  // Pemecah seri deterministik — tanpa ini urutan dua kecocokan berwaktu sama
  // bergantung urutan masukan, dan tesnya jadi tidak bisa diandalkan.
  return keluar.sort((x, y) => (y.sejakMs - x.sejakMs) || x.address.localeCompare(y.address));
}

/** `null` berarti layar kecocokan belum pernah dibuka: semuanya baru. */
export function hitungBaru(kecocokan: Kecocokan[], dilihatAtMs: number | null): number {
  if (dilihatAtMs === null) return kecocokan.length;
  return kecocokan.filter((k) => k.sejakMs > dilihatAtMs).length;
}

/**
 * Berapa alamat di `a` yang juga ada di `b`. Dipakai loop event (spec §4.3).
 *
 * Duplikat di `a` dihitung SEKALI — kalau tidak, angka loop bisa melebihi
 * jumlah orang yang sebenarnya.
 */
export function irisan(a: readonly string[], b: readonly string[]): number {
  const himpunanB = new Set(b.map((x) => x.toLowerCase()));
  const sudah = new Set<string>();
  let n = 0;
  for (const x of a) {
    const l = x.toLowerCase();
    if (sudah.has(l)) continue;
    sudah.add(l);
    if (himpunanB.has(l)) n += 1;
  }
  return n;
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test meet-rank && pnpm --filter @nearly/api typecheck`
Expected: PASS

- [ ] **Step 5: Buktikan tes "tanda kedua" benar-benar mengunci**

Ubah sementara `Math.max(t.atMs, waktuBalik)` menjadi `Math.min(...)`, jalankan `pnpm --filter @nearly/api test meet-rank`, dan pastikan tes "sejakMs adalah waktu tanda yang LEBIH BARU" MERAH. Kembalikan setelahnya.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/meet-rank.ts apps/api/test/meet-rank.test.ts
git commit -m "feat(api): fungsi murni kecocokan, lencana, dan irisan"
```

---

## Task 6: `meet-store.ts` — akses Supabase

**Files:**
- Create: `apps/api/src/meet-store.ts`
- Test: `apps/api/test/meet-store-mapping.test.ts`

**Interfaces:**
- Consumes: `MeetStore`, `Tanda`, `ProfilRingkas` dari Task 4; `potongKelompok` dari `apps/api/src/feed-store.ts` (sudah diekspor, `UKURAN_KELOMPOK` = 100).
- Produces: `TandaDbRow`, `rowToTanda`, `createMeetStore(db: SupabaseClient): MeetStore`.

**Dua aturan mengikat:**

1. **JANGAN N+1, dan JANGAN `.in()` tanpa dipotong.** Fase 3b menemukan bahwa `.in()` dengan 500 nilai menghasilkan query string ~33 KB yang ditolak proksi Supabase — feed mati total, dan hanya setelah datanya menumpuk, jadi ia lolos demo lalu gagal belakangan. `potongKelompok` sudah ada dan diekspor dari `feed-store.ts`; pakai itu untuk `profilRingkas` dan `hitungTandaBanyak`.

2. **`ensureProfile` untuk KEDUA alamat.** `ingin_bertemu.target` dan `ingin_bertemu.who` sama-sama foreign key ke `profiles(address)`. Menandai orang yang belum pernah handshake — yang justru kasus paling umum di fitur ini — akan gagal dengan pelanggaran foreign key mentah dari Postgres kalau salah satunya terlewat. Ikuti pola `ensureProfile` di `apps/api/src/event-store.ts` dan `feed-store.ts`.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/meet-store-mapping.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rowToTanda, type TandaDbRow } from "../src/meet-store";
import { potongKelompok } from "../src/feed-store";

describe("rowToTanda", () => {
  const row: TandaDbRow = {
    target: "0x00000000000000000000000000000000000000aa",
    who: "0x00000000000000000000000000000000000000bb",
    created_at: "2026-09-07T10:00:00.000Z",
  };

  it("mengubah created_at menjadi milidetik epoch", () => {
    expect(rowToTanda(row, "who").atMs).toBe(Date.parse("2026-09-07T10:00:00.000Z"));
  });

  // Satu baris dibaca dari DUA arah: saat mencari "siapa yang kutandai" yang
  // menarik adalah `target`; saat mencari "siapa yang menandaiku" yang menarik
  // adalah `who`. Satu pemeta, dua sisi.
  it("mengambil sisi yang diminta", () => {
    expect(rowToTanda(row, "target").address).toBe(row.target);
    expect(rowToTanda(row, "who").address).toBe(row.who);
  });
});

describe("potongKelompok dipakai ulang dari feed-store", () => {
  it("memotong 250 alamat menjadi tiga kelompok maksimal 100", () => {
    const alamat = Array.from({ length: 250 }, (_, i) => `0x${String(i).padStart(40, "0")}`);
    const kelompok = potongKelompok(alamat);
    expect(kelompok).toHaveLength(3);
    for (const k of kelompok) expect(k.length).toBeLessThanOrEqual(100);
    expect(kelompok.flat()).toHaveLength(250);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test meet-store-mapping`
Expected: FAIL — `Cannot find module '../src/meet-store'`

- [ ] **Step 3: Tulis implementasinya**

`apps/api/src/meet-store.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address } from "viem";
import { potongKelompok } from "./feed-store";
import type { MeetStore, ProfilRingkas, Tanda } from "./ports";

export type TandaDbRow = {
  target: string;
  who: string;
  created_at: string;
};

/**
 * Satu baris dibaca dari DUA arah. Saat mencari "siapa yang kutandai" yang
 * menarik adalah kolom `target`; saat mencari "siapa yang menandaiku" yang
 * menarik adalah `who`. Satu pemeta, dua sisi.
 */
export function rowToTanda(row: TandaDbRow, sisi: "target" | "who"): Tanda {
  return {
    address: row[sisi] as Address,
    atMs: Date.parse(row.created_at),
  };
}

export function createMeetStore(db: SupabaseClient): MeetStore {
  async function ensureProfile(address: Address): Promise<void> {
    const { error } = await db
      .from("profiles")
      .upsert({ address: address.toLowerCase() }, { onConflict: "address", ignoreDuplicates: true });
    if (error) throw new Error(`upsert profile gagal: ${error.message}`);
  }

  return {
    async setTanda(target, who, ingin) {
      if (!ingin) {
        const { error } = await db.from("ingin_bertemu").delete()
          .eq("target", target.toLowerCase()).eq("who", who.toLowerCase());
        if (error) throw new Error(`cabut tanda gagal: ${error.message}`);
        return;
      }

      // KEDUA alamat adalah foreign key ke profiles(address). Menandai orang
      // yang belum pernah handshake adalah kasus PALING UMUM di fitur ini —
      // itulah gunanya penanda ini — jadi keduanya wajib dipastikan ada.
      await Promise.all([ensureProfile(target), ensureProfile(who)]);

      const { error } = await db.from("ingin_bertemu").upsert(
        { target: target.toLowerCase(), who: who.toLowerCase() },
        { onConflict: "target,who", ignoreDuplicates: true },
      );
      if (error) throw new Error(`tandai gagal: ${error.message}`);
    },

    async hitungTanda(target) {
      const { count, error } = await db.from("ingin_bertemu")
        .select("*", { count: "exact", head: true })
        .eq("target", target.toLowerCase());
      if (error) throw new Error(`hitung tanda gagal: ${error.message}`);
      return count ?? 0;
    },

    async adaTanda(target, who) {
      const { data, error } = await db.from("ingin_bertemu")
        .select("target")
        .eq("target", target.toLowerCase()).eq("who", who.toLowerCase())
        .maybeSingle();
      if (error) throw new Error(`baca tanda gagal: ${error.message}`);
      return data !== null;
    },

    async tandaOleh(who) {
      const { data, error } = await db.from("ingin_bertemu")
        .select("target, who, created_at").eq("who", who.toLowerCase());
      if (error) throw new Error(`baca tanda keluar gagal: ${error.message}`);
      return (data ?? []).map((r) => rowToTanda(r as TandaDbRow, "target"));
    },

    async tandaKe(target) {
      const { data, error } = await db.from("ingin_bertemu")
        .select("target, who, created_at").eq("target", target.toLowerCase());
      if (error) throw new Error(`baca tanda masuk gagal: ${error.message}`);
      return (data ?? []).map((r) => rowToTanda(r as TandaDbRow, "who"));
    },

    async cocokDilihatAtMs(who) {
      const { data, error } = await db.from("profiles")
        .select("cocok_dilihat_at").eq("address", who.toLowerCase()).maybeSingle();
      if (error) throw new Error(`baca cocok_dilihat_at gagal: ${error.message}`);
      const nilai = (data as { cocok_dilihat_at: string | null } | null)?.cocok_dilihat_at;
      return nilai ? Date.parse(nilai) : null;
    },

    async setCocokDilihat(who, atMs) {
      await ensureProfile(who);
      const { error } = await db.from("profiles")
        .update({ cocok_dilihat_at: new Date(atMs).toISOString() })
        .eq("address", who.toLowerCase());
      if (error) throw new Error(`set cocok_dilihat_at gagal: ${error.message}`);
    },

    /**
     * Dipotong per kelompok 100. Fase 3b menemukan bahwa `.in()` dengan
     * ratusan nilai menghasilkan query string puluhan KB yang ditolak proksi
     * Supabase — mati total, dan hanya setelah datanya menumpuk.
     */
    async profilRingkas(addresses) {
      const unik = [...new Set(addresses.map((a) => a.toLowerCase()))];
      if (unik.length === 0) return new Map();

      const kelompok = potongKelompok(unik);
      const hasil = await Promise.all(kelompok.map((bagian) => Promise.all([
        db.from("profiles").select("address, display_name").in("address", bagian),
        db.from("trust_snapshots").select("address, tier").in("address", bagian),
      ])));

      const nama = new Map<string, string>();
      const tier = new Map<string, number>();
      for (const [p, t] of hasil) {
        if (p.error) throw new Error(`baca profil gagal: ${p.error.message}`);
        if (t.error) throw new Error(`baca tier gagal: ${t.error.message}`);
        for (const r of (p.data ?? []) as { address: string; display_name: string }[]) {
          nama.set(r.address.toLowerCase(), r.display_name);
        }
        for (const r of (t.data ?? []) as { address: string; tier: number }[]) {
          tier.set(r.address.toLowerCase(), r.tier);
        }
      }

      const keluar = new Map<string, ProfilRingkas>();
      for (const a of unik) {
        keluar.set(a, { displayName: nama.get(a) ?? "", tier: tier.get(a) ?? 0 });
      }
      return keluar;
    },

    async hitungTandaBanyak(targets) {
      const unik = [...new Set(targets.map((a) => a.toLowerCase()))];
      if (unik.length === 0) return new Map();

      const kelompok = potongKelompok(unik);
      const hasil = await Promise.all(kelompok.map((bagian) =>
        db.from("ingin_bertemu").select("target").in("target", bagian)));

      const keluar = new Map<string, number>();
      for (const a of unik) keluar.set(a, 0);
      for (const r of hasil) {
        if (r.error) throw new Error(`hitung tanda banyak gagal: ${r.error.message}`);
        for (const baris of (r.data ?? []) as { target: string }[]) {
          const t = baris.target.toLowerCase();
          keluar.set(t, (keluar.get(t) ?? 0) + 1);
        }
      }
      return keluar;
    },
  };
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test meet-store-mapping && pnpm --filter @nearly/api typecheck`
Expected: PASS

- [ ] **Step 5: Buktikan tidak ada `.in()` tanpa dipotong**

Run: `grep -n "\.in(" apps/api/src/meet-store.ts`
Expected: setiap hasil berada di dalam blok `kelompok.map(...)`. Tidak boleh ada `.in()` yang menerima larik utuh tanpa melewati `potongKelompok`.

Run: `grep -cE "insert|update|upsert|delete" apps/api/src/meet-store.ts | head -1` lalu periksa manual: satu-satunya `update` adalah `cocok_dilihat_at`, dan tidak ada satu pun tulis ke `trust_snapshots`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/meet-store.ts apps/api/test/meet-store-mapping.test.ts
git commit -m "feat(api): meet-store Supabase dengan kueri terpotong per kelompok"
```

---

## Task 7: `meet-gate.ts` — gerbang

**Files:**
- Create: `apps/api/src/meet-gate.ts`
- Test: `apps/api/test/meet-gate.test.ts`

**Interfaces:**
- Consumes: `recoverInginBertemuSigner`, `recoverTandaiDilihatSigner` dari `@nearly/shared`; `MeetDeps`, `MeetStore` dari Task 4; `kecocokanDari`, `hitungBaru` dari Task 5.
- Produces: `MeetFailure`, `MeetResult<T>`, `setTanda`, `tandaiDilihat`, `daftarKecocokan`.

**Pola yang ditiru:** `apps/api/src/feed-gate.ts` — tipe kegagalan bertagged `{code, httpStatus}` alih-alih melempar. Baca dulu.

**Dua invarian yang menjadi jantung task ini:**

1. **Menandai diri sendiri ditolak DI SINI** (spec §13.7), bukan hanya oleh check di database. Skema Zod sengaja menerimanya (Task 2) supaya pemeriksaan ini benar-benar terjangkau lewat rute.
2. **`ingin` dipulihkan dari nilai MASUKAN**, bukan nilai karangan server — itulah yang membuat satu tanda tangan tidak bisa dipakai dua arah.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/meet-gate.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { inginBertemuTypedData, lihatProfilTypedData, tandaiDilihatTypedData } from "@nearly/shared";
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
    const target = aku.address.toUpperCase() as Address;
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
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test meet-gate`
Expected: FAIL — `Cannot find module '../src/meet-gate'`

- [ ] **Step 3: Tulis implementasinya**

`apps/api/src/meet-gate.ts`:

```ts
import type { Address, Hex } from "viem";
import { recoverInginBertemuSigner, recoverTandaiDilihatSigner } from "@nearly/shared";
import { hitungBaru, kecocokanDari } from "./meet-rank";
import type { MeetDeps } from "./ports";

export type MeetFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "tandai_diri"; httpStatus: 400 };

export type MeetResult<T> = { ok: true; value: T } | { ok: false; failure: MeetFailure };

const fail = (failure: MeetFailure): { ok: false; failure: MeetFailure } =>
  ({ ok: false, failure });

const sudahLewat = (deps: MeetDeps, expiresAt: bigint) =>
  deps.nowMs() > Number(expiresAt) * 1000;

const samaAlamat = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export type SetTandaInput = {
  target: Address; who: Address; ingin: boolean; expiresAt: bigint; sig: Hex;
};

export async function setTanda(
  input: SetTandaInput, deps: MeetDeps,
): Promise<MeetResult<void>> {
  if (sudahLewat(deps, input.expiresAt)) return fail({ code: "expired", httpStatus: 410 });

  // Spec §13.7: ditolak DI GERBANG, bukan hanya oleh check di database.
  // Skema Zod sengaja menerimanya supaya pemeriksaan ini benar-benar
  // terjangkau lewat rute dan tidak membusuk sebagai kode mati.
  if (samaAlamat(input.target, input.who)) {
    return fail({ code: "tandai_diri", httpStatus: 400 });
  }

  // `ingin` dari MASUKAN, bukan nilai karangan server. Ini yang membuat satu
  // tanda tangan tidak bisa dipakai dua arah.
  //
  // recoverInginBertemuSigner, BUKAN recoverLihatProfilSigner: yang kedua
  // adalah bukti BACA yang berkeliaran di query string, dan kalau ia sah di
  // sini, siapa pun yang menangkapnya bisa menandai orang atas nama korban —
  // lalu menandai memicu pengungkapan identitas. Kelas kesalahan Ruling 23.
  const signer = await recoverInginBertemuSigner(
    {
      target: input.target, who: input.who,
      ingin: input.ingin, expiresAt: input.expiresAt,
    },
    input.sig,
    deps.verifyingContract,
  );
  if (!samaAlamat(signer, input.who)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  await deps.meet.setTanda(input.target, input.who, input.ingin);
  return { ok: true, value: undefined };
}

export type TandaiDilihatInput = { who: Address; expiresAt: bigint; sig: Hex };

export async function tandaiDilihat(
  input: TandaiDilihatInput, deps: MeetDeps,
): Promise<MeetResult<void>> {
  if (sudahLewat(deps, input.expiresAt)) return fail({ code: "expired", httpStatus: 410 });

  const signer = await recoverTandaiDilihatSigner(
    { who: input.who, expiresAt: input.expiresAt },
    input.sig,
    deps.verifyingContract,
  );
  if (!samaAlamat(signer, input.who)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  // Waktu dari server, bukan jam klien: jam perangkat bisa digeser ke masa
  // depan, dan itu akan membungkam lencana selamanya.
  await deps.meet.setCocokDilihat(input.who, deps.nowMs());
  return { ok: true, value: undefined };
}

export type BarisKecocokan = {
  address: Address; displayName: string; tier: number; sejakMs: number;
};

/**
 * TIDAK mengembalikan MeetResult: pemanggilnya (rute) sudah membuktikan
 * `who` lebih dulu, jadi tidak ada kegagalan yang bisa terjadi di sini.
 */
export async function daftarKecocokan(
  who: Address, deps: MeetDeps,
): Promise<{ kecocokan: BarisKecocokan[]; baru: number }> {
  const [oleh, ke, dilihat] = await Promise.all([
    deps.meet.tandaOleh(who),
    deps.meet.tandaKe(who),
    deps.meet.cocokDilihatAtMs(who),
  ]);

  const cocok = kecocokanDari(oleh, ke);
  const profil = await deps.meet.profilRingkas(cocok.map((k) => k.address));

  return {
    kecocokan: cocok.map((k) => {
      const p = profil.get(k.address.toLowerCase());
      return {
        address: k.address,
        displayName: p?.displayName ?? "",
        tier: p?.tier ?? 0,
        sejakMs: k.sejakMs,
      };
    }),
    baru: hitungBaru(cocok, dilihat),
  };
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test meet-gate && pnpm --filter @nearly/api typecheck`
Expected: PASS

- [ ] **Step 5: Buktikan invarian Ruling 23 benar-benar terkunci**

Ganti sementara `recoverInginBertemuSigner` di `setTanda` menjadi `recoverLihatProfilSigner` (buang medan `ingin` dari pesannya agar mengkompilasi). Jalankan `pnpm --filter @nearly/api test meet-gate` dan pastikan tes "tanda tangan LihatProfil TIDAK diterima sebagai perintah menandai" MERAH. Kembalikan setelahnya.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/meet-gate.ts apps/api/test/meet-gate.test.ts
git commit -m "feat(api): gerbang tandai, cabut, dan daftar kecocokan"
```

---

## Task 8: Rute meet dan perakitan

**Files:**
- Create: `apps/api/src/routes/meet.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/index.ts`
- Test: `apps/api/test/meet.route.test.ts`

**Interfaces:**
- Consumes: `setTanda`, `tandaiDilihat`, `daftarKecocokan` (Task 7); `InginBertemuRequestSchema`, `TandaiDilihatRequestSchema`, `recoverLihatKecocokanSigner` dari `@nearly/shared`; `createMeetStore` (Task 6).
- Produces: `meetRoutes(deps: MeetDeps)`.

**Tiga aturan mengikat:**

1. **`GET /kecocokan` MENOLAK 403 tanpa bukti sah** (spec §6.2) — bukan mengembalikan daftar kosong. Daftar kosong dan "kamu tidak berhak" adalah dua hal berbeda, dan klien perlu membedakannya.
2. **Bukti bacanya `LihatKecocokan`**, bukan `TandaiDilihat` yang bentuk fieldnya identik. Yang kedua perintah tulis.
3. **`onChanged` TIDAK diteruskan ke rute meet** (spec §9). Menandai bukan bertemu; tidak ada skor trust yang perlu dihitung ulang.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/meet.route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  inginBertemuTypedData, lihatKecocokanTypedData, tandaiDilihatTypedData,
} from "@nearly/shared";
import { meetRoutes } from "../src/routes/meet";
import type { MeetDeps, MeetStore } from "../src/ports";

const aku = privateKeyToAccount(`0x${"33".repeat(32)}` as Hex);
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

function app(meet: MeetStore) {
  const deps: MeetDeps = { meet, verifyingContract: KONTRAK, nowMs: () => NOW };
  const a = new Hono();
  a.route("/", meetRoutes(deps));
  return a;
}

const kirim = (a: Hono, path: string, body: unknown) =>
  a.request(path, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });

describe("POST /ingin-bertemu", () => {
  async function badan(over: Record<string, unknown> = {}) {
    const pesan = { target: TARGET, who: aku.address, ingin: true, expiresAt: EXP };
    const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    return {
      target: TARGET, who: aku.address, ingin: true,
      expiresAt: EXP.toString(), sig, ...over,
    };
  }

  it("mengembalikan 200 untuk permintaan sah", async () => {
    const res = await kirim(app(store()), "/ingin-bertemu", await badan());
    expect(res.status).toBe(200);
  });

  it("mengembalikan 400 untuk badan yang tidak valid", async () => {
    const res = await kirim(app(store()), "/ingin-bertemu", { who: aku.address });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_body" });
  });

  // Bukan 500. Zod menjalankan refine walau field gagal.
  it("mengembalikan 400, bukan 500, untuk expiresAt bukan angka", async () => {
    const res = await kirim(app(store()), "/ingin-bertemu", await badan({ expiresAt: "besok" }));
    expect(res.status).toBe(400);
  });

  // Skema sengaja menerima target === who; gerbanglah yang menolaknya.
  it("meneruskan penolakan menandai diri sendiri sebagai 400", async () => {
    const pesan = { target: aku.address, who: aku.address, ingin: true, expiresAt: EXP };
    const sig = await aku.signTypedData(inginBertemuTypedData(pesan, KONTRAK));
    const res = await kirim(app(store()), "/ingin-bertemu", {
      target: aku.address, who: aku.address, ingin: true, expiresAt: EXP.toString(), sig,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "tandai_diri" });
  });

  it("meneruskan httpStatus dari gerbang untuk tanda tangan salah", async () => {
    const res = await kirim(app(store()), "/ingin-bertemu",
      await badan({ sig: `0x${"9".repeat(130)}` }));
    expect(res.status).toBe(401);
  });
});

describe("GET /kecocokan", () => {
  async function kueri(over: Record<string, string> = {}) {
    const pesan = { who: aku.address, expiresAt: EXP };
    const sig = await aku.signTypedData(lihatKecocokanTypedData(pesan, KONTRAK));
    const q = new URLSearchParams({
      who: aku.address, expiresAt: EXP.toString(), sig, ...over,
    });
    return `/kecocokan?${q.toString()}`;
  }

  it("mengembalikan daftar dan hitungan baru untuk bukti yang sah", async () => {
    const s = store({
      tandaOleh: vi.fn(async () => [{ address: TARGET, atMs: NOW - 1000 }]),
      tandaKe: vi.fn(async () => [{ address: TARGET, atMs: NOW - 500 }]),
    });
    const res = await app(s).request(await kueri());
    expect(res.status).toBe(200);
    const json = await res.json() as { kecocokan: unknown[]; baru: number };
    expect(json.kecocokan).toHaveLength(1);
    expect(json.baru).toBe(1);
  });

  /**
   * Spec §6.2: MENOLAK, bukan daftar kosong. Daftar kosong dan "kamu tidak
   * berhak" adalah dua hal berbeda, dan klien perlu membedakannya — kalau
   * tidak, orang yang tanda tangannya kedaluwarsa akan disuguhi layar
   * "belum ada kecocokan" yang berbohong.
   */
  it("menolak 403 tanpa tanda tangan sama sekali", async () => {
    const res = await app(store()).request("/kecocokan");
    expect(res.status).toBe(403);
  });

  it("menolak 403 untuk tanda tangan orang lain", async () => {
    const lain = privateKeyToAccount(`0x${"44".repeat(32)}` as Hex);
    const pesan = { who: aku.address, expiresAt: EXP };
    const sig = await lain.signTypedData(lihatKecocokanTypedData(pesan, KONTRAK));
    const res = await app(store()).request(await kueri({ sig }));
    expect(res.status).toBe(403);
  });

  it("menolak 403 untuk tanda tangan kedaluwarsa", async () => {
    const lampau = BigInt(Math.floor(NOW / 1000) - 1);
    const pesan = { who: aku.address, expiresAt: lampau };
    const sig = await aku.signTypedData(lihatKecocokanTypedData(pesan, KONTRAK));
    const res = await app(store()).request(await kueri({ expiresAt: lampau.toString(), sig }));
    expect(res.status).toBe(403);
  });

  it("menolak 403 untuk tanda tangan cacat bentuknya, bukan 500", async () => {
    const res = await app(store()).request(await kueri({ sig: "0xbukan-tanda-tangan" }));
    expect(res.status).toBe(403);
  });

  /**
   * PASANGAN BERBAHAYA. `TandaiDilihat` punya bentuk field IDENTIK dengan
   * `LihatKecocokan`. Kalau tes ini lulus dengan 200, satu tanda tangan bisa
   * dipakai untuk keduanya dan pemisahan baca-tulis runtuh.
   */
  it("menolak 403 untuk tanda tangan TandaiDilihat", async () => {
    const sig = await aku.signTypedData(
      tandaiDilihatTypedData({ who: aku.address, expiresAt: EXP }, KONTRAK));
    const res = await app(store()).request(await kueri({ sig }));
    expect(res.status).toBe(403);
  });
});

describe("POST /kecocokan/dilihat", () => {
  it("mengembalikan 200 dan menyetel waktu dilihat", async () => {
    const pesan = { who: aku.address, expiresAt: EXP };
    const sig = await aku.signTypedData(tandaiDilihatTypedData(pesan, KONTRAK));
    const s = store();
    const res = await kirim(app(s), "/kecocokan/dilihat", {
      who: aku.address, expiresAt: EXP.toString(), sig,
    });
    expect(res.status).toBe(200);
    expect(s.setCocokDilihat).toHaveBeenCalledWith(aku.address, NOW);
  });

  it("mengembalikan 401 untuk tanda tangan LihatKecocokan", async () => {
    const sig = await aku.signTypedData(
      lihatKecocokanTypedData({ who: aku.address, expiresAt: EXP }, KONTRAK));
    const s = store();
    const res = await kirim(app(s), "/kecocokan/dilihat", {
      who: aku.address, expiresAt: EXP.toString(), sig,
    });
    expect(res.status).toBe(401);
    expect(s.setCocokDilihat).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test meet.route`
Expected: FAIL — `Cannot find module '../src/routes/meet'`

- [ ] **Step 3: Tulis rutenya**

`apps/api/src/routes/meet.ts`:

```ts
import { Hono } from "hono";
import { isAddress, type Address, type Hex } from "viem";
import {
  InginBertemuRequestSchema, recoverLihatKecocokanSigner, TandaiDilihatRequestSchema,
} from "@nearly/shared";
import { daftarKecocokan, setTanda, tandaiDilihat } from "../meet-gate";
import type { MeetDeps } from "../ports";

/**
 * Mengembalikan alamat pemanggil HANYA kalau `who`, `expiresAt`, dan `sig`
 * lengkap, belum kedaluwarsa, dan tanda tangan LihatKecocokan-nya memang
 * milik `who`. Selain itu null.
 *
 * Tipe LihatKecocokan, BUKAN TandaiDilihat: bentuk fieldnya IDENTIK
 * ({who, expiresAt}), tapi POST /kecocokan/dilihat menerima TandaiDilihat
 * sebagai perintah TULIS. Kalau bukti baca ini memakai tipe yang sama, tanda
 * tangan yang bocor lewat query string — log akses, proxy, siapa pun yang
 * membaca URL dalam masa berlakunya — bisa diputar ulang untuk menghapus
 * lencana kecocokan orang itu, menyembunyikan dari mereka bahwa seseorang
 * baru saja saling menandai. Kelas kesalahan Ruling 23.
 */
async function pemanggilTerbukti(
  q: Record<string, string>, deps: MeetDeps,
): Promise<Address | null> {
  const { who, expiresAt, sig } = q;
  if (!who || !expiresAt || !sig) return null;
  if (!isAddress(who)) return null;
  if (!/^\d+$/.test(expiresAt)) return null;
  if (deps.nowMs() > Number(expiresAt) * 1000) return null;

  try {
    const signer = await recoverLihatKecocokanSigner(
      { who: who as Address, expiresAt: BigInt(expiresAt) },
      sig as Hex,
      deps.verifyingContract,
    );
    if (signer.toLowerCase() !== who.toLowerCase()) return null;
    return who.toLowerCase() as Address;
  } catch {
    // Tanda tangan cacat bentuknya membuat viem melempar. Itu tetap "tidak
    // terbukti", bukan 500.
    return null;
  }
}

export function meetRoutes(deps: MeetDeps) {
  const r = new Hono();

  r.post("/ingin-bertemu", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = InginBertemuRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);

    const b = parsed.data;
    const hasil = await setTanda({
      target: b.target as Address, who: b.who as Address, ingin: b.ingin,
      expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  /**
   * MENOLAK 403 tanpa bukti sah (spec §6.2), bukan mengembalikan daftar
   * kosong. Rute ini mengembalikan identitas orang lain — daftar kosong dan
   * "kamu tidak berhak" adalah dua hal berbeda, dan klien perlu
   * membedakannya. Kalau disamakan, orang yang tanda tangannya kedaluwarsa
   * akan disuguhi layar "belum ada kecocokan" yang berbohong.
   *
   * Ini sengaja BERBEDA dari GET /profile/:address, yang tanda tangan
   * cacatnya bukan galat — profil harus tetap terbuka untuk orang asing.
   */
  r.get("/kecocokan", async (c) => {
    const who = await pemanggilTerbukti(c.req.query(), deps);
    if (!who) return c.json({ code: "butuh_bukti" }, 403);

    const hasil = await daftarKecocokan(who, deps);
    return c.json(hasil);
  });

  r.post("/kecocokan/dilihat", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = TandaiDilihatRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);

    const b = parsed.data;
    const hasil = await tandaiDilihat({
      who: b.who as Address, expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  return r;
}
```

- [ ] **Step 4: Rakit ke aplikasi**

Di `apps/api/src/app.ts`: impor `meetRoutes` dan tipe `MeetStore`, tambahkan `meet: MeetStore` ke `TrustDeps`, lalu daftarkan rutenya. **`onChanged` TIDAK diteruskan** — menandai bukan bertemu, jadi tidak ada graf yang berubah dan tidak ada skor trust yang perlu dihitung ulang (spec §9).

```ts
import { meetRoutes } from "./routes/meet";
import type { MeetStore } from "./ports";

// di dalam TrustDeps:
  meet: MeetStore;

// di dalam createApp, setelah feedRoutes:
  // `onChanged` TIDAK dipanggil dari rute meet — menandai bukan bertemu, jadi
  // tidak ada graf pertemuan yang berubah (spec §9).
  app.route("/", meetRoutes(deps));
```

Di `apps/api/src/index.ts`, tambahkan ke argumen `createApp`:

```ts
import { createMeetStore } from "./meet-store";

  meet: createMeetStore(supabase),
```

Kalau `typecheck` mengeluh bahwa berkas tes pendukung kehilangan `meet`, tambahkan stub di sana — itu konsekuensi struktural yang diharapkan. Sebutkan berkas mana saja yang kamu sentuh di laporan.

- [ ] **Step 5: Jalankan seluruh tes API**

Run: `pnpm --filter @nearly/api test && pnpm --filter @nearly/api typecheck`
Expected: PASS

- [ ] **Step 6: Buktikan pemisahan baca-tulis benar-benar terkunci**

Ganti sementara `recoverLihatKecocokanSigner` di `pemanggilTerbukti` menjadi `recoverTandaiDilihatSigner`. Jalankan `pnpm --filter @nearly/api test meet.route` dan pastikan tes "menolak 403 untuk tanda tangan TandaiDilihat" MERAH. Kembalikan setelahnya.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/meet.ts apps/api/src/app.ts apps/api/src/index.ts apps/api/test/meet.route.test.ts
git commit -m "feat(api): tiga endpoint meet dan perakitannya"
```

---

## Task 9: `GET /profile/:address` — angka publik dan bendera pribadi

**Files:**
- Modify: `apps/api/src/routes/profile.ts`
- Test: `apps/api/test/profile-meet.route.test.ts`

**Interfaces:**
- Consumes: `MeetStore` (Task 4); `recoverLihatProfilSigner` dari `@nearly/shared`.
- Produces: tiga medan baru di respons `GET /profile/:address` — `inginBertemuCount` (selalu), `sudahKutandai` dan `salingMenandai` (hanya dengan bukti).

**Yang menjadi jantung task ini, dan kenapa ia KEBALIKAN dari feed.** Di Fase 3b diputuskan `GET /feed?who=` tidak butuh bukti baca, karena yang bocor cuma urutan berdasarkan kedekatan graf — dan graf koneksi sudah publik on-chain. Di sini kebalikannya: **"X menandai Y" tidak publik di mana pun**, dan itu justru informasi yang spec induk §7.6 nyatakan default anonim. Tanpa bukti, siapa pun bisa menanyakan satu alamat demi satu alamat dan memetakan siapa menginginkan siapa.

**Tanda tangan cacat BUKAN galat** (spec §5.1) — rute profil tidak boleh gagal untuk orang asing yang membuka tautan. Yang terjadi hanya bendera tidak keluar. Ini berbeda dari `GET /kecocokan` yang menolak 403, dan perbedaannya disengaja.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/profile-meet.route.test.ts`:

```ts
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
    hitungTandaBanyak: vi.fn(async () => new Map()),
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
   * Rute profil tidak boleh GAGAL untuk orang asing yang membuka tautan
   * (spec §5.1). Ini sengaja berbeda dari GET /kecocokan yang menolak 403.
   */
  it("tanda tangan cacat bentuknya tetap 200, bukan galat", async () => {
    const res = await app(meetStore()).request(await buktiBaca({ sig: "0xbukan" }));
    expect(res.status).toBe(200);
    expect((await res.json() as Record<string, unknown>).inginBertemuCount).toBe(7);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test profile-meet.route`
Expected: FAIL — `inginBertemuCount` tidak ada di respons

- [ ] **Step 3: Perluas `apps/api/src/routes/profile.ts`**

Tambahkan impor:

```ts
import { recoverLihatProfilSigner } from "@nearly/shared";
```

Tambahkan helper di atas `profileRoutes`, dan perluas handler `GET /profile/:address`:

```ts
/**
 * Mengembalikan alamat pemanggil HANYA kalau bukti LihatProfil-nya sah untuk
 * `target` ini. Selain itu null.
 *
 * Tanda tangan cacat BUKAN galat (spec §5.1): rute profil tidak boleh gagal
 * untuk orang asing yang membuka tautan. Yang terjadi hanya bendera tidak
 * keluar. Ini sengaja berbeda dari GET /kecocokan yang menolak 403 — di sana
 * yang dikembalikan adalah identitas orang lain.
 *
 * Tipe LihatProfil, BUKAN InginBertemu: yang kedua adalah perintah TULIS.
 */
async function pemanggilTerbukti(
  q: Record<string, string>, target: Address, deps: ProfileMeetDeps,
): Promise<Address | null> {
  const { who, expiresAt, sig } = q;
  if (!who || !expiresAt || !sig) return null;
  if (!isAddress(who)) return null;
  if (!/^\d+$/.test(expiresAt)) return null;
  if (deps.nowMs() > Number(expiresAt) * 1000) return null;

  try {
    const signer = await recoverLihatProfilSigner(
      { target, who: who as Address, expiresAt: BigInt(expiresAt) },
      sig as Hex,
      deps.verifyingContract,
    );
    if (signer.toLowerCase() !== who.toLowerCase()) return null;
    return who.toLowerCase() as Address;
  } catch {
    return null;
  }
}
```

Di dalam handler, setelah blok `Promise.all` yang sudah ada, tambahkan:

```ts
    // Angka publik (spec induk §7.6): selalu keluar, tanpa bukti apa pun.
    const inginBertemuCount = await deps.meet.hitungTanda(addr).catch(() => 0);

    const dasar = { address: addr, displayName, ens, txCount, connectionCount, inginBertemuCount };

    const pemanggil = await pemanggilTerbukti(c.req.query(), addr, deps);
    if (!pemanggil) return c.json(dasar);

    const [sudahKutandai, diaMenandaiku] = await Promise.all([
      deps.meet.adaTanda(addr, pemanggil),
      deps.meet.adaTanda(pemanggil, addr),
    ]);
    return c.json({
      ...dasar,
      sudahKutandai,
      salingMenandai: sudahKutandai && diaMenandaiku,
    });
```

Tipe `ProfileMeetDeps` adalah irisan yang dibutuhkan helper; deklarasikan di berkas yang sama:

```ts
type ProfileMeetDeps = {
  meet: MeetStore;
  verifyingContract: Address;
  nowMs: () => number;
};
```

dan perluas tanda tangan `profileRoutes` supaya menerima `deps` yang memuat ketiganya di samping `profiles` dan `identity` yang sudah ada.

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test && pnpm --filter @nearly/api typecheck`
Expected: PASS

- [ ] **Step 5: Buktikan penjaga bukti baca benar-benar menggigit**

Ubah sementara handler supaya selalu mengeluarkan `sudahKutandai` tanpa memanggil `pemanggilTerbukti`. Jalankan `pnpm --filter @nearly/api test profile-meet.route` dan pastikan tes "TIDAK keluar tanpa tanda tangan sama sekali" MERAH. Kembalikan setelahnya.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/profile.ts apps/api/test/profile-meet.route.test.ts
git commit -m "feat(api): angka ingin bertemu publik dan bendera pribadi berbukti"
```

---

## Task 10: Loop event di `GET /events/:id`

**Files:**
- Modify: `apps/api/src/routes/events.ts`
- Test: `apps/api/test/events-loop.route.test.ts`

**Interfaces:**
- Consumes: `irisan` dari `apps/api/src/meet-rank.ts` (Task 5); `MeetStore` (Task 4); `EventStore.rsvpAddresses` (Task 4).
- Produces: dua medan baru di cabang terbukti `GET /events/:id` — `penandaHadir` dan `kutandaiHadir`.

**Nol mesin bukti baca baru.** `GET /events/:id` SUDAH menerima `?who=&expiresAt=&sig=` dan sudah memverifikasinya dengan `recoverLihatEventSigner` untuk membuka `sudahRsvp` dan `sudahCheckIn`. Dua angka loop menempel di cabang yang sudah terbukti itu — **jangan** membuat helper bukti baca kedua di berkas ini.

**Angka, bukan daftar** (spec §4.3). Daftar akan membocorkan siapa menandai siapa, dan itu justru yang dijaga spec induk §7.6.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/events-loop.route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { lihatEventTypedData } from "@nearly/shared";
import { eventRoutes } from "../src/routes/events";
import type { EventRecord, MeetStore } from "../src/ports";

const aku = privateKeyToAccount(`0x${"77".repeat(32)}` as Hex);
const ATTENDANCE = "0x000000000000000000000000000000000000beef" as Address;
const A = "0x00000000000000000000000000000000000000a1" as Address;
const B = "0x00000000000000000000000000000000000000b2" as Address;
const C = "0x00000000000000000000000000000000000000c3" as Address;
const ID = `0x${"1".repeat(64)}` as Hex;
const NOW = 1_800_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);

const acara: EventRecord = {
  eventId: ID, host: A, title: "Meetup", venueLabel: "Jakarta",
  centerCell: "qqguv1r", startsAt: BigInt(NOW / 1000), endsAt: BigInt(NOW / 1000 + 3600),
  txHash: "0xtx" as Hex,
};

function meetStore(over: Partial<MeetStore> = {}): MeetStore {
  return {
    setTanda: vi.fn(async () => {}), hitungTanda: vi.fn(async () => 0),
    adaTanda: vi.fn(async () => false),
    tandaOleh: vi.fn(async () => []), tandaKe: vi.fn(async () => []),
    cocokDilihatAtMs: vi.fn(async () => null), setCocokDilihat: vi.fn(async () => {}),
    profilRingkas: vi.fn(async () => new Map()),
    hitungTandaBanyak: vi.fn(async () => new Map()),
    ...over,
  };
}

function app(meet: MeetStore, rsvp: Address[]) {
  const deps = {
    events: {
      getEvent: vi.fn(async () => acara),
      attendanceSummary: vi.fn(async () => ({ rsvps: 3, checkins: 1, rsvpBelumHadir: 2 })),
      hasRsvp: vi.fn(async () => true),
      hasCheckIn: vi.fn(async () => false),
      rsvpAddresses: vi.fn(async () => rsvp),
      listDiscovery: vi.fn(async () => []),
      recordEvent: vi.fn(async () => {}), recordRsvp: vi.fn(async () => {}),
      putCheckInOffer: vi.fn(async () => {}), getCheckInOffer: vi.fn(async () => null),
      consumeCheckInOffer: vi.fn(async () => {}), recordCheckIn: vi.fn(async () => {}),
    },
    attendance: { submitCreateEvent: vi.fn(), submitCheckIn: vi.fn() },
    profiles: { listConnections: vi.fn(), countConnections: vi.fn(), getDisplayName: vi.fn() },
    attendanceContract: ATTENDANCE,
    nowMs: () => NOW,
    onChanged: vi.fn(async () => {}),
    meet,
  };
  const a = new Hono();
  a.route("/", eventRoutes(deps as never));
  return a;
}

async function kueriTerbukti() {
  const sig = await aku.signTypedData(
    lihatEventTypedData({ eventId: ID, who: aku.address, expiresAt: EXP }, ATTENDANCE));
  const q = new URLSearchParams({ who: aku.address, expiresAt: EXP.toString(), sig });
  return `/events/${ID}?${q.toString()}`;
}

describe("loop event di GET /events/:id", () => {
  it("menghitung penanda yang sudah RSVP", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => [
      { address: B, atMs: NOW }, { address: C, atMs: NOW },
    ]) });
    const res = await app(s, [B]).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ penandaHadir: 1 });
  });

  it("menghitung orang yang kutandai dan sudah RSVP", async () => {
    const s = meetStore({ tandaOleh: vi.fn(async () => [
      { address: B, atMs: NOW }, { address: C, atMs: NOW },
    ]) });
    const res = await app(s, [B, C]).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ kutandaiHadir: 2 });
  });

  it("nol kalau tidak ada yang beririsan", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => [{ address: C, atMs: NOW }]) });
    const res = await app(s, [B]).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ penandaHadir: 0 });
  });

  it("tidak peka besar-kecil huruf", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => [
      { address: B.toUpperCase() as Address, atMs: NOW },
    ]) });
    const res = await app(s, [B]).request(await kueriTerbukti());
    expect(await res.json()).toMatchObject({ penandaHadir: 1 });
  });

  /**
   * Tanpa penjaga ini, siapa pun bisa menanyakan "berapa orang yang ingin
   * bertemu Alice akan datang ke acara ini", dan dengan mengulanginya lintas
   * banyak acara, pola tanda Alice bisa disimpulkan tanpa pernah melihat satu
   * nama pun (spec §5.3).
   */
  it("kedua angka TIDAK keluar tanpa bukti", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => [{ address: B, atMs: NOW }]) });
    const res = await app(s, [B]).request(`/events/${ID}`);
    const json = await res.json() as Record<string, unknown>;
    expect(json.penandaHadir).toBeUndefined();
    expect(json.kutandaiHadir).toBeUndefined();
  });

  // Angka, bukan daftar (spec §4.3). Daftar membocorkan siapa menandai siapa.
  it("tidak pernah mengembalikan daftar nama", async () => {
    const s = meetStore({ tandaKe: vi.fn(async () => [{ address: B, atMs: NOW }]) });
    const res = await app(s, [B]).request(await kueriTerbukti());
    const teks = await res.text();
    expect(teks).not.toContain(B.slice(2));
  });

  it("medan cabang terbukti yang lama tetap ada", async () => {
    const res = await app(meetStore(), []).request(await kueriTerbukti());
    const json = await res.json() as Record<string, unknown>;
    expect(json.sudahRsvp).toBe(true);
    expect(json.sudahCheckIn).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test events-loop.route`
Expected: FAIL — `penandaHadir` tidak ada di respons

- [ ] **Step 3: Perluas cabang terbukti di `apps/api/src/routes/events.ts`**

Tambahkan impor `irisan` dari `../meet-rank` dan tipe `MeetStore` dari `../ports`. Perluas tanda tangan `eventRoutes` menjadi menerima `EventDeps & { onChanged: () => Promise<void>; meet: MeetStore }`.

Di dalam handler `GET /events/:id`, **di dalam blok `if (addr)` yang sudah ada**, ganti isinya menjadi:

```ts
    if (addr) {
      const [sudahRsvp, sudahCheckIn, tandaKe, tandaOleh, rsvp] = await Promise.all([
        deps.events.hasRsvp(ev.eventId, addr),
        deps.events.hasCheckIn(ev.eventId, addr),
        deps.meet.tandaKe(addr),
        deps.meet.tandaOleh(addr),
        deps.events.rsvpAddresses(ev.eventId),
      ]);

      // Spec §4.3: ANGKA, bukan daftar. Daftar akan membocorkan siapa
      // menandai siapa, dan itu justru yang dijaga spec induk §7.6.
      //
      // Keduanya di dalam cabang TERBUKTI: tanpa itu, siapa pun bisa
      // menanyakan "berapa orang yang ingin bertemu Alice akan datang ke
      // acara ini", dan mengulanginya lintas banyak acara akan menyingkap
      // pola tanda Alice tanpa satu nama pun terlihat (spec §5.3).
      const penandaHadir = irisan(tandaKe.map((t) => t.address), rsvp);
      const kutandaiHadir = irisan(tandaOleh.map((t) => t.address), rsvp);

      return c.json({
        ...eventToJson(ev), ...summary,
        sudahRsvp, sudahCheckIn, penandaHadir, kutandaiHadir,
      });
    }
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test && pnpm --filter @nearly/api typecheck`
Expected: PASS

Kalau tes rute event yang sudah ada gagal typecheck karena `deps` kehilangan `meet`, tambahkan stub `MeetStore` di sana.

- [ ] **Step 5: Buktikan penjaga bukti benar-benar menggigit**

Pindahkan sementara perhitungan kedua angka ke LUAR blok `if (addr)` supaya selalu keluar. Jalankan `pnpm --filter @nearly/api test events-loop.route` dan pastikan tes "kedua angka TIDAK keluar tanpa bukti" MERAH. Kembalikan setelahnya.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/events.ts apps/api/test/events-loop.route.test.ts
git commit -m "feat(api): loop event — berapa penanda dan tandaanmu yang akan hadir"
```

---

## Task 11: Mobile — klien meet dan pesan galat

**Files:**
- Create: `apps/mobile/src/meet-api.ts`
- Modify: `apps/mobile/src/messages.ts`
- Test: `apps/mobile/test/meet-messages.test.ts`, `apps/mobile/test/meet-bukti.test.ts`

**Interfaces:**
- Consumes: `postJson`, `req` dari `apps/mobile/src/http.ts` (sudah ada sejak Fase 3b); `CONFIG` dari `src/config.ts`; tipe EIP-712 dari `@nearly/shared`.
- Produces: `type PenandaSigner`, `type BarisKecocokan`, `kueriBuktiProfil`, `kueriBuktiKecocokan`, `getKecocokan`, `tandaiKecocokanDilihat`, `meetErrorMessage`.

**Berkas ini TIDAK memuat fungsi menandai.** Penandatanganan `InginBertemu` hidup di satu tempat saja — `meet-actions.ts` di Task 13. Dua tempat untuk satu operasi tanda tangan adalah cara termudah agar salah satunya diperbaiki nanti dan yang lain tertinggal diam-diam.

**Kenapa dua pembangun query string terpisah.** `LihatProfil` mengikat `target`; `LihatKecocokan` tidak. Menyatukan keduanya jadi satu helper akan memaksa `target` dikarang untuk kasus kecocokan, dan itu persis jenis kelonggaran yang membuat orang berikutnya mengira kedua tipe bisa dipertukarkan.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/meet-messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { meetErrorMessage } from "../src/messages";

describe("meetErrorMessage", () => {
  it("menerjemahkan setiap kode gerbang meet ke bahasa Indonesia", () => {
    for (const kode of ["expired", "bad_signature", "tandai_diri", "butuh_bukti", "invalid_body"]) {
      const pesan = meetErrorMessage(kode);
      expect(pesan).not.toContain("_");
      expect(pesan.length).toBeGreaterThan(10);
    }
  });

  it("kode tak dikenal tetap menghasilkan kalimat, bukan kode mentah", () => {
    expect(meetErrorMessage("kode_aneh_dari_masa_depan")).not.toContain("kode_aneh");
  });
});
```

`apps/mobile/test/meet-bukti.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  lihatKecocokanTypedData, lihatProfilTypedData,
  recoverLihatKecocokanSigner, recoverLihatProfilSigner,
} from "@nearly/shared";
import { kueriBuktiKecocokan, kueriBuktiProfil } from "../src/meet-api";

const akun = privateKeyToAccount(`0x${"88".repeat(32)}` as Hex);
const TARGET = "0x000000000000000000000000000000000000dead" as Address;

const signer = {
  address: akun.address,
  signTypedData: (td: Parameters<typeof akun.signTypedData>[0]) => akun.signTypedData(td),
};

describe("kueriBuktiProfil", () => {
  it("menghasilkan query string yang tanda tangannya bisa dipulihkan", async () => {
    const q = new URLSearchParams(await kueriBuktiProfil(signer, TARGET));
    const who = q.get("who")!;
    const expiresAt = q.get("expiresAt")!;
    const sig = q.get("sig")! as Hex;

    const pulih = await recoverLihatProfilSigner(
      { target: TARGET, who: who as Address, expiresAt: BigInt(expiresAt) },
      sig,
      // Domain memakai CONFIG.verifyingContract; nilainya disuntik
      // vitest.config.ts sebagai alamat sintetis.
      process.env.EXPO_PUBLIC_CONNECTION_REGISTRY as Address,
    );
    expect(pulih.toLowerCase()).toBe(akun.address.toLowerCase());
  });

  it("expiresAt berada di masa depan", async () => {
    const q = new URLSearchParams(await kueriBuktiProfil(signer, TARGET));
    expect(Number(q.get("expiresAt"))).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});

describe("kueriBuktiKecocokan", () => {
  it("menghasilkan query string yang tanda tangannya bisa dipulihkan", async () => {
    const q = new URLSearchParams(await kueriBuktiKecocokan(signer));
    const pulih = await recoverLihatKecocokanSigner(
      { who: q.get("who") as Address, expiresAt: BigInt(q.get("expiresAt")!) },
      q.get("sig") as Hex,
      process.env.EXPO_PUBLIC_CONNECTION_REGISTRY as Address,
    );
    expect(pulih.toLowerCase()).toBe(akun.address.toLowerCase());
  });

  // LihatKecocokan TIDAK mengikat target — memaksakannya akan membuat orang
  // berikutnya mengira kedua tipe bukti bisa dipertukarkan.
  it("tidak menyertakan target", async () => {
    const q = new URLSearchParams(await kueriBuktiKecocokan(signer));
    expect(q.get("target")).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile test`
Expected: FAIL — `Cannot find module '../src/meet-api'`

- [ ] **Step 3: Tambahkan `meetErrorMessage` di `apps/mobile/src/messages.ts`**

```ts
const MEET_MESSAGES: Record<string, string> = {
  expired: "Permintaannya sudah kedaluwarsa. Coba lagi.",
  bad_signature: "Tanda tangan tidak cocok. Coba lagi.",
  tandai_diri: "Kamu tidak bisa menandai dirimu sendiri.",
  butuh_bukti: "Perlu masuk sebagai dirimu untuk melihat ini.",
  invalid_body: "Ada isian yang belum benar.",
};

export function meetErrorMessage(code: string): string {
  return MEET_MESSAGES[code] ?? "Gagal. Coba lagi sebentar.";
}
```

- [ ] **Step 4: Buat `apps/mobile/src/meet-api.ts`**

```ts
import type { Address } from "viem";
import {
  lihatKecocokanTypedData, lihatProfilTypedData, tandaiDilihatTypedData,
} from "@nearly/shared";
import { CONFIG } from "./config";
import { postJson, req } from "./http";

/** Bentuk minimal yang dibutuhkan; createDevSigner memenuhinya. */
export type PenandaSigner = {
  address: Address;
  signTypedData: (td: never) => Promise<`0x${string}`>;
};

export type BarisKecocokan = {
  address: string;
  displayName: string;
  tier: number;
  sejakMs: number;
};

/** Lima menit. Sama seperti setiap tanda tangan lain di aplikasi ini. */
const UMUR_DETIK = 300;

const kedaluwarsa = () => BigInt(Math.floor(Date.now() / 1000) + UMUR_DETIK);

/**
 * Bukti baca untuk GET /profile/:address. Mengikat `target`, karena ia
 * membuka bendera tentang HUBUNGAN antara dua orang.
 */
export async function kueriBuktiProfil(
  signer: PenandaSigner, target: Address,
): Promise<string> {
  const expiresAt = kedaluwarsa();
  const sig = await signer.signTypedData(lihatProfilTypedData(
    { target, who: signer.address, expiresAt }, CONFIG.verifyingContract,
  ) as never);
  return new URLSearchParams({
    who: signer.address, expiresAt: expiresAt.toString(), sig,
  }).toString();
}

/**
 * Bukti baca untuk GET /kecocokan. TIDAK mengikat target — membaca
 * kecocokanmu sendiri tidak berbicara tentang satu orang tertentu.
 *
 * Tipe LihatKecocokan, BUKAN TandaiDilihat: bentuk fieldnya identik, tapi
 * yang kedua perintah TULIS.
 */
export async function kueriBuktiKecocokan(signer: PenandaSigner): Promise<string> {
  const expiresAt = kedaluwarsa();
  const sig = await signer.signTypedData(lihatKecocokanTypedData(
    { who: signer.address, expiresAt }, CONFIG.verifyingContract,
  ) as never);
  return new URLSearchParams({
    who: signer.address, expiresAt: expiresAt.toString(), sig,
  }).toString();
}

export function getKecocokan(kueri: string) {
  return req<{ kecocokan: BarisKecocokan[]; baru: number }>(`/kecocokan?${kueri}`);
}

export async function tandaiKecocokanDilihat(signer: PenandaSigner): Promise<void> {
  const expiresAt = kedaluwarsa();
  const sig = await signer.signTypedData(tandaiDilihatTypedData(
    { who: signer.address, expiresAt }, CONFIG.verifyingContract,
  ) as never);
  await postJson<{ ok: true }>("/kecocokan/dilihat", {
    who: signer.address, expiresAt: expiresAt.toString(), sig,
  });
}
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile test && pnpm --filter @nearly/mobile typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/meet-api.ts apps/mobile/src/messages.ts apps/mobile/test/meet-messages.test.ts apps/mobile/test/meet-bukti.test.ts
git commit -m "feat(mobile): klien meet dan dua pembangun bukti baca terpisah"
```

---

## Task 12: Mobile — layar kecocokan dan lencana beranda

**Files:**
- Create: `apps/mobile/app/kecocokan.tsx`
- Modify: `apps/mobile/app/index.tsx`, `apps/mobile/src/messages.ts`
- Test: `apps/mobile/test/kecocokan-teks.test.ts`

**Interfaces:**
- Consumes: `getKecocokan`, `kueriBuktiKecocokan`, `tandaiKecocokanDilihat`, `BarisKecocokan`, `meetErrorMessage` (Task 11); `createDevSigner`, `CONFIG`.
- Produces: `teksLencana(baru: number): string | null` diekspor dari `apps/mobile/src/messages.ts`, supaya bisa diuji tanpa merender.

**Kartu kecocokan TIDAK punya tombol lanjutan** (spec §4.2). Pesan baru datang di Fase 4. Yang bisa dilakukan cuma melihat profilnya dan pergi menemuinya — persis tesis spec induk §7.4. Menaruh tombol chat di sini akan membocorkan aturan inti lewat pintu belakang.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/kecocokan-teks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { teksLencana } from "../src/messages";

describe("teksLencana", () => {
  // Nol BUKAN "0" — lencana kosong harus hilang, bukan memamerkan nol.
  it("nol menghasilkan null", () => {
    expect(teksLencana(0)).toBeNull();
  });

  it("satu sampai sembilan menghasilkan angkanya", () => {
    expect(teksLencana(1)).toBe("1");
    expect(teksLencana(9)).toBe("9");
  });

  // Angka besar tidak boleh merusak lebar lencana.
  it("sepuluh ke atas dipotong menjadi 9+", () => {
    expect(teksLencana(10)).toBe("9+");
    expect(teksLencana(500)).toBe("9+");
  });

  it("angka negatif diperlakukan sebagai nol", () => {
    expect(teksLencana(-1)).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile test kecocokan-teks`
Expected: FAIL — `teksLencana is not exported`

- [ ] **Step 3: Tambahkan `teksLencana` di `apps/mobile/src/messages.ts`**

```ts
/**
 * Teks lencana kecocokan baru. `null` berarti tidak ada lencana sama sekali —
 * memamerkan "0" akan membuat beranda terasa seperti papan skor yang kosong,
 * padahal yang benar adalah tidak ada apa-apa untuk diberitahukan.
 */
export function teksLencana(baru: number): string | null {
  if (!Number.isFinite(baru) || baru <= 0) return null;
  return baru > 9 ? "9+" : String(baru);
}
```

- [ ] **Step 4: Buat `apps/mobile/app/kecocokan.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "expo-router";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import { TIER_LABELS } from "@nearly/trust";
import { CONFIG } from "../src/config";
import { createDevSigner } from "../src/signer";
import { ApiError } from "../src/http";
import {
  getKecocokan, kueriBuktiKecocokan, tandaiKecocokanDilihat, type BarisKecocokan,
} from "../src/meet-api";
import { meetErrorMessage } from "../src/messages";

export default function KecocokanScreen() {
  const signer = useMemo(
    // Domain meet terikat ke ConnectionRegistry, sama seperti tipe feed.
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [baris, setBaris] = useState<BarisKecocokan[] | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const muat = useCallback(async () => {
    try {
      const { kecocokan } = await getKecocokan(await kueriBuktiKecocokan(signer));
      setBaris(kecocokan);
      setPesan(null);
      // Membuka layar ini MENANDAI sudah dilihat. Kegagalannya tidak boleh
      // mengosongkan daftar yang sudah berhasil dimuat.
      await tandaiKecocokanDilihat(signer).catch(() => {});
    } catch (e) {
      setBaris([]);
      setPesan(e instanceof ApiError ? meetErrorMessage(e.code) : "Kecocokan gagal dimuat.");
    }
  }, [signer]);

  useEffect(() => { void muat(); }, [muat]);

  if (baris === null) return <ActivityIndicator style={s.tengah} />;

  return (
    <View style={s.root}>
      {pesan && <Text style={s.pesan}>{pesan}</Text>}
      <FlatList
        data={baris}
        keyExtractor={(k) => k.address}
        ListEmptyComponent={
          <Text style={s.kosong}>
            Belum ada yang saling menandai denganmu. Tandai orang yang ingin kamu temui —
            kalau dia menandaimu balik, kalian akan saling tahu.
          </Text>
        }
        renderItem={({ item: k }) => (
          <View style={s.kartu}>
            <Text style={s.nama}>{k.displayName.trim() || k.address}</Text>
            <Text style={s.meta}>{TIER_LABELS[k.tier] ?? TIER_LABELS[0]}</Text>
            <Text style={s.saling}>Kalian saling ingin bertemu.</Text>
            {/*
              TIDAK ADA tombol pesan, dan itu disengaja (spec §4.2). Pesan baru
              datang di Fase 4. Yang bisa dilakukan cuma melihat profilnya dan
              pergi menemuinya — persis tesis spec induk §7.4.
            */}
            <Link href={`/profile/${k.address}`} style={s.tautan}>Lihat profil</Link>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  tengah: { flex: 1 },
  pesan: { fontSize: 14, opacity: 0.8 },
  kosong: { fontSize: 15, lineHeight: 22, opacity: 0.6, paddingVertical: 24 },
  kartu: { paddingVertical: 14, gap: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  nama: { fontSize: 16, fontWeight: "600" },
  meta: { fontSize: 12, opacity: 0.6 },
  saling: { fontSize: 14, paddingTop: 2 },
  tautan: { fontSize: 15, paddingTop: 6 },
});
```

- [ ] **Step 5: Tambahkan tautan berlencana di `apps/mobile/app/index.tsx`**

Tambahkan state dan pemuatan di dalam komponen `Home`, setelah `const signer = ...`:

```tsx
  const [baru, setBaru] = useState(0);

  useEffect(() => {
    // Satu tanda tangan per pembukaan beranda, hanya untuk angka lencana.
    // Ongkos yang dipilih sadar (spec §6.2): endpoint hitung tanpa autentikasi
    // akan membocorkan berapa kecocokan dimiliki sebuah alamat.
    //
    // Fungsi async DI DALAM useEffect, bukan useEffect yang async —
    // useEffect yang mengembalikan Promise merusak jalur pembersihannya.
    void (async () => {
      try {
        const { baru } = await getKecocokan(await kueriBuktiKecocokan(signer));
        setBaru(baru);
      } catch {
        // Beranda tidak boleh gagal hanya karena lencana gagal dimuat.
        setBaru(0);
      }
    })();
  }, [signer]);
```

Lalu tambahkan tautannya setelah `<Link href="/feed" …>`:

```tsx
      <Link href="/kecocokan" style={s.link}>
        Saling ingin bertemu{teksLencana(baru) ? `  ${teksLencana(baru)}` : ""}
      </Link>
```

- [ ] **Step 6: Jalankan tes dan typecheck**

Run: `pnpm --filter @nearly/mobile test && pnpm --filter @nearly/mobile typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/app/kecocokan.tsx apps/mobile/app/index.tsx apps/mobile/src/messages.ts apps/mobile/test/kecocokan-teks.test.ts
git commit -m "feat(mobile): layar kecocokan dan lencana beranda"
```

---

## Task 13: Mobile — tombol di kartu feed, tautan profil, dan layar profil

**Files:**
- Create: `apps/mobile/src/meet-actions.ts`
- Modify: `apps/mobile/app/feed/index.tsx`, `apps/mobile/app/profile/[address].tsx`, `apps/mobile/app/events/[id].tsx`
- Test: `apps/mobile/test/meet-aksi.test.ts`

**Interfaces:**
- Consumes: `PenandaSigner`, `kueriBuktiProfil`, `meetErrorMessage` (Task 11).
- Produces: `aksiTanda(signer, target, sedangDitandai)` diekspor dari `apps/mobile/src/meet-actions.ts`, supaya logika di balik tombol bisa diuji tanpa merender.

**Prasyarat yang ditemukan saat merancang fase ini** (spec §1): kartu feed **tidak menautkan ke profil**. Satu-satunya jalan ke layar profil masih dari daftar koneksi — orang yang sudah kamu temui. Jadi Fase 3b membangun permukaan berisi orang asing, tapi profil mereka tidak bisa dibuka. Tautan itu bagian dari task ini, bukan tambahan.

**Angka publik TIDAK ditampilkan di kartu feed**, hanya tombolnya (spec §8). Kartu feed sudah memuat nama, tier, baris alasan, teks, gambar, dan empat tombol; menambah angka bukti sosial di sana akan menenggelamkan baris alasan yang justru dijaga spec 3b §10.3.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/meet-aksi.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { recoverInginBertemuSigner } from "@nearly/shared";
import { aksiTanda } from "../src/meet-actions";

const akun = privateKeyToAccount(`0x${"99".repeat(32)}` as Hex);
const TARGET = "0x000000000000000000000000000000000000dead" as Address;
const KONTRAK = process.env.EXPO_PUBLIC_CONNECTION_REGISTRY as Address;

const signer = {
  address: akun.address,
  signTypedData: (td: Parameters<typeof akun.signTypedData>[0]) => akun.signTypedData(td),
};

describe("aksiTanda", () => {
  it("mengirim ingin:true saat belum ditandai", async () => {
    const mata = vi.fn(async () => ({ ok: true as const }));
    await aksiTanda(signer, TARGET, false, mata as never);
    expect(mata).toHaveBeenCalledWith(expect.objectContaining({ ingin: true }));
  });

  it("mengirim ingin:false saat sudah ditandai", async () => {
    const mata = vi.fn(async () => ({ ok: true as const }));
    await aksiTanda(signer, TARGET, true, mata as never);
    expect(mata).toHaveBeenCalledWith(expect.objectContaining({ ingin: false }));
  });

  /**
   * Tanda tangan harus benar-benar memulihkan penandanya, dan harus MENGIKAT
   * nilai `ingin` yang dikirim. Kalau tidak, satu tanda tangan bisa dipakai
   * dua arah — dan mencabut adalah satu-satunya cara menutup pintu
   * pengungkapan (spec §2.1).
   */
  it("tanda tangannya mengikat target dan nilai ingin yang dikirim", async () => {
    let dikirim: Record<string, unknown> | null = null;
    await aksiTanda(signer, TARGET, false, (async (b: Record<string, unknown>) => {
      dikirim = b;
      return { ok: true as const };
    }) as never);

    const b = dikirim as unknown as {
      target: Address; who: Address; ingin: boolean; expiresAt: string; sig: Hex;
    };
    const pulih = await recoverInginBertemuSigner(
      { target: b.target, who: b.who, ingin: b.ingin, expiresAt: BigInt(b.expiresAt) },
      b.sig, KONTRAK,
    );
    expect(pulih.toLowerCase()).toBe(akun.address.toLowerCase());

    // Nilai ingin yang DITUKAR harus membuat pemulihan meleset.
    const pulihDitukar = await recoverInginBertemuSigner(
      { target: b.target, who: b.who, ingin: !b.ingin, expiresAt: BigInt(b.expiresAt) },
      b.sig, KONTRAK,
    );
    expect(pulihDitukar.toLowerCase()).not.toBe(akun.address.toLowerCase());
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile test meet-aksi`
Expected: FAIL — `Cannot find module '../src/meet-actions'`

- [ ] **Step 3: Buat `apps/mobile/src/meet-actions.ts`**

```ts
import type { Address } from "viem";
import { inginBertemuTypedData } from "@nearly/shared";
import { CONFIG } from "./config";
import { postJson } from "./http";
import type { PenandaSigner } from "./meet-api";

type Pengirim = (body: unknown) => Promise<{ ok: true }>;

const kirimBawaan: Pengirim = (body) => postJson<{ ok: true }>("/ingin-bertemu", body);

/**
 * Logika di balik tombol "Ingin bertemu", dipisahkan dari layar supaya bisa
 * diuji tanpa merender apa pun.
 *
 * `ingin` yang dikirim adalah KEBALIKAN keadaan sekarang, dan nilainya ikut
 * ditandatangani — mencabut adalah satu-satunya cara menutup pintu
 * pengungkapan (spec §2.1), jadi ia tidak boleh bisa dipalsukan.
 */
export async function aksiTanda(
  signer: PenandaSigner,
  target: Address,
  sedangDitandai: boolean,
  kirim: Pengirim = kirimBawaan,
): Promise<void> {
  const ingin = !sedangDitandai;
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 300);
  const sig = await signer.signTypedData(inginBertemuTypedData(
    { target, who: signer.address, ingin, expiresAt }, CONFIG.verifyingContract,
  ) as never);

  await kirim({
    target, who: signer.address, ingin, expiresAt: expiresAt.toString(), sig,
  });
}
```

- [ ] **Step 4: Tambahkan tombol dan tautan di kartu feed**

Di `apps/mobile/app/feed/index.tsx`, di dalam `renderItem`, bungkus nama penulis dengan tautan ke profilnya dan tambahkan tombol:

```tsx
            <Link href={`/profile/${p.author}`} style={s.nama}>
              {p.displayName.trim() || p.author}
            </Link>
```

lalu tambahkan tombol di baris aksi yang sudah ada:

```tsx
            <Pressable onPress={() => void tandai(p)} hitSlop={8}>
              <Text style={s.aksi}>Ingin bertemu</Text>
            </Pressable>
```

dengan fungsi:

```tsx
  async function tandai(p: FeedPost) {
    try {
      // Layar feed tidak tahu apakah kamu sudah menandai orang ini — bendera
      // itu hanya keluar dengan bukti baca di layar profil. Jadi dari sini
      // tombolnya SELALU menandai, tidak pernah mencabut. Mencabut dilakukan
      // dari layar profil, tempat keadaannya diketahui.
      await aksiTanda(signer, p.author as Address, false);
      setPesan("Ditandai. Kalau dia menandaimu balik, kalian akan saling tahu.");
    } catch (e) {
      setPesan(e instanceof ApiError ? meetErrorMessage(e.code) : "Gagal menandai.");
    }
  }
```

**Angka publiknya TIDAK ditampilkan di kartu** (spec §8) — hanya tombolnya.

- [ ] **Step 5: Tambahkan angka dan tombol di layar profil**

Di `apps/mobile/app/profile/[address].tsx`, ganti pemuatan profil yang sudah ada supaya menyertakan bukti baca saat signer tersedia:

```tsx
  useEffect(() => {
    void (async () => {
      try {
        const kueri = signer && address
          ? `?${await kueriBuktiProfil(signer, address as Address)}`
          : "";
        const r = await fetch(`${CONFIG.apiUrl}/profile/${address}${kueri}`);
        setP(await r.json());
      } catch { /* profil tidak boleh ikut mati kalau bukti gagal dibuat */ }
    })();
  }, [address, signer]);
```

Perluas tipe `Profile` lokal dengan tiga medan baru, lalu tampilkan:

```tsx
      <Text style={s.angka}>
        {p.inginBertemuCount ?? 0} orang ingin bertemu dia
      </Text>
      {p.salingMenandai ? <Text style={s.saling}>Kalian saling ingin bertemu.</Text> : null}
      {!isOwnProfile && p.sudahKutandai !== undefined ? (
        <Button
          title={p.sudahKutandai ? "Batal ingin bertemu" : "Ingin bertemu"}
          onPress={() => void toggleTanda()}
        />
      ) : null}
```

```tsx
  async function toggleTanda() {
    if (!signer || !address) return;
    try {
      await aksiTanda(signer, address as Address, !!p?.sudahKutandai);
      // Muat ulang dari server, bukan menebak: angka dan bendera milik server.
      const kueri = `?${await kueriBuktiProfil(signer, address as Address)}`;
      setP(await (await fetch(`${CONFIG.apiUrl}/profile/${address}${kueri}`)).json());
    } catch (e) {
      setVouchMessage(e instanceof ApiError ? meetErrorMessage(e.code) : "Gagal menandai.");
    }
  }
```

Tombolnya hanya muncul kalau `sudahKutandai` terdefinisi — yaitu kalau bukti bacanya berhasil. Tanpa bukti, keadaannya tidak diketahui dan tombol dua-arah akan menebak.

- [ ] **Step 6: Tambahkan dua baris loop di layar detail event**

Di `apps/mobile/app/events/[id].tsx`, di bawah baris ringkasan RSVP yang sudah ada:

```tsx
      {ev.penandaHadir !== undefined ? (
        <Text style={s.meta}>
          {ev.penandaHadir} orang yang ingin bertemu kamu sudah RSVP.
        </Text>
      ) : null}
      {ev.kutandaiHadir !== undefined ? (
        <Text style={s.meta}>
          {ev.kutandaiHadir} orang yang kamu tandai sudah RSVP.
        </Text>
      ) : null}
```

Perluas tipe respons event lokal dengan `penandaHadir?: number` dan `kutandaiHadir?: number`. Keduanya hanya keluar kalau bukti bacanya berhasil, jadi `undefined` adalah keadaan normal untuk orang yang membuka tautan acara tanpa signer.

- [ ] **Step 7: Jalankan tes dan typecheck**

Run: `pnpm --filter @nearly/mobile test && pnpm --filter @nearly/mobile typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/meet-actions.ts apps/mobile/app/feed/index.tsx apps/mobile/app/profile apps/mobile/app/events apps/mobile/test/meet-aksi.test.ts
git commit -m "feat(mobile): tombol ingin bertemu, tautan profil dari feed, dan loop event"
```

---

## Task 14: Perbaiki spec induk, verifikasi batas global, serah terima

**Files:**
- Modify: `docs/superpowers/specs/2026-09-03-nearly-design.md`
- Apply: `supabase/migrations/0005_meet.sql`

**Catatan untuk controller.** Bagian penerapan migrasi dan uji lapangan **berhenti di pemilik project**: ia menyentuh Supabase produksi dan butuh dua perangkat. Kerjakan Step 1–3, lalu serahkan Step 4 ke atas.

- [ ] **Step 1: Perbaiki dua kalimat di spec induk §7.6**

Spec §14 menyebut keduanya. Di `docs/superpowers/specs/2026-09-03-nearly-design.md` §7.6:

Ganti butir pertama:

> - **Hanya bisa naik.** Tidak ada yang bisa menurunkan angka orang lain — konsisten dengan prinsip di §6.

menjadi:

> - **Tidak ada yang bisa menurunkan angka orang lain** — konsisten dengan prinsip di §6.
>   Mencabut tandamu SENDIRI menurunkan angka, dan itu disengaja: kalau tanda permanen,
>   menandai berarti menyerahkan keputusan pengungkapan identitasmu kepada orang lain tanpa
>   batas waktu (Fase 3c §2.1).

Ganti butir kedua:

> - **Tap dari akun ber-trust nol tidak dihitung.** … jadi penyaring ini perlu.

menjadi:

> - **Semua tap dihitung; penyaring trust-nol TIDAK dipasang.** Keputusan pemilik project di
>   Fase 3c, menimpa rancangan awal di sini. Akibatnya angka ini bisa digelembungkan bot —
>   bot tidak bisa membangun graf, tapi bot bisa menekan tombol. Konsekuensi dan penawarnya
>   dicatat di `2026-09-07-nearly-fase-3c-ingin-bertemu-design.md` §11.1.

Jangan mengubah apa pun di spec induk selain dua butir itu. Berkas itu adalah otoritas seluruh proyek.

- [ ] **Step 2: Jalankan verifikasi batas global dan laporkan keluarannya apa adanya**

```
pnpm -r test
pnpm -r typecheck
git diff --stat main..HEAD -- packages/trust
grep -rn "recomputeTrust\|onChanged" apps/api/src/routes/meet.ts
grep -rn "trust_snapshots" apps/api/src/meet-store.ts | grep -iE "insert|update|upsert|delete"
grep -rnE "bscTestnet|writeContract|submitConnect|submitVouch" apps/api/src/meet-*.ts apps/api/src/routes/meet.ts
```

Yang diharapkan: seluruh tes hijau, typecheck bersih, diff `packages/trust` **KOSONG**, dan **ketiga grep terakhir tidak menghasilkan apa pun** — rute meet tidak memanggil recompute, store meet tidak menulis ke `trust_snapshots`, dan tidak ada yang menyentuh chain.

**Kalau ada yang tidak sesuai harapan, JANGAN memperbaikinya sendiri** — laporkan apa adanya beserta keluaran mentahnya dan hentikan langkah berikutnya. Itu berarti ada batas global yang dilanggar, dan itu keputusan controller.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-03-nearly-design.md
git commit -m "docs: perbaiki dua butir §7.6 setelah keputusan Fase 3c"
```

- [ ] **Step 4: Serahkan ke pemilik project**

Sisanya **dikerjakan pemilik project**, dan controller berhenti di sini:

1. **Terapkan `supabase/migrations/0005_meet.sql`** lewat Supabase SQL Editor. Ia membuat tabel `ingin_bertemu` DAN menambah kolom `cocok_dilihat_at` ke `profiles` — perhatikan bahwa `alter table` itu menyentuh tabel yang sudah dipakai Fase 1.

2. **Uji jalur lengkap** dari dua perangkat:
   - A membuka feed, menekan "Ingin bertemu" pada unggahan B → angka di profil B naik
   - B membuka profil A dan menandai balik → **kedua perangkat** menampilkan "Kalian saling ingin bertemu"
   - Beranda kedua perangkat menampilkan lencana; membuka layar kecocokan menghilangkannya
   - A mencabut tandanya → kecocokan hilang dari kedua daftar, dan angka di profil B turun
   - A membuat acara, B RSVP → layar acara di perangkat A menampilkan "1 orang yang kamu tandai sudah RSVP"

3. **Uji penjaga privasi lewat curl**, karena inilah yang tidak bisa dibuktikan tes:
   - `GET /profile/<alamat>` tanpa parameter → `inginBertemuCount` ADA, `sudahKutandai` TIDAK ADA
   - `GET /profile/<alamat>?who=<alamat-lain>` tanpa tanda tangan → tetap tidak ada bendera pribadi
   - `GET /kecocokan` tanpa tanda tangan → **403**, bukan daftar kosong
   - `POST /ingin-bertemu` dengan `target` sama dengan `who` → **400** `tandai_diri`

Setelah lolos, `superpowers:finishing-a-development-branch` memutuskan integrasi ke `main`.

---
