# Fase 3b — Feed (FYP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun feed unggahan yang urutannya ditentukan graf pertemuan fisik, dengan gambar disimpan di BNB Greenfield.

**Architecture:** Feed adalah pipeline lima tahap yang seluruh logika peringkatnya berupa fungsi murni tanpa I/O, mengikuti pola `rankDiscovery` di `apps/api/src/discovery.ts`. Unggahan hidup di Postgres; gambar naik ke Greenfield secara asinkron di balik port, sehingga Greenfield mati tidak mematikan feed. Tidak ada bagian fase ini yang menyentuh blockchain BSC.

**Tech Stack:** pnpm monorepo · TypeScript strict · Hono · Supabase (service role) · viem (EIP-712) · Zod · Vitest · Expo Router / React Native · `@bnb-chain/greenfield-js-sdk`

**Spec:** `docs/superpowers/specs/2026-09-07-nearly-fase-3b-feed-design.md`

## Global Constraints

- **`packages/trust` TIDAK BOLEH DISENTUH.** Dibuktikan `git diff --stat <base>..HEAD -- packages/trust` kosong (spec §13.4).
- **Feed hanya MEMBACA `trust_snapshots`, tidak pernah menulis** (spec §13.5).
- **Tidak ada bagian fase ini yang menyentuh chain BSC.** Tanpa kontrak baru, tanpa transaksi (spec §2.3).
- **Tipe EIP-712 `Post` dan `Like` tidak boleh punya pasangan typehash di Solidity mana pun** (spec §5).
- Domain EIP-712: `{ name: "Nearly", version: "1", chainId: 97, verifyingContract: <ConnectionRegistry> }`.
- **Tidak ada balasan, repost, atau kutipan** (spec §2.2, §12).
- **Semua suka dihitung**, tanpa pembobotan trust (spec §2 tabel).
- Teks unggahan **1–500 karakter**; **paling banyak satu gambar**, maksimal **2 MB setelah dekode** (spec §9.1).
- Ambang penyembunyian laporan: **3 pelapor berbeda** (spec §4.3).
- Slot pendatang baru wajib **`1 ≤ koneksi < 3`** — batas bawah 1 menutup promosi bot (spec §6.6).
- RLS menyala di setiap tabel baru, **tanpa policy**.
- Semua pesan galat yang terlihat pengguna berbahasa Indonesia.
- Setiap konstanta peringkat diekspor dan dikunci tes: ubah satu angka, satu tes merah (spec §13.1).

---

## Struktur Berkas

| Berkas | Tanggung jawab |
|---|---|
| `packages/shared/src/feed.ts` | Tipe EIP-712 `Post` & `Like`, `makePostId`, recover |
| `packages/shared/src/schema.ts` (ubah) | Skema Zod permintaan feed |
| `packages/shared/src/index.ts` (ubah) | Ekspor `./feed` |
| `supabase/migrations/0004_feed.sql` | `posts`, `post_likes`, `post_reports` |
| `apps/api/src/ports.ts` (ubah) | `PostRecord`, `FeedCandidate`, `FeedRow`, `FeedStore`, `GreenfieldPort`, `FeedDeps` |
| `apps/api/src/feed-rank.ts` | Penilai murni — skor, diversitas, slot, penyaring |
| `apps/api/src/feed-gate.ts` | Gerbang: buat, hapus, suka, lapor, lampirkan gambar |
| `apps/api/src/feed-store.ts` | Akses Supabase |
| `apps/api/src/greenfield.ts` | Adapter Greenfield nyata |
| `apps/api/src/routes/feed.ts` | Enam endpoint |
| `apps/api/src/app.ts` (ubah) | Perakitan rute |
| `apps/api/src/index.ts` (ubah) | Env + perakitan adapter |
| `apps/mobile/src/http.ts` | Klien HTTP bersama (baru — bayar utang duplikasi) |
| `apps/mobile/src/api.ts` (ubah) | Pakai `http.ts` |
| `apps/mobile/src/events-api.ts` (ubah) | Pakai `http.ts` |
| `apps/mobile/src/feed-api.ts` | Klien feed |
| `apps/mobile/src/messages.ts` (ubah) | `feedErrorMessage` |
| `apps/mobile/app/feed/index.tsx` | Layar feed |
| `apps/mobile/app/feed/new.tsx` | Layar tulis |
| `apps/mobile/app/index.tsx` (ubah) | Tautan "Feed" |
| `.env.example` (ubah) | Empat variabel Greenfield |
| `docs/superpowers/specs/2026-09-03-nearly-design.md` (ubah) | Perbaiki kalimat urutan fase §11 |

---

## Task 1: Empat tipe EIP-712 feed

**Files:**
- Create: `packages/shared/src/feed.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/test/feed.test.ts`, `packages/shared/test/feed-typehash.test.ts`

**Interfaces:**
- Consumes: `NEARLY_CHAIN_ID` dari `packages/shared/src/handshake.ts`.
- Produces:
  - `type PostMessage = { postId: Hex; author: Address; body: string; expiresAt: bigint }`
  - `type LikeMessage = { postId: Hex; who: Address; suka: boolean; expiresAt: bigint }`
  - `type HapusPostMessage = { postId: Hex; author: Address; expiresAt: bigint }`
  - `type LampirGambarMessage = { postId: Hex; author: Address; mime: string; expiresAt: bigint }`
  - `makePostId(): Hex`
  - `postTypedData`, `likeTypedData`, `hapusPostTypedData`, `lampirGambarTypedData`
  - `recoverPostSigner`, `recoverLikeSigner`, `recoverHapusPostSigner`, `recoverLampirGambarSigner`
  - `FEED_TYPES`

**Kenapa empat tipe, bukan satu `Post` yang dipakai ulang (spec §5).** Menghapus dan
melampirkan gambar sama-sama membuktikan "aku penulis unggahan ini", jadi menggoda untuk
memakai ulang tanda tangan `Post`. Itu lubang: tanda tangan yang dibuat untuk MEMPOSTING
akan sah pula sebagai perintah MENGHAPUS, sehingga siapa pun yang menangkapnya bisa
menghapus unggahan orang itu. Kelas kesalahan yang sama dengan Ruling 23 di Fase 3a.

- [ ] **Step 1: Tulis tes yang gagal**

`packages/shared/test/feed.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  hapusPostTypedData, lampirGambarTypedData, likeTypedData, makePostId, postTypedData,
  recoverHapusPostSigner, recoverLampirGambarSigner, recoverLikeSigner, recoverPostSigner,
} from "../src/feed";

const KEY = `0x${"11".repeat(32)}` as Hex;
const akun = privateKeyToAccount(KEY);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const EXP = 1_800_000_000n;

describe("makePostId", () => {
  it("menghasilkan bytes32 heksa lowercase", () => {
    expect(makePostId()).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("tidak pernah menghasilkan dua id yang sama", () => {
    const kumpulan = new Set(Array.from({ length: 200 }, () => makePostId()));
    expect(kumpulan.size).toBe(200);
  });
});

describe("tanda tangan Post", () => {
  const pesan = {
    postId: makePostId(), author: akun.address, body: "halo", expiresAt: EXP,
  };

  it("memulihkan penanda tangan", async () => {
    const sig = await akun.signTypedData(postTypedData(pesan, KONTRAK));
    expect((await recoverPostSigner(pesan, sig, KONTRAK)).toLowerCase())
      .toBe(akun.address.toLowerCase());
  });

  // Body ikut ditandatangani: kalau tidak, siapa pun bisa menukar isi
  // unggahan sambil memakai tanda tangan yang sah.
  it("body yang diubah membuat pemulihan meleset", async () => {
    const sig = await akun.signTypedData(postTypedData(pesan, KONTRAK));
    const dipalsu = { ...pesan, body: "halo!" };
    expect((await recoverPostSigner(dipalsu, sig, KONTRAK)).toLowerCase())
      .not.toBe(akun.address.toLowerCase());
  });

  it("kontrak domain yang berbeda membuat pemulihan meleset", async () => {
    const sig = await akun.signTypedData(postTypedData(pesan, KONTRAK));
    const lain = "0x000000000000000000000000000000000000beef" as Address;
    expect((await recoverPostSigner(pesan, sig, lain)).toLowerCase())
      .not.toBe(akun.address.toLowerCase());
  });
});

describe("tanda tangan Like", () => {
  const dasar = { postId: makePostId(), who: akun.address, expiresAt: EXP };

  it("memulihkan penanda tangan", async () => {
    const pesan = { ...dasar, suka: true };
    const sig = await akun.signTypedData(likeTypedData(pesan, KONTRAK));
    expect((await recoverLikeSigner(pesan, sig, KONTRAK)).toLowerCase())
      .toBe(akun.address.toLowerCase());
  });

  // `suka` bool berarti PEMBATALAN ikut ditandatangani. Tanpa ini, satu
  // tanda tangan bisa dipakai untuk menyukai DAN membatalkan.
  it("tanda tangan suka:true TIDAK sah sebagai suka:false", async () => {
    const sig = await akun.signTypedData(likeTypedData({ ...dasar, suka: true }, KONTRAK));
    const batal = { ...dasar, suka: false };
    expect((await recoverLikeSigner(batal, sig, KONTRAK)).toLowerCase())
      .not.toBe(akun.address.toLowerCase());
  });
});

/**
 * Penjaga langsung terhadap kelas kesalahan Ruling 23. Kalau salah satu tes
 * di bawah ini berubah hijau menjadi "cocok", artinya dua perintah berbeda
 * menerima tanda tangan yang sama dan satu bisa diputar ulang sebagai yang
 * lain.
 */
describe("tanda tangan tidak boleh menyeberang antar perintah", () => {
  const postId = makePostId();
  const dasar = { postId, author: akun.address, expiresAt: EXP };

  it("tanda tangan Post TIDAK sah sebagai HapusPost", async () => {
    const sig = await akun.signTypedData(
      postTypedData({ ...dasar, body: "halo" }, KONTRAK));
    expect((await recoverHapusPostSigner(dasar, sig, KONTRAK)).toLowerCase())
      .not.toBe(akun.address.toLowerCase());
  });

  it("tanda tangan Post TIDAK sah sebagai LampirGambar", async () => {
    const sig = await akun.signTypedData(
      postTypedData({ ...dasar, body: "halo" }, KONTRAK));
    const lampir = { ...dasar, mime: "image/jpeg" };
    expect((await recoverLampirGambarSigner(lampir, sig, KONTRAK)).toLowerCase())
      .not.toBe(akun.address.toLowerCase());
  });

  it("tanda tangan HapusPost TIDAK sah sebagai LampirGambar", async () => {
    const sig = await akun.signTypedData(hapusPostTypedData(dasar, KONTRAK));
    const lampir = { ...dasar, mime: "image/jpeg" };
    expect((await recoverLampirGambarSigner(lampir, sig, KONTRAK)).toLowerCase())
      .not.toBe(akun.address.toLowerCase());
  });

  it("HapusPost memulihkan penanda tangannya sendiri", async () => {
    const sig = await akun.signTypedData(hapusPostTypedData(dasar, KONTRAK));
    expect((await recoverHapusPostSigner(dasar, sig, KONTRAK)).toLowerCase())
      .toBe(akun.address.toLowerCase());
  });

  // mime ikut ditandatangani: tanda tangan untuk JPEG tidak boleh dipakai
  // melampirkan tipe berkas lain.
  it("mime yang diubah membuat LampirGambar meleset", async () => {
    const lampir = { ...dasar, mime: "image/jpeg" };
    const sig = await akun.signTypedData(lampirGambarTypedData(lampir, KONTRAK));
    const ditukar = { ...dasar, mime: "image/png" };
    expect((await recoverLampirGambarSigner(ditukar, sig, KONTRAK)).toLowerCase())
      .not.toBe(akun.address.toLowerCase());
  });
});
```

- [ ] **Step 2: Tulis tes kunci typehash**

`packages/shared/test/feed-typehash.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FEED_TYPES } from "../src/feed";
import { EVENT_TYPES } from "../src/event";

/**
 * Pelajaran Ruling 23 Fase 3a: dua tipe EIP-712 berbentuk field sama tapi
 * bernama beda menghasilkan digest beda — dan itulah satu-satunya hal yang
 * mencegah tanda tangan baca dipakai ulang sebagai perintah tulis. Tes ini
 * menjaga arah sebaliknya: memastikan tidak ada NAMA tipe yang bertabrakan.
 */
function encodeType(nama: string, fields: readonly { name: string; type: string }[]): string {
  return `${nama}(${fields.map((f) => `${f.type} ${f.name}`).join(",")})`;
}

const SOL_DIR = fileURLToPath(new URL("../../contracts/src/", import.meta.url));

describe("tipe EIP-712 feed", () => {
  it("keempat nama tidak bertabrakan dengan tipe mana pun yang sudah ada", () => {
    const lama = Object.keys(EVENT_TYPES);
    for (const nama of ["Post", "Like", "HapusPost", "LampirGambar"]) {
      expect(lama).not.toContain(nama);
    }
  });

  it("keempat encodeType saling berbeda", () => {
    const semua = Object.entries(FEED_TYPES).map(([n, f]) => encodeType(n, f));
    expect(new Set(semua).size).toBe(4);
  });

  // Post dan Like TIDAK PERNAH naik on-chain (spec §5). Kalau suatu hari ada
  // typehash-nya di Solidity, itu tanda seseorang mulai mengirimnya ke chain
  // dan aturan fase ini bocor.
  it("tidak ada typehash feed di Solidity mana pun", () => {
    for (const berkas of ["ConnectionRegistry.sol", "VouchRegistry.sol", "AttendanceRegistry.sol"]) {
      const sumber = readFileSync(`${SOL_DIR}${berkas}`, "utf8");
      for (const nama of ["Post(", "Like(", "HapusPost(", "LampirGambar("]) {
        expect(sumber).not.toContain(nama);
      }
    }
  });

  it("encodeType Post persis seperti yang didokumentasikan spec §5", () => {
    expect(encodeType("Post", FEED_TYPES.Post))
      .toBe("Post(bytes32 postId,address author,string body,uint64 expiresAt)");
  });

  it("encodeType Like persis seperti yang didokumentasikan spec §5", () => {
    expect(encodeType("Like", FEED_TYPES.Like))
      .toBe("Like(bytes32 postId,address who,bool suka,uint64 expiresAt)");
  });

  it("encodeType HapusPost persis seperti yang didokumentasikan spec §5", () => {
    expect(encodeType("HapusPost", FEED_TYPES.HapusPost))
      .toBe("HapusPost(bytes32 postId,address author,uint64 expiresAt)");
  });

  it("encodeType LampirGambar persis seperti yang didokumentasikan spec §5", () => {
    expect(encodeType("LampirGambar", FEED_TYPES.LampirGambar))
      .toBe("LampirGambar(bytes32 postId,address author,string mime,uint64 expiresAt)");
  });
});
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/shared test`
Expected: FAIL — `Cannot find module '../src/feed'`

- [ ] **Step 4: Tulis implementasinya**

`packages/shared/src/feed.ts`:

```ts
import { bytesToHex, recoverTypedDataAddress, type Address, type Hex } from "viem";
import { NEARLY_CHAIN_ID } from "./handshake";

/**
 * Unggahan feed. TIDAK PERNAH naik on-chain (spec §2.3) — karena itu tipe ini
 * tidak boleh punya pasangan typehash di Solidity mana pun, sama seperti
 * `Rsvp` dan `LihatEvent` di Fase 3a.
 *
 * Tetap ditandatangani karena tanpa itu `author` datang telanjang dari body
 * request, dan siapa pun bisa memposting atas nama orang lain.
 */
export type PostMessage = {
  postId: Hex;
  author: Address;
  body: string;
  expiresAt: bigint;
};

/**
 * `suka` sengaja bool, bukan dua tipe terpisah: dengan begini PEMBATALAN ikut
 * ditandatangani. Kalau pembatalan tidak bertanda tangan, siapa pun bisa
 * menghapus suka orang lain lewat body request.
 */
export type LikeMessage = {
  postId: Hex;
  who: Address;
  suka: boolean;
  expiresAt: bigint;
};

/**
 * Tipe TERPISAH dari `Post`, dan itu wajib (spec §5). Menghapus juga sekadar
 * membuktikan "aku penulis unggahan ini", jadi menggoda memakai ulang tanda
 * tangan `Post`. Kalau begitu, tanda tangan yang dibuat untuk MEMPOSTING sah
 * pula sebagai perintah MENGHAPUS, dan siapa pun yang menangkapnya bisa
 * menghapus unggahan orang itu. Kelas kesalahan Ruling 23.
 */
export type HapusPostMessage = {
  postId: Hex;
  author: Address;
  expiresAt: bigint;
};

/** `mime` ikut ditandatangani supaya tanda tangan untuk JPEG tidak bisa
 * dipakai melampirkan tipe berkas lain. */
export type LampirGambarMessage = {
  postId: Hex;
  author: Address;
  mime: string;
  expiresAt: bigint;
};

const TYPES = {
  Post: [
    { name: "postId", type: "bytes32" },
    { name: "author", type: "address" },
    { name: "body", type: "string" },
    { name: "expiresAt", type: "uint64" },
  ],
  Like: [
    { name: "postId", type: "bytes32" },
    { name: "who", type: "address" },
    { name: "suka", type: "bool" },
    { name: "expiresAt", type: "uint64" },
  ],
  HapusPost: [
    { name: "postId", type: "bytes32" },
    { name: "author", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
  LampirGambar: [
    { name: "postId", type: "bytes32" },
    { name: "author", type: "address" },
    { name: "mime", type: "string" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const FEED_TYPES = TYPES;

function domain(verifyingContract: Address) {
  return { name: "Nearly", version: "1", chainId: NEARLY_CHAIN_ID, verifyingContract } as const;
}

export function makePostId(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function postTypedData(msg: PostMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { Post: TYPES.Post },
    primaryType: "Post",
    message: msg,
  } as const;
}

export function likeTypedData(msg: LikeMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { Like: TYPES.Like },
    primaryType: "Like",
    message: msg,
  } as const;
}

export function recoverPostSigner(
  msg: PostMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...postTypedData(msg, verifyingContract), signature });
}

export function hapusPostTypedData(msg: HapusPostMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { HapusPost: TYPES.HapusPost },
    primaryType: "HapusPost",
    message: msg,
  } as const;
}

export function lampirGambarTypedData(msg: LampirGambarMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { LampirGambar: TYPES.LampirGambar },
    primaryType: "LampirGambar",
    message: msg,
  } as const;
}

export function recoverLikeSigner(
  msg: LikeMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...likeTypedData(msg, verifyingContract), signature });
}

export function recoverHapusPostSigner(
  msg: HapusPostMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...hapusPostTypedData(msg, verifyingContract), signature });
}

export function recoverLampirGambarSigner(
  msg: LampirGambarMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...lampirGambarTypedData(msg, verifyingContract), signature });
}
```

- [ ] **Step 5: Ekspor dari barrel**

Tambahkan satu baris di akhir `packages/shared/src/index.ts`:

```ts
export * from "./feed";
```

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/shared test && pnpm --filter @nearly/shared typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/feed.ts packages/shared/src/index.ts packages/shared/test/feed.test.ts packages/shared/test/feed-typehash.test.ts
git commit -m "feat(shared): empat tipe EIP-712 feed dengan pemisah perintah"
```

---

## Task 2: Skema Zod permintaan feed

**Files:**
- Modify: `packages/shared/src/schema.ts`
- Test: `packages/shared/test/schema-feed.test.ts`

**Interfaces:**
- Consumes: helper privat `address`, `bytes32`, `signature`, `unixSeconds` yang sudah ada di `schema.ts`.
- Produces: `CreatePostRequestSchema`, `LikeRequestSchema`, `ReportPostRequestSchema`, `DeletePostRequestSchema`, `AttachImageRequestSchema`.

**Catatan wajib untuk implementer:** `unixSeconds` sudah ada di `schema.ts` sebagai `z.string().regex(/^\d+$/)`. Pakai itu, jangan bikin baru. Skema di sini **tidak boleh** memakai `.refine` yang memanggil `BigInt()` — Zod tetap menjalankan `.refine` walau validasi field gagal (status "dirty", bukan "aborted"), sehingga `BigInt("besok")` melempar `SyntaxError` yang lolos dari `safeParse` dan berubah jadi 500, bukan 400. Ini pelajaran nyata dari Fase 3a.

- [ ] **Step 1: Tulis tes yang gagal**

`packages/shared/test/schema-feed.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  AttachImageRequestSchema, CreatePostRequestSchema, DeletePostRequestSchema,
  LikeRequestSchema, ReportPostRequestSchema,
} from "../src/schema";

const ADDR = `0x${"a".repeat(40)}`;
const ID = `0x${"1".repeat(64)}`;
const SIG = `0x${"b".repeat(130)}`;

function post(over: Record<string, unknown> = {}) {
  return { postId: ID, author: ADDR, body: "halo dunia", expiresAt: "1800000000", sig: SIG, ...over };
}

describe("CreatePostRequestSchema", () => {
  it("menerima permintaan yang benar", () => {
    expect(CreatePostRequestSchema.safeParse(post()).success).toBe(true);
  });

  it("menolak body kosong", () => {
    expect(CreatePostRequestSchema.safeParse(post({ body: "" })).success).toBe(false);
  });

  it("menolak body lebih dari 500 karakter", () => {
    expect(CreatePostRequestSchema.safeParse(post({ body: "a".repeat(501) })).success).toBe(false);
  });

  it("menerima body tepat 500 karakter", () => {
    expect(CreatePostRequestSchema.safeParse(post({ body: "a".repeat(500) })).success).toBe(true);
  });

  // Bukan 500. Fase 3a menemukan bahwa refine yang memanggil BigInt() atas
  // masukan bukan angka melempar SyntaxError yang lolos dari safeParse.
  it("menolak expiresAt bukan angka tanpa melempar", () => {
    expect(() => CreatePostRequestSchema.safeParse(post({ expiresAt: "besok" }))).not.toThrow();
    expect(CreatePostRequestSchema.safeParse(post({ expiresAt: "besok" })).success).toBe(false);
  });
});

describe("LikeRequestSchema", () => {
  const dasar = { postId: ID, who: ADDR, suka: true, expiresAt: "1800000000", sig: SIG };

  it("menerima suka true", () => {
    expect(LikeRequestSchema.safeParse(dasar).success).toBe(true);
  });

  it("menerima suka false", () => {
    expect(LikeRequestSchema.safeParse({ ...dasar, suka: false }).success).toBe(true);
  });

  // "true" string BUKAN boolean. Tipe EIP-712-nya bool, jadi menerima string
  // di sini menghasilkan digest yang berbeda tanpa suara.
  it("menolak suka berupa string", () => {
    expect(LikeRequestSchema.safeParse({ ...dasar, suka: "true" }).success).toBe(false);
  });
});

describe("ReportPostRequestSchema", () => {
  const dasar = { postId: ID, reporter: ADDR, reason: "spam berulang di feed" };

  it("menerima alasan yang cukup panjang", () => {
    expect(ReportPostRequestSchema.safeParse(dasar).success).toBe(true);
  });

  it("menolak alasan terlalu pendek", () => {
    expect(ReportPostRequestSchema.safeParse({ ...dasar, reason: "jelek" }).success).toBe(false);
  });
});

describe("DeletePostRequestSchema", () => {
  const dasar = { postId: ID, author: ADDR, expiresAt: "1800000000", sig: SIG };

  it("menerima permintaan hapus yang benar", () => {
    expect(DeletePostRequestSchema.safeParse(dasar).success).toBe(true);
  });

  // Hapus memakai tanda tangan HapusPost, yang TIDAK mengikat body. Menerima
  // body di sini cuma mengundang klien mengira body itu ikut diverifikasi.
  it("tidak menuntut body", () => {
    expect("body" in DeletePostRequestSchema.parse(dasar)).toBe(false);
  });
});

describe("AttachImageRequestSchema", () => {
  const dasar = {
    postId: ID, author: ADDR, expiresAt: "1800000000", sig: SIG,
    mime: "image/jpeg", dataBase64: "aGFsbw==",
  };

  it("menerima jpeg", () => {
    expect(AttachImageRequestSchema.safeParse(dasar).success).toBe(true);
  });

  it("menerima png", () => {
    expect(AttachImageRequestSchema.safeParse({ ...dasar, mime: "image/png" }).success).toBe(true);
  });

  // Tanpa daftar putih, apa pun bisa diunggah ke Greenfield dan disajikan
  // kembali dari domain storage provider.
  it("menolak mime di luar daftar putih", () => {
    expect(AttachImageRequestSchema.safeParse({ ...dasar, mime: "text/html" }).success).toBe(false);
  });

  it("menolak base64 kosong", () => {
    expect(AttachImageRequestSchema.safeParse({ ...dasar, dataBase64: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/shared test schema-feed`
Expected: FAIL — `CreatePostRequestSchema is not exported`

- [ ] **Step 3: Tambahkan skema di akhir `packages/shared/src/schema.ts`**

```ts
/** Spec §2: teks 1–500 karakter. */
const postBody = z.string().min(1).max(500);

export const CreatePostRequestSchema = z.object({
  postId: bytes32,
  author: address,
  body: postBody,
  expiresAt: unixSeconds,
  sig: signature,
});

export const LikeRequestSchema = z.object({
  postId: bytes32,
  who: address,
  // Wajib boolean asli: tipe EIP-712-nya `bool`, dan "true" berupa string
  // akan menghasilkan digest yang berbeda tanpa suara.
  suka: z.boolean(),
  expiresAt: unixSeconds,
  sig: signature,
});

export const ReportPostRequestSchema = z.object({
  postId: bytes32,
  reporter: address,
  reason: z.string().min(10).max(1000),
});

/**
 * Hapus memakai tipe EIP-712 `HapusPost` yang TERPISAH dari `Post` (spec §5).
 * Kalau memakai ulang `Post`, tanda tangan yang dibuat untuk memposting akan
 * sah sebagai perintah menghapus.
 */
export const DeletePostRequestSchema = z.object({
  postId: bytes32,
  author: address,
  expiresAt: unixSeconds,
  sig: signature,
});

/** Daftar putih mime. Tanpa ini, apa pun bisa disajikan dari domain SP. */
const imageMime = z.enum(["image/jpeg", "image/png"]);

/** Memakai tipe `LampirGambar`, yang mengikat `mime` juga (spec §5). */
export const AttachImageRequestSchema = z.object({
  postId: bytes32,
  author: address,
  expiresAt: unixSeconds,
  sig: signature,
  mime: imageMime,
  dataBase64: z.string().min(1),
});
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/shared test && pnpm --filter @nearly/shared typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schema.ts packages/shared/test/schema-feed.test.ts
git commit -m "feat(shared): skema Zod permintaan feed"
```

---

## Task 3: Migrasi `0004_feed.sql`

**Files:**
- Create: `supabase/migrations/0004_feed.sql`

**Interfaces:**
- Produces: tabel `posts`, `post_likes`, `post_reports` yang dipakai Task 10.

**Catatan:** migrasi ini **tidak dijalankan** di task ini — Supabase CLI tidak terpasang di mesin pengembangan. Penerapannya masuk Task 15 bersama verifikasi lapangan, persis seperti `0003_events.sql` di Fase 3a.

- [ ] **Step 1: Tulis migrasinya**

`supabase/migrations/0004_feed.sql`:

```sql
-- Fase 3b — Feed. Tidak ada bagian fase ini yang menyentuh chain BSC.

create table if not exists posts (
  post_id      text primary key check (post_id ~ '^0x[0-9a-f]{64}$'),
  author       text not null references profiles(address) on delete cascade,
  body         text not null check (char_length(body) between 1 and 500),
  -- Greenfield disimpan sebagai bucket + object, BUKAN URL jadi: endpoint
  -- storage provider bisa berubah tanpa membusukkan baris lama.
  image_bucket text,
  image_object text,
  image_mime   text,
  image_status text not null default 'none'
               check (image_status in ('none', 'pending', 'ready', 'failed')),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- Kandidat feed selalu diambil per jendela waktu terbaru (spec §11.6).
create index if not exists posts_created_at_idx on posts (created_at desc);
create index if not exists posts_author_idx on posts (author);

create table if not exists post_likes (
  post_id    text not null references posts(post_id) on delete cascade,
  address    text not null references profiles(address) on delete cascade,
  created_at timestamptz not null default now(),
  -- Satu suka per alamat per unggahan. Membatalkan suka = menghapus baris.
  primary key (post_id, address)
);

create table if not exists post_reports (
  post_id    text not null references posts(post_id) on delete cascade,
  reporter   text not null check (reporter ~ '^0x[0-9a-f]{40}$'),
  reason     text not null,
  created_at timestamptz not null default now(),
  -- Menutup cara termurah menembus ambang: satu orang melapor berkali-kali
  -- supaya terhitung beberapa pelapor. Sama seperti reports_one_vote.
  primary key (post_id, reporter)
);

-- RLS menyala tanpa policy, sama seperti setiap tabel lain di proyek ini.
-- API mengakses lewat service role key yang melewati RLS; tidak ada satu pun
-- jalur baca anonim langsung ke Postgres.
alter table posts enable row level security;
alter table post_likes enable row level security;
alter table post_reports enable row level security;
```

- [ ] **Step 2: Periksa bentuk migrasinya**

Run: `grep -c "create table if not exists" supabase/migrations/0004_feed.sql`
Expected: `3`

Run: `grep -c "enable row level security" supabase/migrations/0004_feed.sql`
Expected: `3`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_feed.sql
git commit -m "feat(db): migrasi tabel posts, post_likes, post_reports"
```

---

## Task 4: Port dan tipe feed

**Files:**
- Modify: `apps/api/src/ports.ts`
- Test: `apps/api/test/feed-ports.test.ts`

**Interfaces:**
- Consumes: `Address`, `Hex` dari viem.
- Produces (dipakai Task 5–12):

```ts
type ImageStatus = "none" | "pending" | "ready" | "failed";
type PostRecord = { postId; author; body; imageBucket; imageObject; imageMime; imageStatus; createdAtMs; deleted };
type FeedCandidate = PostRecord & { authorRatio; authorTier; authorConnections; authorSlashed; reportCount; likeCount; sudahSuka; hop; displayName };
type FeedRow = { postId; author; displayName; tier; body; imageUrl; imageStatus; likeCount; sudahSuka; hop; createdAtMs };
type FeedStore = { … }
type GreenfieldPort = { bucket; spEndpoint; upload(…) }
type FeedDeps = { feed; greenfield; verifyingContract; nowMs }
```

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/feed-ports.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import { imageUrlOf } from "../src/ports";

const SP = "https://gnfd-testnet-sp-2.bnbchain.org";

describe("imageUrlOf", () => {
  it("membangun URL /view/ dari bucket dan object", () => {
    expect(imageUrlOf(SP, "nearly-feed", "abc.jpg"))
      .toBe("https://gnfd-testnet-sp-2.bnbchain.org/view/nearly-feed/abc.jpg");
  });

  it("tidak menggandakan garis miring kalau endpoint diakhiri /", () => {
    expect(imageUrlOf(`${SP}/`, "nearly-feed", "abc.jpg"))
      .toBe("https://gnfd-testnet-sp-2.bnbchain.org/view/nearly-feed/abc.jpg");
  });

  // Disimpan sebagai bucket+object, bukan URL jadi (spec §8.1). Kalau salah
  // satunya belum ada, tidak ada URL yang bisa dibangun.
  it("mengembalikan null kalau bucket atau object kosong", () => {
    expect(imageUrlOf(SP, null, "abc.jpg")).toBeNull();
    expect(imageUrlOf(SP, "nearly-feed", null)).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test feed-ports`
Expected: FAIL — `imageUrlOf is not exported`

- [ ] **Step 3: Tambahkan tipe dan helper di akhir `apps/api/src/ports.ts`**

```ts
export type ImageStatus = "none" | "pending" | "ready" | "failed";

export type PostRecord = {
  postId: Hex;
  author: Address;
  body: string;
  imageBucket: string | null;
  imageObject: string | null;
  imageMime: string | null;
  imageStatus: ImageStatus;
  /** MILIDETIK. */
  createdAtMs: number;
  deleted: boolean;
};

/**
 * Satu kandidat sebelum diperingkat. Semua medan turunan sudah dihidrasi di
 * store, supaya penilai tetap murni dan bisa diuji tanpa Supabase — pola yang
 * sama dengan DiscoveryCandidate di discovery.ts.
 */
export type FeedCandidate = PostRecord & {
  displayName: string;
  /** `ratio` dari trust_snapshots. 0 kalau penulis belum punya snapshot. */
  authorRatio: number;
  authorTier: number;
  authorConnections: number;
  authorSlashed: boolean;
  reportCount: number;
  likeCount: number;
  sudahSuka: boolean;
  /** 1, 2, atau null (luar jaringan / penonton anonim). */
  hop: 1 | 2 | null;
};

/** Satu kartu di feed, siap dikirim sebagai JSON. */
export type FeedRow = {
  postId: Hex;
  author: Address;
  displayName: string;
  tier: number;
  body: string;
  imageUrl: string | null;
  imageStatus: ImageStatus;
  likeCount: number;
  sudahSuka: boolean;
  hop: 1 | 2 | null;
  createdAtMs: number;
};

/**
 * URL baca publik Greenfield (spec §8.1). Dibangun saat baca, TIDAK disimpan —
 * endpoint storage provider bisa berubah tanpa membusukkan baris lama.
 */
export function imageUrlOf(
  spEndpoint: string, bucket: string | null, objectName: string | null,
): string | null {
  if (!bucket || !objectName) return null;
  return `${spEndpoint.replace(/\/+$/, "")}/view/${bucket}/${objectName}`;
}

export type FeedStore = {
  createPost(row: { postId: Hex; author: Address; body: string; createdAtMs: number }): Promise<void>;
  getPost(postId: Hex): Promise<PostRecord | null>;
  markDeleted(postId: Hex): Promise<void>;
  /** Idempoten: menyukai dua kali sama dengan sekali. */
  setLike(postId: Hex, who: Address, suka: boolean): Promise<void>;
  /** Idempoten lewat primary key gabungan (post_id, reporter). */
  addReport(postId: Hex, reporter: Address, reason: string): Promise<void>;
  setImagePending(postId: Hex, objectName: string, mime: string): Promise<void>;
  setImageDone(postId: Hex, bucket: string): Promise<void>;
  setImageFailed(postId: Hex): Promise<void>;
  /**
   * Sudah terhidrasi penuh dan siap diperingkat. `viewer` null berarti
   * penonton anonim: setiap `hop` null dan `sudahSuka` false (spec §6.5).
   */
  listCandidates(a: {
    sinceMs: number; limit: number; viewer: Address | null;
  }): Promise<FeedCandidate[]>;
};

export type GreenfieldPort = {
  bucket: string;
  spEndpoint: string;
  upload(a: { objectName: string; mime: string; bytes: Uint8Array }): Promise<void>;
};

export type FeedDeps = {
  feed: FeedStore;
  greenfield: GreenfieldPort;
  /** Alamat ConnectionRegistry — domain EIP-712 feed terikat padanya (spec §5). */
  verifyingContract: Address;
  nowMs: () => number;
};
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test feed-ports && pnpm --filter @nearly/api typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ports.ts apps/api/test/feed-ports.test.ts
git commit -m "feat(api): port dan tipe feed"
```

---

## Task 5: Penilai murni — rumus skor

**Files:**
- Create: `apps/api/src/feed-rank.ts`
- Test: `apps/api/test/feed-score.test.ts`

**Interfaces:**
- Consumes: `SCORE_SCALE` dari `apps/api/src/trust/recompute.ts` (nilainya `1_000_000`); `FeedCandidate` dari Task 4.
- Produces: `BOBOT_TRUST`, `BOBOT_SUKA`, `BOBOT_BARU`, `JARAK_1_HOP`, `JARAK_2_HOP`, `JARAK_LUAR`, `PARUH_WAKTU_JAM`, `SUKA_JENUH`, `DIVERSITAS_PELURUHAN`, `DIVERSITAS_LANTAI`, `basisTrust`, `faktorJarak`, `faktorKebaruan`, `faktorSuka`, `skorAwal`, `pengaliDiversitas`.

**Rumus mengikat (spec §6.1) — jangan diubah tanpa mengubah spec:**

```
basis      = ln(1 + rasio × SCORE_SCALE) / ln(1 + SCORE_SCALE)
jarak      = 1.0 (1 hop) · 0.6 (2 hop) · 0.3 (luar)
kebaruan   = 0.5 ^ (umur_jam / 24)
suka       = min(1, ln(1 + jumlah_suka) / ln(1 + 50))
skor_awal  = (0.5·basis + 0.2·suka + 0.3·kebaruan) × jarak
diversitas = (1 − 0.25) × 0.5^k + 0.25
```

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/feed-score.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import {
  basisTrust, BOBOT_BARU, BOBOT_SUKA, BOBOT_TRUST, DIVERSITAS_LANTAI,
  DIVERSITAS_PELURUHAN, faktorJarak, faktorKebaruan, faktorSuka,
  JARAK_1_HOP, JARAK_2_HOP, JARAK_LUAR, pengaliDiversitas, PARUH_WAKTU_JAM,
  skorAwal, SUKA_JENUH,
} from "../src/feed-rank";
import type { FeedCandidate } from "../src/ports";

const NOW = 1_800_000_000_000;
const JAM = 3_600_000;

function kandidat(over: Partial<FeedCandidate> = {}): FeedCandidate {
  return {
    postId: `0x${"1".repeat(64)}` as Hex,
    author: "0x000000000000000000000000000000000000aaaa" as Address,
    displayName: "Andi",
    body: "halo", imageBucket: null, imageObject: null, imageMime: null,
    imageStatus: "none", createdAtMs: NOW, deleted: false,
    authorRatio: 0.01, authorTier: 1, authorConnections: 5, authorSlashed: false,
    reportCount: 0, likeCount: 0, sudahSuka: false, hop: 1,
    ...over,
  };
}

describe("konstanta terkunci ke spec §6.1", () => {
  it("bobotnya persis 0.5 / 0.2 / 0.3", () => {
    expect(BOBOT_TRUST).toBe(0.5);
    expect(BOBOT_SUKA).toBe(0.2);
    expect(BOBOT_BARU).toBe(0.3);
  });

  it("bobot berjumlah tepat 1", () => {
    expect(BOBOT_TRUST + BOBOT_SUKA + BOBOT_BARU).toBeCloseTo(1, 12);
  });

  it("faktor jarak persis 1.0 / 0.6 / 0.3", () => {
    expect(JARAK_1_HOP).toBe(1.0);
    expect(JARAK_2_HOP).toBe(0.6);
    expect(JARAK_LUAR).toBe(0.3);
  });

  it("paruh waktu 24 jam, kejenuhan suka 50", () => {
    expect(PARUH_WAKTU_JAM).toBe(24);
    expect(SUKA_JENUH).toBe(50);
  });

  it("peluruhan diversitas 0.5 dengan lantai 0.25", () => {
    expect(DIVERSITAS_PELURUHAN).toBe(0.5);
    expect(DIVERSITAS_LANTAI).toBe(0.25);
  });
});

describe("basisTrust", () => {
  it("rasio nol menghasilkan nol, bukan minus tak hingga", () => {
    expect(basisTrust(0)).toBe(0);
    expect(Number.isFinite(basisTrust(0))).toBe(true);
  });

  it("rasio negatif atau NaN diperlakukan sebagai nol", () => {
    expect(basisTrust(-1)).toBe(0);
    expect(basisTrust(Number.NaN)).toBe(0);
  });

  it("rasio 1 — penulis teratas di graf — menghasilkan tepat 1", () => {
    expect(basisTrust(1)).toBeCloseTo(1, 12);
  });

  it("monoton naik", () => {
    expect(basisTrust(0.5)).toBeGreaterThan(basisTrust(0.1));
  });

  /**
   * Inti spec §6.3, dan alasan seluruh kompresi ini ada: tanpa `ln`,
   * ketimpangan 1000x akan membuat peluruhan diversitas tidak menggigit.
   * Setelah kompresi, ketimpangan itu harus jatuh di bawah 3x.
   */
  it("menekan ketimpangan 1000x menjadi di bawah 3x", () => {
    const kecil = basisTrust(0.001);
    const besar = basisTrust(1);
    expect(besar / kecil).toBeLessThan(3);
    expect(besar / kecil).toBeGreaterThan(1);
  });
});

describe("faktorJarak", () => {
  it("1 hop penuh, 2 hop 0.6, luar jaringan 0.3", () => {
    expect(faktorJarak(1)).toBe(1.0);
    expect(faktorJarak(2)).toBe(0.6);
    expect(faktorJarak(null)).toBe(0.3);
  });
});

describe("faktorKebaruan", () => {
  it("unggahan baru bernilai 1", () => {
    expect(faktorKebaruan(NOW, NOW)).toBeCloseTo(1, 12);
  });

  it("tepat 24 jam bernilai setengah", () => {
    expect(faktorKebaruan(NOW - 24 * JAM, NOW)).toBeCloseTo(0.5, 12);
  });

  it("48 jam bernilai seperempat", () => {
    expect(faktorKebaruan(NOW - 48 * JAM, NOW)).toBeCloseTo(0.25, 12);
  });

  // Jam perangkat bisa mundur. Umur negatif tidak boleh membuat skor meledak.
  it("unggahan dari masa depan tidak melebihi 1", () => {
    expect(faktorKebaruan(NOW + 10 * JAM, NOW)).toBe(1);
  });
});

describe("faktorSuka", () => {
  it("tanpa suka bernilai nol", () => {
    expect(faktorSuka(0)).toBe(0);
  });

  it("tepat di titik jenuh bernilai 1", () => {
    expect(faktorSuka(SUKA_JENUH)).toBeCloseTo(1, 12);
  });

  it("dijepit di 1 walau suka jauh melebihi titik jenuh", () => {
    expect(faktorSuka(100_000)).toBe(1);
  });

  it("monoton naik", () => {
    expect(faktorSuka(10)).toBeGreaterThan(faktorSuka(1));
  });
});

describe("skorAwal", () => {
  it("unggahan 1 hop mengalahkan unggahan luar jaringan yang identik", () => {
    const dekat = skorAwal(kandidat({ hop: 1 }), NOW);
    const jauh = skorAwal(kandidat({ hop: null }), NOW);
    expect(dekat).toBeGreaterThan(jauh);
  });

  it("lebih banyak suka menaikkan skor", () => {
    expect(skorAwal(kandidat({ likeCount: 20 }), NOW))
      .toBeGreaterThan(skorAwal(kandidat({ likeCount: 0 }), NOW));
  });

  it("unggahan lebih baru mengalahkan yang lebih lama", () => {
    expect(skorAwal(kandidat({ createdAtMs: NOW }), NOW))
      .toBeGreaterThan(skorAwal(kandidat({ createdAtMs: NOW - 48 * JAM }), NOW));
  });

  it("penulis ber-rasio nol tetap mendapat skor positif dari kebaruan", () => {
    expect(skorAwal(kandidat({ authorRatio: 0 }), NOW)).toBeGreaterThan(0);
  });
});

describe("pengaliDiversitas", () => {
  it("unggahan pertama penulis tidak dikurangi", () => {
    expect(pengaliDiversitas(0)).toBeCloseTo(1, 12);
  });

  it("unggahan kedua 0.625, ketiga 0.4375", () => {
    expect(pengaliDiversitas(1)).toBeCloseTo(0.625, 12);
    expect(pengaliDiversitas(2)).toBeCloseTo(0.4375, 12);
  });

  // Lantai menjaga orang rajin tidak dihilangkan, cuma tidak menguasai.
  it("tidak pernah turun di bawah lantai", () => {
    expect(pengaliDiversitas(50)).toBeGreaterThanOrEqual(DIVERSITAS_LANTAI);
    expect(pengaliDiversitas(50)).toBeCloseTo(DIVERSITAS_LANTAI, 12);
  });

  it("monoton turun", () => {
    expect(pengaliDiversitas(3)).toBeLessThan(pengaliDiversitas(2));
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test feed-score`
Expected: FAIL — `Cannot find module '../src/feed-rank'`

- [ ] **Step 3: Tulis implementasinya**

`apps/api/src/feed-rank.ts`:

```ts
import { SCORE_SCALE } from "./trust/recompute";
import type { FeedCandidate } from "./ports";

// Semua konstanta di bawah MENGIKAT ke spec §6.1 dan dikunci tes. Mengubah
// satu angka wajib disertai mengubah spec — bukan diam-diam.
export const BOBOT_TRUST = 0.5;
export const BOBOT_SUKA = 0.2;
export const BOBOT_BARU = 0.3;

export const JARAK_1_HOP = 1.0;
export const JARAK_2_HOP = 0.6;
export const JARAK_LUAR = 0.3;

export const PARUH_WAKTU_JAM = 24;
export const SUKA_JENUH = 50;

export const DIVERSITAS_PELURUHAN = 0.5;
export const DIVERSITAS_LANTAI = 0.25;

const MS_PER_JAM = 3_600_000;

/**
 * Dipakai memakai SCORE_SCALE yang SUDAH ADA (terkunci ke TrustAttestor.sol),
 * bukan konstanta baru. Pembaginya menormalkan hasil ke [0,1].
 */
const NORMALISASI = Math.log1p(SCORE_SCALE);

/**
 * Spec §6.3. Tanpa kompresi ini, peluruhan diversitas tidak berfungsi:
 * peluruhan bekerja secara perkalian, dan rasio PageRank timpang sampai
 * ribuan kali lipat, sehingga 0.5^5 pun tidak menurunkan penulis teratas.
 *
 * `log1p`, bukan `log`, supaya rasio nol menghasilkan nol dan bukan -Infinity.
 */
export function basisTrust(rasio: number): number {
  if (!Number.isFinite(rasio) || rasio <= 0) return 0;
  return Math.log1p(rasio * SCORE_SCALE) / NORMALISASI;
}

export function faktorJarak(hop: 1 | 2 | null): number {
  if (hop === 1) return JARAK_1_HOP;
  if (hop === 2) return JARAK_2_HOP;
  return JARAK_LUAR;
}

export function faktorKebaruan(createdAtMs: number, nowMs: number): number {
  // Jam perangkat bisa mundur; umur negatif tidak boleh meledakkan skor.
  const umurJam = Math.max(0, (nowMs - createdAtMs) / MS_PER_JAM);
  return Math.pow(0.5, umurJam / PARUH_WAKTU_JAM);
}

export function faktorSuka(likeCount: number): number {
  if (!Number.isFinite(likeCount) || likeCount <= 0) return 0;
  return Math.min(1, Math.log1p(likeCount) / Math.log1p(SUKA_JENUH));
}

export function skorAwal(c: FeedCandidate, nowMs: number): number {
  const isi =
    BOBOT_TRUST * basisTrust(c.authorRatio)
    + BOBOT_SUKA * faktorSuka(c.likeCount)
    + BOBOT_BARU * faktorKebaruan(c.createdAtMs, nowMs);
  return isi * faktorJarak(c.hop);
}

/**
 * Diambil dari home-mixer/scorers/ranking_scorer.rs milik X:
 * `(1 - lantai) * peluruhan^k + lantai`, dengan k = jumlah unggahan penulis
 * yang sama yang sudah berada lebih tinggi. Lantai menjaga penulis rajin
 * tidak dihilangkan — hanya tidak boleh menguasai.
 */
export function pengaliDiversitas(k: number): number {
  return (1 - DIVERSITAS_LANTAI) * Math.pow(DIVERSITAS_PELURUHAN, k) + DIVERSITAS_LANTAI;
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test feed-score && pnpm --filter @nearly/api typecheck`
Expected: PASS

- [ ] **Step 5: Buktikan tes benar-benar mengunci konstanta**

Ubah sementara `DIVERSITAS_PELURUHAN` menjadi `0.6`, jalankan `pnpm --filter @nearly/api test feed-score`, pastikan ada tes MERAH, lalu kembalikan ke `0.5` dan pastikan hijau lagi. Jangan commit versi `0.6`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/feed-rank.ts apps/api/test/feed-score.test.ts
git commit -m "feat(api): rumus skor feed dengan kompresi log rasio trust"
```

---

## Task 6: Penilai murni — pipeline lengkap

**Files:**
- Modify: `apps/api/src/feed-rank.ts`
- Test: `apps/api/test/feed-rank.test.ts`

**Interfaces:**
- Consumes: seluruh ekspor Task 5; `FeedCandidate`, `FeedRow`, `imageUrlOf` dari Task 4.
- Produces: `FEED_LIMIT`, `AMBANG_LAPORAN`, `SLOT_PENDATANG`, `UMUR_PENDATANG_MS`, `terlihat`, `sisipkanPendatang`, `rankFeed`.

**Tanda tangan mengikat:**

```ts
export function rankFeed(
  candidates: FeedCandidate[],
  opts: { nowMs: number; viewer: Address | null; spEndpoint: string; limit?: number },
): FeedRow[]
```

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/feed-rank.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import {
  AMBANG_LAPORAN, FEED_LIMIT, rankFeed, SLOT_PENDATANG, sisipkanPendatang, terlihat,
} from "../src/feed-rank";
import type { FeedCandidate } from "../src/ports";

const NOW = 1_800_000_000_000;
const JAM = 3_600_000;
const SP = "https://sp.example";
const AKU = "0x00000000000000000000000000000000000000me" as Address;

let urut = 0;
function kandidat(over: Partial<FeedCandidate> = {}): FeedCandidate {
  urut += 1;
  return {
    postId: `0x${String(urut).padStart(64, "0")}` as Hex,
    author: "0x000000000000000000000000000000000000aaaa" as Address,
    displayName: "Andi",
    body: "halo", imageBucket: null, imageObject: null, imageMime: null,
    imageStatus: "none", createdAtMs: NOW, deleted: false,
    authorRatio: 0.01, authorTier: 1, authorConnections: 5, authorSlashed: false,
    reportCount: 0, likeCount: 0, sudahSuka: false, hop: 1,
    ...over,
  };
}

const peringkat = (c: FeedCandidate[], viewer: Address | null = AKU) =>
  rankFeed(c, { nowMs: NOW, viewer, spEndpoint: SP });

describe("terlihat — penyaring visibilitas (spec §7)", () => {
  it("membuang unggahan penulis yang ter-slash", () => {
    expect(terlihat(kandidat({ authorSlashed: true }), AKU)).toBe(false);
  });

  it("membuang unggahan yang mencapai ambang laporan", () => {
    expect(terlihat(kandidat({ reportCount: AMBANG_LAPORAN }), AKU)).toBe(false);
  });

  it("mempertahankan unggahan satu laporan di bawah ambang", () => {
    expect(terlihat(kandidat({ reportCount: AMBANG_LAPORAN - 1 }), AKU)).toBe(true);
  });

  it("membuang unggahan yang sudah dihapus", () => {
    expect(terlihat(kandidat({ deleted: true }), AKU)).toBe(false);
  });

  // Spec §7: dua sebab pertama tidak berlaku untuk unggahan sendiri.
  it("penulis tetap melihat unggahannya sendiri walau ter-slash", () => {
    expect(terlihat(kandidat({ author: AKU, authorSlashed: true }), AKU)).toBe(true);
  });

  it("penulis tetap melihat unggahannya sendiri walau melewati ambang laporan", () => {
    expect(terlihat(kandidat({ author: AKU, reportCount: 99 }), AKU)).toBe(true);
  });

  // Batas pengecualian itu. Menghapus harus berarti menghapus.
  it("unggahan yang DIHAPUS tidak terlihat bahkan oleh penulisnya", () => {
    expect(terlihat(kandidat({ author: AKU, deleted: true }), AKU)).toBe(false);
  });

  it("pencocokan penulis tidak peka besar-kecil huruf", () => {
    const c = kandidat({ author: AKU.toUpperCase() as Address, authorSlashed: true });
    expect(terlihat(c, AKU)).toBe(true);
  });

  // Status gambar BUKAN sebab penyaringan (spec §7).
  it("gambar pending atau failed tidak menyembunyikan unggahan dari siapa pun", () => {
    expect(terlihat(kandidat({ imageStatus: "pending" }), AKU)).toBe(true);
    expect(terlihat(kandidat({ imageStatus: "failed" }), null)).toBe(true);
  });
});

describe("rankFeed — urutan", () => {
  it("unggahan 1 hop di atas unggahan luar jaringan yang identik", () => {
    const dekat = kandidat({ hop: 1, author: "0x1111111111111111111111111111111111111111" as Address });
    const jauh = kandidat({ hop: null, author: "0x2222222222222222222222222222222222222222" as Address });
    expect(peringkat([jauh, dekat])[0]!.postId).toBe(dekat.postId);
  });

  it("membuang seluruh unggahan yang tidak lolos penyaring", () => {
    expect(peringkat([kandidat({ deleted: true }), kandidat({ authorSlashed: true })]))
      .toHaveLength(0);
  });

  /**
   * Inti spec §6.3 dan §3.1: tanpa kompresi log, satu penulis ber-rasio
   * sangat tinggi akan menguasai seluruh feed karena peluruhan diversitas
   * tidak menggigit. Dengan kompresi, ia tidak boleh mengisi seluruh 5 besar.
   */
  it("satu penulis ber-rasio tertinggi tidak menguasai lima besar", () => {
    const raja = "0x000000000000000000000000000000000000ffff" as Address;
    const banyak = Array.from({ length: 10 }, () =>
      kandidat({ author: raja, authorRatio: 1 }));
    const lain = Array.from({ length: 10 }, (_, i) =>
      kandidat({
        author: `0x${String(i + 1).repeat(40).slice(0, 40)}` as Address,
        authorRatio: 0.001,
      }));
    const limaBesar = peringkat([...banyak, ...lain]).slice(0, 5);
    const dariRaja = limaBesar.filter((r) => r.author.toLowerCase() === raja.toLowerCase());
    expect(dariRaja.length).toBeLessThan(5);
  });

  it("urutan deterministik untuk skor yang sama", () => {
    const a = kandidat({ postId: `0x${"a".repeat(64)}` as Hex });
    const b = kandidat({ postId: `0x${"b".repeat(64)}` as Hex });
    expect(peringkat([a, b]).map((r) => r.postId))
      .toEqual(peringkat([b, a]).map((r) => r.postId));
  });

  it("tidak pernah mengembalikan lebih dari FEED_LIMIT baris", () => {
    const banyak = Array.from({ length: FEED_LIMIT + 40 }, (_, i) =>
      kandidat({ author: `0x${String(i).padStart(40, "0")}` as Address }));
    expect(peringkat(banyak)).toHaveLength(FEED_LIMIT);
  });
});

describe("rankFeed — penonton anonim (spec §6.5)", () => {
  it("hop selalu null dan sudahSuka selalu false", () => {
    const rows = rankFeed([kandidat({ hop: 1, sudahSuka: true })],
      { nowMs: NOW, viewer: null, spEndpoint: SP });
    expect(rows[0]!.hop).toBeNull();
    expect(rows[0]!.sudahSuka).toBe(false);
  });

  // Pengali seragam tidak mengubah urutan — karena itu tidak ada cabang khusus.
  it("urutan anonim sama dengan urutan penonton nol koneksi", () => {
    const bahan = [
      kandidat({ authorRatio: 0.5, author: "0x1111111111111111111111111111111111111111" as Address }),
      kandidat({ authorRatio: 0.01, author: "0x2222222222222222222222222222222222222222" as Address }),
    ];
    const anonim = rankFeed(bahan.map((c) => ({ ...c, hop: null })),
      { nowMs: NOW, viewer: null, spEndpoint: SP });
    const nolKoneksi = rankFeed(bahan.map((c) => ({ ...c, hop: null })),
      { nowMs: NOW, viewer: AKU, spEndpoint: SP });
    expect(anonim.map((r) => r.postId)).toEqual(nolKoneksi.map((r) => r.postId));
  });
});

describe("sisipkanPendatang (spec §6.6)", () => {
  const utama = () => Array.from({ length: FEED_LIMIT }, (_, i) =>
    kandidat({ author: `0x${String(i).padStart(40, "0")}` as Address, authorConnections: 9 }));

  it("menyisipkan pendatang layak di posisi yang disediakan", () => {
    const baru = kandidat({ authorConnections: 1, createdAtMs: NOW - JAM });
    const hasil = sisipkanPendatang(utama(), [baru], NOW);
    expect(hasil[SLOT_PENDATANG[0]!]!.postId).toBe(baru.postId);
  });

  it("panjang hasil tidak berubah — pendatang menggeser yang terbawah", () => {
    const baru = kandidat({ authorConnections: 2, createdAtMs: NOW });
    expect(sisipkanPendatang(utama(), [baru], NOW)).toHaveLength(FEED_LIMIT);
  });

  /**
   * Batas bawah 1 koneksi, dan ini bukan kosmetik: posting terbuka untuk
   * siapa pun, dan akun bot punya NOL koneksi. Tanpa batas bawah, setiap bot
   * memenuhi syarat "kurang dari 3" dan slot ini berubah jadi jalur cepat
   * bagi bot ke posisi tetap di feed.
   */
  it("penulis NOL koneksi tidak pernah mendapat slot", () => {
    const bot = kandidat({ authorConnections: 0, createdAtMs: NOW });
    const hasil = sisipkanPendatang(utama(), [bot], NOW);
    expect(hasil.map((c) => c.postId)).not.toContain(bot.postId);
  });

  it("penulis dengan 3 koneksi atau lebih tidak mendapat slot", () => {
    const mapan = kandidat({ authorConnections: 3, createdAtMs: NOW });
    const hasil = sisipkanPendatang(utama(), [mapan], NOW);
    expect(hasil.map((c) => c.postId)).not.toContain(mapan.postId);
  });

  it("unggahan lebih tua dari 48 jam tidak mendapat slot", () => {
    const basi = kandidat({ authorConnections: 1, createdAtMs: NOW - 49 * JAM });
    const hasil = sisipkanPendatang(utama(), [basi], NOW);
    expect(hasil.map((c) => c.postId)).not.toContain(basi.postId);
  });

  it("tanpa kandidat layak, hasilnya tidak berubah sama sekali", () => {
    const asal = utama();
    expect(sisipkanPendatang(asal, [], NOW).map((c) => c.postId))
      .toEqual(asal.map((c) => c.postId));
  });
});

describe("rankFeed — pemetaan baris", () => {
  it("membangun imageUrl hanya saat status ready", () => {
    const siap = kandidat({
      imageStatus: "ready", imageBucket: "nearly-feed", imageObject: "x.jpg",
    });
    expect(peringkat([siap])[0]!.imageUrl).toBe(`${SP}/view/nearly-feed/x.jpg`);
  });

  it("imageUrl null selama status masih pending", () => {
    const menunggu = kandidat({
      imageStatus: "pending", imageBucket: "nearly-feed", imageObject: "x.jpg",
    });
    expect(peringkat([menunggu])[0]!.imageUrl).toBeNull();
  });

  it("meneruskan displayName, tier, likeCount, dan hop", () => {
    const c = kandidat({ displayName: "Budi", authorTier: 2, likeCount: 7, hop: 2 });
    const row = peringkat([c])[0]!;
    expect(row.displayName).toBe("Budi");
    expect(row.tier).toBe(2);
    expect(row.likeCount).toBe(7);
    expect(row.hop).toBe(2);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test feed-rank`
Expected: FAIL — `rankFeed is not exported`

- [ ] **Step 3: Tambahkan pipeline di akhir `apps/api/src/feed-rank.ts`**

```ts
import type { Address } from "viem";
import { imageUrlOf, type FeedRow } from "./ports";

export const FEED_LIMIT = 30;
export const AMBANG_LAPORAN = 3;
export const SLOT_PENDATANG = [5, 12, 20] as const;
export const UMUR_PENDATANG_MS = 48 * MS_PER_JAM;

/**
 * Tahap 2 pipeline (spec §7): TERPISAH dari penilaian, bukan skor rendah.
 * Kalau visibilitas dicampur ke skor, pelaku cukup meraih skor cukup tinggi
 * untuk muncul kembali.
 */
export function terlihat(c: FeedCandidate, viewer: Address | null): boolean {
  // Menghapus harus berarti menghapus — termasuk bagi penulisnya sendiri.
  if (c.deleted) return false;

  const milikSendiri =
    viewer !== null && c.author.toLowerCase() === viewer.toLowerCase();
  // Menyembunyikan unggahan dari penulisnya sendiri hanya membingungkan
  // tanpa melindungi siapa pun.
  if (milikSendiri) return true;

  if (c.authorSlashed) return false;
  if (c.reportCount >= AMBANG_LAPORAN) return false;
  return true;
}

/**
 * Tahap 5 (spec §6.6). Batas bawah 1 koneksi WAJIB: posting terbuka untuk
 * siapa pun dan akun bot punya nol koneksi, jadi syarat "kurang dari 3" saja
 * akan menjadikan slot ini jalur cepat bagi bot.
 */
export function sisipkanPendatang(
  utama: FeedCandidate[], sisa: FeedCandidate[], nowMs: number,
): FeedCandidate[] {
  const layak = sisa.filter(
    (c) => c.authorConnections >= 1
      && c.authorConnections < 3
      && nowMs - c.createdAtMs < UMUR_PENDATANG_MS,
  );
  if (layak.length === 0) return utama;

  const panjangAsli = utama.length;
  const hasil = [...utama];
  let i = 0;
  for (const posisi of SLOT_PENDATANG) {
    if (i >= layak.length) break;
    if (posisi >= hasil.length) break;
    hasil.splice(posisi, 0, layak[i]!);
    i += 1;
  }
  // Sisipan menggeser yang terbawah keluar; panjang halaman tetap.
  return hasil.slice(0, panjangAsli);
}

function keRow(c: FeedCandidate, spEndpoint: string, viewer: Address | null): FeedRow {
  return {
    postId: c.postId,
    author: c.author,
    displayName: c.displayName,
    tier: c.authorTier,
    body: c.body,
    imageUrl: c.imageStatus === "ready"
      ? imageUrlOf(spEndpoint, c.imageBucket, c.imageObject)
      : null,
    imageStatus: c.imageStatus,
    likeCount: c.likeCount,
    sudahSuka: viewer === null ? false : c.sudahSuka,
    hop: viewer === null ? null : c.hop,
    createdAtMs: c.createdAtMs,
  };
}

/** Pemecah seri deterministik — tanpa ini urutan tidak bisa diuji. */
function bandingkan(a: { skor: number; c: FeedCandidate }, b: { skor: number; c: FeedCandidate }) {
  if (b.skor !== a.skor) return b.skor - a.skor;
  return a.c.postId.localeCompare(b.c.postId);
}

export function rankFeed(
  candidates: FeedCandidate[],
  opts: { nowMs: number; viewer: Address | null; spEndpoint: string; limit?: number },
): FeedRow[] {
  const limit = opts.limit ?? FEED_LIMIT;

  const lolos = candidates.filter((c) => terlihat(c, opts.viewer));

  const praDiversitas = lolos
    .map((c) => ({ c, skor: skorAwal(c, opts.nowMs) }))
    .sort(bandingkan);

  // `k` dihitung dari urutan PRA-diversitas, seperti author_pool_counts di
  // ranking_scorer.rs milik X: berapa unggahan penulis yang sama yang sudah
  // berada lebih tinggi SEBELUM peluruhan diterapkan.
  const terlihatKe = new Map<string, number>();
  const akhir = praDiversitas
    .map(({ c, skor }) => {
      const kunci = c.author.toLowerCase();
      const k = terlihatKe.get(kunci) ?? 0;
      terlihatKe.set(kunci, k + 1);
      return { c, skor: skor * pengaliDiversitas(k) };
    })
    .sort(bandingkan);

  const utama = akhir.slice(0, limit).map((x) => x.c);
  const sisa = akhir.slice(limit).map((x) => x.c);

  return sisipkanPendatang(utama, sisa, opts.nowMs)
    .map((c) => keRow(c, opts.spEndpoint, opts.viewer));
}
```

**Catatan impor:** `FeedCandidate` sudah diimpor di kepala berkas dari Task 5. Tambahkan `Address`, `FeedRow`, dan `imageUrlOf` ke impor yang sudah ada — jangan membuat blok impor kedua.

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test feed-rank && pnpm --filter @nearly/api typecheck`
Expected: PASS

- [ ] **Step 5: Buktikan penjaga bot benar-benar mengunci**

Ubah sementara syarat `c.authorConnections >= 1` menjadi `c.authorConnections >= 0`, jalankan `pnpm --filter @nearly/api test feed-rank`, pastikan tes "penulis NOL koneksi tidak pernah mendapat slot" MERAH, lalu kembalikan. Jangan commit versi yang longgar.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/feed-rank.ts apps/api/test/feed-rank.test.ts
git commit -m "feat(api): pipeline peringkat feed dengan diversitas dan slot pendatang"
```

---
