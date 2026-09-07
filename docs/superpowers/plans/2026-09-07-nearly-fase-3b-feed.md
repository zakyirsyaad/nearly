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

## Task 7: Gerbang — buat dan hapus unggahan

**Files:**
- Create: `apps/api/src/feed-gate.ts`
- Test: `apps/api/test/feed-gate-post.test.ts`

**Interfaces:**
- Consumes: `recoverPostSigner`, `recoverHapusPostSigner` dari `@nearly/shared` (Task 1); `FeedDeps`, `FeedStore`, `PostRecord` dari Task 4.
- Produces: `FeedFailure`, `FeedResult<T>`, `createPost`, `deletePost`.

**Invarian yang WAJIB dijaga:** pemulihan tanda tangan hapus memakai `recoverHapusPostSigner`, **bukan** `recoverPostSigner`. Memakai yang kedua membuat tanda tangan pembuatan unggahan sah sebagai perintah penghapusan.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/feed-gate-post.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { hapusPostTypedData, makePostId, postTypedData } from "@nearly/shared";
import { createPost, deletePost } from "../src/feed-gate";
import type { FeedDeps, FeedStore, PostRecord } from "../src/ports";

const penulis = privateKeyToAccount(`0x${"11".repeat(32)}` as Hex);
const orangLain = privateKeyToAccount(`0x${"22".repeat(32)}` as Hex);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const NOW = 1_800_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);

function store(over: Partial<FeedStore> = {}): FeedStore {
  return {
    createPost: vi.fn(async () => {}),
    getPost: vi.fn(async () => null),
    markDeleted: vi.fn(async () => {}),
    setLike: vi.fn(async () => {}),
    addReport: vi.fn(async () => {}),
    setImagePending: vi.fn(async () => {}),
    setImageDone: vi.fn(async () => {}),
    setImageFailed: vi.fn(async () => {}),
    listCandidates: vi.fn(async () => []),
    ...over,
  };
}

function deps(feed: FeedStore): FeedDeps {
  return {
    feed,
    greenfield: { bucket: "nearly-feed", spEndpoint: "https://sp.example", upload: vi.fn(async () => {}) },
    verifyingContract: KONTRAK,
    nowMs: () => NOW,
  };
}

function rekam(over: Partial<PostRecord> = {}): PostRecord {
  return {
    postId: `0x${"1".repeat(64)}` as Hex,
    author: penulis.address, body: "halo dunia",
    imageBucket: null, imageObject: null, imageMime: null, imageStatus: "none",
    createdAtMs: NOW, deleted: false, ...over,
  };
}

async function masukanBuat(over: Record<string, unknown> = {}) {
  const postId = makePostId();
  const pesan = { postId, author: penulis.address, body: "halo dunia", expiresAt: EXP };
  const sig = await penulis.signTypedData(postTypedData(pesan, KONTRAK));
  return { ...pesan, sig, ...over };
}

describe("createPost", () => {
  it("menyimpan unggahan yang tanda tangannya sah", async () => {
    const s = store();
    const hasil = await createPost(await masukanBuat(), deps(s));
    expect(hasil.ok).toBe(true);
    expect(s.createPost).toHaveBeenCalledTimes(1);
  });

  it("menolak tanda tangan dari orang lain", async () => {
    const postId = makePostId();
    const pesan = { postId, author: penulis.address, body: "halo dunia", expiresAt: EXP };
    const sig = await orangLain.signTypedData(postTypedData(pesan, KONTRAK));
    const s = store();
    const hasil = await createPost({ ...pesan, sig }, deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(s.createPost).not.toHaveBeenCalled();
  });

  it("menolak permintaan yang sudah kedaluwarsa", async () => {
    const lampau = BigInt(Math.floor(NOW / 1000) - 1);
    const postId = makePostId();
    const pesan = { postId, author: penulis.address, body: "halo dunia", expiresAt: lampau };
    const sig = await penulis.signTypedData(postTypedData(pesan, KONTRAK));
    const hasil = await createPost({ ...pesan, sig }, deps(store()));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("menolak postId yang sudah dipakai", async () => {
    const s = store({ getPost: vi.fn(async () => rekam()) });
    const hasil = await createPost(await masukanBuat(), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "post_exists", httpStatus: 409 } });
    expect(s.createPost).not.toHaveBeenCalled();
  });

  // Body ikut ditandatangani, jadi menukar isinya harus menggagalkan pemulihan.
  it("menolak body yang ditukar setelah ditandatangani", async () => {
    const masukan = await masukanBuat();
    const hasil = await createPost({ ...masukan, body: "isi lain" }, deps(store()));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature" } });
  });

  it("meneruskan waktu buat dari deps.nowMs, bukan jam klien", async () => {
    const s = store();
    await createPost(await masukanBuat(), deps(s));
    expect(s.createPost).toHaveBeenCalledWith(expect.objectContaining({ createdAtMs: NOW }));
  });
});

describe("deletePost", () => {
  async function masukanHapus(over: Record<string, unknown> = {}) {
    const postId = `0x${"1".repeat(64)}` as Hex;
    const pesan = { postId, author: penulis.address, expiresAt: EXP };
    const sig = await penulis.signTypedData(hapusPostTypedData(pesan, KONTRAK));
    return { ...pesan, sig, ...over };
  }

  it("menandai unggahan milik sendiri sebagai terhapus", async () => {
    const s = store({ getPost: vi.fn(async () => rekam()) });
    const hasil = await deletePost(await masukanHapus(), deps(s));
    expect(hasil.ok).toBe(true);
    expect(s.markDeleted).toHaveBeenCalledTimes(1);
  });

  it("menolak menghapus unggahan orang lain", async () => {
    const s = store({ getPost: vi.fn(async () => rekam({ author: orangLain.address })) });
    const hasil = await deletePost(await masukanHapus(), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "not_author", httpStatus: 403 } });
    expect(s.markDeleted).not.toHaveBeenCalled();
  });

  it("mengembalikan post_not_found untuk unggahan yang tidak ada", async () => {
    const hasil = await deletePost(await masukanHapus(), deps(store()));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "post_not_found", httpStatus: 404 } });
  });

  // Menghapus dua kali bukan galat — hasil akhirnya sama.
  it("idempoten pada unggahan yang sudah terhapus", async () => {
    const s = store({ getPost: vi.fn(async () => rekam({ deleted: true })) });
    const hasil = await deletePost(await masukanHapus(), deps(s));
    expect(hasil.ok).toBe(true);
    expect(s.markDeleted).not.toHaveBeenCalled();
  });

  /**
   * INVARIAN. Kalau gerbang hapus memakai recoverPostSigner, tanda tangan
   * yang dibuat untuk MEMPOSTING akan sah sebagai perintah MENGHAPUS, dan
   * siapa pun yang menangkapnya bisa menghapus unggahan orang itu. Tes ini
   * gagal kalau invarian itu dilanggar.
   */
  it("tanda tangan Post TIDAK diterima sebagai perintah hapus", async () => {
    const postId = `0x${"1".repeat(64)}` as Hex;
    const sigPost = await penulis.signTypedData(
      postTypedData({ postId, author: penulis.address, body: "halo dunia", expiresAt: EXP }, KONTRAK),
    );
    const s = store({ getPost: vi.fn(async () => rekam()) });
    const hasil = await deletePost(
      { postId, author: penulis.address, expiresAt: EXP, sig: sigPost }, deps(s),
    );
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(s.markDeleted).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test feed-gate-post`
Expected: FAIL — `Cannot find module '../src/feed-gate'`

- [ ] **Step 3: Tulis implementasinya**

`apps/api/src/feed-gate.ts`:

```ts
import type { Address, Hex } from "viem";
import { recoverHapusPostSigner, recoverPostSigner } from "@nearly/shared";
import type { FeedDeps } from "./ports";

export type FeedFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "post_exists"; httpStatus: 409 }
  | { code: "post_not_found"; httpStatus: 404 }
  | { code: "not_author"; httpStatus: 403 }
  | { code: "image_slot_taken"; httpStatus: 409 }
  | { code: "image_too_large"; httpStatus: 413 };

export type FeedResult<T> = { ok: true; value: T } | { ok: false; failure: FeedFailure };

const fail = (failure: FeedFailure): { ok: false; failure: FeedFailure } =>
  ({ ok: false, failure });

const sudahLewat = (deps: FeedDeps, expiresAt: bigint) =>
  deps.nowMs() > Number(expiresAt) * 1000;

const samaAlamat = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export type CreatePostInput = {
  postId: Hex; author: Address; body: string; expiresAt: bigint; sig: Hex;
};

export async function createPost(
  input: CreatePostInput, deps: FeedDeps,
): Promise<FeedResult<void>> {
  if (sudahLewat(deps, input.expiresAt)) return fail({ code: "expired", httpStatus: 410 });

  if (await deps.feed.getPost(input.postId)) {
    return fail({ code: "post_exists", httpStatus: 409 });
  }

  const signer = await recoverPostSigner(
    { postId: input.postId, author: input.author, body: input.body, expiresAt: input.expiresAt },
    input.sig,
    deps.verifyingContract,
  );
  if (!samaAlamat(signer, input.author)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  // Waktu buat diambil dari server, bukan jam klien: jam perangkat bisa
  // digeser, dan `kebaruan` di penilai memakai nilai ini langsung.
  await deps.feed.createPost({
    postId: input.postId, author: input.author, body: input.body, createdAtMs: deps.nowMs(),
  });
  return { ok: true, value: undefined };
}

export type DeletePostInput = {
  postId: Hex; author: Address; expiresAt: bigint; sig: Hex;
};

export async function deletePost(
  input: DeletePostInput, deps: FeedDeps,
): Promise<FeedResult<void>> {
  if (sudahLewat(deps, input.expiresAt)) return fail({ code: "expired", httpStatus: 410 });

  const post = await deps.feed.getPost(input.postId);
  if (!post) return fail({ code: "post_not_found", httpStatus: 404 });

  // recoverHapusPostSigner, BUKAN recoverPostSigner. Tipe `Post` juga memuat
  // {postId, author, expiresAt}; kalau dipakai di sini, tanda tangan yang
  // dibuat untuk MEMPOSTING akan sah sebagai perintah MENGHAPUS. Kelas
  // kesalahan Ruling 23, dan dikunci tes.
  const signer = await recoverHapusPostSigner(
    { postId: input.postId, author: input.author, expiresAt: input.expiresAt },
    input.sig,
    deps.verifyingContract,
  );
  if (!samaAlamat(signer, input.author)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  if (!samaAlamat(post.author, input.author)) {
    return fail({ code: "not_author", httpStatus: 403 });
  }

  // Menghapus dua kali bukan galat — hasil akhirnya sama.
  if (post.deleted) return { ok: true, value: undefined };

  await deps.feed.markDeleted(input.postId);
  return { ok: true, value: undefined };
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test feed-gate-post && pnpm --filter @nearly/api typecheck`
Expected: PASS

- [ ] **Step 5: Buktikan invarian benar-benar terkunci**

Ganti sementara `recoverHapusPostSigner` di `deletePost` menjadi `recoverPostSigner`, dan lengkapi pesannya dengan **`body: post.body`** — bukan `body: ""`. Jalankan `pnpm --filter @nearly/api test feed-gate-post` dan pastikan tes "tanda tangan Post TIDAK diterima sebagai perintah hapus" MERAH. Kembalikan setelahnya.

**Kenapa `body: post.body`, bukan `body: ""`.** Dengan body kosong, pemulihan meleset di jalur yang benar MAUPUN yang salah, sehingga tes itu tetap hijau karena alasan yang keliru — mutasi yang tidak membuktikan apa pun. `post.body` adalah isi yang benar-benar ditandatangani, jadi jalur yang salah akan memulihkan penulis dengan sukses dan tes itu benar-benar merah.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/feed-gate.ts apps/api/test/feed-gate-post.test.ts
git commit -m "feat(api): gerbang buat dan hapus unggahan"
```

---

## Task 8: Gerbang — suka dan lapor

**Files:**
- Modify: `apps/api/src/feed-gate.ts`
- Test: `apps/api/test/feed-gate-like.test.ts`

**Interfaces:**
- Consumes: `FeedFailure`, `FeedResult`, `fail`, `sudahLewat`, `samaAlamat` dari Task 7; `recoverLikeSigner` dari `@nearly/shared`.
- Produces: `setLike`, `reportPost`.

**Catatan:** melaporkan **tidak** bertanda tangan. Berbeda dari suka, laporan tidak mengklaim identitas sebagai izin — ia sekadar suara, dan primary key `(post_id, reporter)` sudah menutup pelaporan berulang. Ini mengikuti `POST /report` Fase 2 yang juga tidak menuntut tanda tangan.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/feed-gate-like.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { likeTypedData } from "@nearly/shared";
import { reportPost, setLike } from "../src/feed-gate";
import type { FeedDeps, FeedStore, PostRecord } from "../src/ports";

const aku = privateKeyToAccount(`0x${"33".repeat(32)}` as Hex);
const lain = privateKeyToAccount(`0x${"44".repeat(32)}` as Hex);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const NOW = 1_800_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);
const ID = `0x${"1".repeat(64)}` as Hex;

function rekam(over: Partial<PostRecord> = {}): PostRecord {
  return {
    postId: ID, author: lain.address, body: "halo",
    imageBucket: null, imageObject: null, imageMime: null, imageStatus: "none",
    createdAtMs: NOW, deleted: false, ...over,
  };
}

function store(over: Partial<FeedStore> = {}): FeedStore {
  return {
    createPost: vi.fn(async () => {}),
    getPost: vi.fn(async () => rekam()),
    markDeleted: vi.fn(async () => {}),
    setLike: vi.fn(async () => {}),
    addReport: vi.fn(async () => {}),
    setImagePending: vi.fn(async () => {}),
    setImageDone: vi.fn(async () => {}),
    setImageFailed: vi.fn(async () => {}),
    listCandidates: vi.fn(async () => []),
    ...over,
  };
}

function deps(feed: FeedStore): FeedDeps {
  return {
    feed,
    greenfield: { bucket: "nearly-feed", spEndpoint: "https://sp.example", upload: vi.fn(async () => {}) },
    verifyingContract: KONTRAK,
    nowMs: () => NOW,
  };
}

async function masukanSuka(suka: boolean, penandaTangan = aku) {
  const pesan = { postId: ID, who: aku.address, suka, expiresAt: EXP };
  const sig = await penandaTangan.signTypedData(likeTypedData(pesan, KONTRAK));
  return { ...pesan, sig };
}

describe("setLike", () => {
  it("menyimpan suka yang tanda tangannya sah", async () => {
    const s = store();
    const hasil = await setLike(await masukanSuka(true), deps(s));
    expect(hasil.ok).toBe(true);
    expect(s.setLike).toHaveBeenCalledWith(ID, aku.address, true);
  });

  it("menyimpan pembatalan suka", async () => {
    const s = store();
    await setLike(await masukanSuka(false), deps(s));
    expect(s.setLike).toHaveBeenCalledWith(ID, aku.address, false);
  });

  it("menolak tanda tangan orang lain", async () => {
    const s = store();
    const hasil = await setLike(await masukanSuka(true, lain), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(s.setLike).not.toHaveBeenCalled();
  });

  it("menolak permintaan kedaluwarsa", async () => {
    const lampau = BigInt(Math.floor(NOW / 1000) - 1);
    const pesan = { postId: ID, who: aku.address, suka: true, expiresAt: lampau };
    const sig = await aku.signTypedData(likeTypedData(pesan, KONTRAK));
    const hasil = await setLike({ ...pesan, sig }, deps(store()));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("menolak menyukai unggahan yang tidak ada", async () => {
    const s = store({ getPost: vi.fn(async () => null) });
    const hasil = await setLike(await masukanSuka(true), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "post_not_found", httpStatus: 404 } });
  });

  it("menolak menyukai unggahan yang sudah dihapus", async () => {
    const s = store({ getPost: vi.fn(async () => rekam({ deleted: true })) });
    const hasil = await setLike(await masukanSuka(true), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "post_not_found", httpStatus: 404 } });
    expect(s.setLike).not.toHaveBeenCalled();
  });

  /**
   * INVARIAN. `suka` ikut ditandatangani justru supaya satu tanda tangan
   * tidak bisa dipakai dua arah. Kalau gerbang memulihkan memakai nilai
   * `suka` yang dikarang server alih-alih yang dikirim, penjagaan itu hilang.
   */
  it("tanda tangan suka:true tidak bisa dipakai untuk membatalkan", async () => {
    const sigTrue = (await masukanSuka(true)).sig;
    const s = store();
    const hasil = await setLike(
      { postId: ID, who: aku.address, suka: false, expiresAt: EXP, sig: sigTrue }, deps(s),
    );
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature" } });
    expect(s.setLike).not.toHaveBeenCalled();
  });
});

describe("reportPost", () => {
  it("mencatat laporan", async () => {
    const s = store();
    const hasil = await reportPost(
      { postId: ID, reporter: aku.address, reason: "spam berulang" }, deps(s),
    );
    expect(hasil.ok).toBe(true);
    expect(s.addReport).toHaveBeenCalledWith(ID, aku.address, "spam berulang");
  });

  it("menolak melaporkan unggahan yang tidak ada", async () => {
    const s = store({ getPost: vi.fn(async () => null) });
    const hasil = await reportPost(
      { postId: ID, reporter: aku.address, reason: "spam berulang" }, deps(s),
    );
    expect(hasil).toMatchObject({ ok: false, failure: { code: "post_not_found", httpStatus: 404 } });
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test feed-gate-like`
Expected: FAIL — `setLike is not exported`

- [ ] **Step 3: Tambahkan di akhir `apps/api/src/feed-gate.ts`**

Tambahkan `recoverLikeSigner` ke blok impor `@nearly/shared` yang sudah ada, lalu:

```ts
export type LikeInput = {
  postId: Hex; who: Address; suka: boolean; expiresAt: bigint; sig: Hex;
};

export async function setLike(input: LikeInput, deps: FeedDeps): Promise<FeedResult<void>> {
  if (sudahLewat(deps, input.expiresAt)) return fail({ code: "expired", httpStatus: 410 });

  const post = await deps.feed.getPost(input.postId);
  // Unggahan terhapus diperlakukan sama dengan tidak ada: menghapus berarti
  // menghapus, termasuk bagi orang yang menyimpan tautannya.
  if (!post || post.deleted) return fail({ code: "post_not_found", httpStatus: 404 });

  // `suka` dari MASUKAN, bukan nilai karangan server. Ini yang membuat satu
  // tanda tangan tidak bisa dipakai dua arah.
  const signer = await recoverLikeSigner(
    { postId: input.postId, who: input.who, suka: input.suka, expiresAt: input.expiresAt },
    input.sig,
    deps.verifyingContract,
  );
  if (!samaAlamat(signer, input.who)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  await deps.feed.setLike(input.postId, input.who, input.suka);
  return { ok: true, value: undefined };
}

export type ReportPostInput = { postId: Hex; reporter: Address; reason: string };

/**
 * Laporan TIDAK bertanda tangan, berbeda dari suka. Suka mengklaim identitas
 * sebagai izin ("aku yang menyukai"); laporan sekadar suara, dan primary key
 * (post_id, reporter) sudah menutup pelaporan berulang. Sama seperti
 * POST /report di Fase 2.
 */
export async function reportPost(
  input: ReportPostInput, deps: FeedDeps,
): Promise<FeedResult<void>> {
  const post = await deps.feed.getPost(input.postId);
  if (!post || post.deleted) return fail({ code: "post_not_found", httpStatus: 404 });

  await deps.feed.addReport(input.postId, input.reporter, input.reason);
  return { ok: true, value: undefined };
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test feed-gate && pnpm --filter @nearly/api typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/feed-gate.ts apps/api/test/feed-gate-like.test.ts
git commit -m "feat(api): gerbang suka dan lapor unggahan"
```

---

## Task 9: Gerbang — lampiran gambar dan unggah asinkron

**Files:**
- Modify: `apps/api/src/feed-gate.ts`
- Test: `apps/api/test/feed-gate-image.test.ts`

**Interfaces:**
- Consumes: seluruh helper Task 7; `recoverLampirGambarSigner` dari `@nearly/shared`; `GreenfieldPort` dari Task 4.
- Produces: `MAKS_GAMBAR_BYTES`, `objectNameOf`, `attachImage`, `prosesUnggahGambar`.

**Pemisahan yang mengikat.** `attachImage` melakukan seluruh validasi lalu menyetel status `pending` dan **selesai** — ia tidak pernah menyentuh jaringan. `prosesUnggahGambar` yang mengunggah dan menyetel `ready`/`failed`. Rute (Task 12) memanggil yang kedua **tanpa `await`**. Pemisahan ini yang membuat sifat fire-and-forget bisa diuji dan terlihat, alih-alih tersembunyi di dalam gerbang.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/feed-gate-image.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { lampirGambarTypedData } from "@nearly/shared";
import {
  attachImage, MAKS_GAMBAR_BYTES, objectNameOf, prosesUnggahGambar,
} from "../src/feed-gate";
import type { FeedDeps, FeedStore, GreenfieldPort, PostRecord } from "../src/ports";

const penulis = privateKeyToAccount(`0x${"55".repeat(32)}` as Hex);
const lain = privateKeyToAccount(`0x${"66".repeat(32)}` as Hex);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const NOW = 1_800_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);
const ID = `0x${"ab".repeat(32)}` as Hex;

function rekam(over: Partial<PostRecord> = {}): PostRecord {
  return {
    postId: ID, author: penulis.address, body: "halo",
    imageBucket: null, imageObject: null, imageMime: null, imageStatus: "none",
    createdAtMs: NOW, deleted: false, ...over,
  };
}

function store(over: Partial<FeedStore> = {}): FeedStore {
  return {
    createPost: vi.fn(async () => {}),
    getPost: vi.fn(async () => rekam()),
    markDeleted: vi.fn(async () => {}),
    setLike: vi.fn(async () => {}),
    addReport: vi.fn(async () => {}),
    setImagePending: vi.fn(async () => {}),
    setImageDone: vi.fn(async () => {}),
    setImageFailed: vi.fn(async () => {}),
    listCandidates: vi.fn(async () => []),
    ...over,
  };
}

function deps(feed: FeedStore, gf: Partial<GreenfieldPort> = {}): FeedDeps {
  return {
    feed,
    greenfield: {
      bucket: "nearly-feed", spEndpoint: "https://sp.example",
      upload: vi.fn(async () => {}), ...gf,
    },
    verifyingContract: KONTRAK,
    nowMs: () => NOW,
  };
}

async function masukan(over: Record<string, unknown> = {}) {
  const pesan = { postId: ID, author: penulis.address, mime: "image/jpeg", expiresAt: EXP };
  const sig = await penulis.signTypedData(lampirGambarTypedData(pesan, KONTRAK));
  return { ...pesan, sig, dataBase64: Buffer.from("halo").toString("base64"), ...over };
}

describe("objectNameOf", () => {
  it("deterministik dari postId, sehingga coba-ulang menimpa objek yang sama", () => {
    expect(objectNameOf(ID, "image/jpeg")).toBe(objectNameOf(ID, "image/jpeg"));
  });

  it("memakai ekstensi yang cocok dengan mime", () => {
    expect(objectNameOf(ID, "image/jpeg")).toMatch(/\.jpg$/);
    expect(objectNameOf(ID, "image/png")).toMatch(/\.png$/);
  });

  it("tidak memuat awalan 0x", () => {
    expect(objectNameOf(ID, "image/png").startsWith("0x")).toBe(false);
  });
});

describe("attachImage", () => {
  it("menyetel status pending dan TIDAK menyentuh jaringan", async () => {
    const s = store();
    const d = deps(s);
    const hasil = await attachImage(await masukan(), d);
    expect(hasil.ok).toBe(true);
    expect(s.setImagePending).toHaveBeenCalledWith(ID, objectNameOf(ID, "image/jpeg"), "image/jpeg");
    expect(d.greenfield.upload).not.toHaveBeenCalled();
  });

  it("mengembalikan objectName dan bytes untuk diproses pemanggil", async () => {
    const hasil = await attachImage(await masukan(), deps(store()));
    expect(hasil.ok && hasil.value.objectName).toBe(objectNameOf(ID, "image/jpeg"));
    expect(hasil.ok && hasil.value.bytes.byteLength).toBe(4);
  });

  it("menolak tanda tangan orang lain", async () => {
    const pesan = { postId: ID, author: penulis.address, mime: "image/jpeg", expiresAt: EXP };
    const sig = await lain.signTypedData(lampirGambarTypedData(pesan, KONTRAK));
    const s = store();
    const hasil = await attachImage(
      { ...pesan, sig, dataBase64: Buffer.from("halo").toString("base64") }, deps(s),
    );
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(s.setImagePending).not.toHaveBeenCalled();
  });

  // mime ikut ditandatangani; menukarnya setelah menandatangani harus gagal.
  it("menolak mime yang ditukar setelah ditandatangani", async () => {
    const hasil = await attachImage(await masukan({ mime: "image/png" }), deps(store()));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature" } });
  });

  it("menolak melampirkan ke unggahan orang lain", async () => {
    const s = store({ getPost: vi.fn(async () => rekam({ author: lain.address })) });
    const hasil = await attachImage(await masukan(), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "not_author", httpStatus: 403 } });
  });

  it("menolak unggahan yang tidak ada atau sudah dihapus", async () => {
    const kosong = store({ getPost: vi.fn(async () => null) });
    expect(await attachImage(await masukan(), deps(kosong)))
      .toMatchObject({ ok: false, failure: { code: "post_not_found", httpStatus: 404 } });

    const terhapus = store({ getPost: vi.fn(async () => rekam({ deleted: true })) });
    expect(await attachImage(await masukan(), deps(terhapus)))
      .toMatchObject({ ok: false, failure: { code: "post_not_found", httpStatus: 404 } });
  });

  // Satu gambar per unggahan (spec §2). Slot yang sudah terisi tidak boleh
  // ditimpa; kalau tidak, satu orang bisa memakai satu unggahan sebagai
  // saluran unggah tanpa batas.
  it("menolak kalau slot gambar sudah terisi", async () => {
    for (const status of ["pending", "ready"] as const) {
      const s = store({ getPost: vi.fn(async () => rekam({ imageStatus: status })) });
      expect(await attachImage(await masukan(), deps(s)))
        .toMatchObject({ ok: false, failure: { code: "image_slot_taken", httpStatus: 409 } });
    }
  });

  // `failed` HARUS bisa dicoba ulang — itulah yang membuat tombol coba-ulang
  // di UI bekerja (spec §11.4).
  it("menerima percobaan ulang setelah status failed", async () => {
    const s = store({ getPost: vi.fn(async () => rekam({ imageStatus: "failed" })) });
    expect((await attachImage(await masukan(), deps(s))).ok).toBe(true);
  });

  it("menolak gambar melebihi batas ukuran", async () => {
    const besar = Buffer.alloc(MAKS_GAMBAR_BYTES + 1).toString("base64");
    const s = store();
    const hasil = await attachImage(await masukan({ dataBase64: besar }), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "image_too_large", httpStatus: 413 } });
    expect(s.setImagePending).not.toHaveBeenCalled();
  });

  it("menerima gambar tepat di batas ukuran", async () => {
    const pas = Buffer.alloc(MAKS_GAMBAR_BYTES).toString("base64");
    expect((await attachImage(await masukan({ dataBase64: pas }), deps(store()))).ok).toBe(true);
  });

  it("batasnya dua megabita", () => {
    expect(MAKS_GAMBAR_BYTES).toBe(2 * 1024 * 1024);
  });
});

describe("prosesUnggahGambar", () => {
  const bytes = new Uint8Array([1, 2, 3]);

  it("mengunggah lalu menyetel status ready dengan bucket yang dipakai", async () => {
    const s = store();
    const d = deps(s);
    await prosesUnggahGambar(d, ID, "abc.jpg", "image/jpeg", bytes);
    expect(d.greenfield.upload).toHaveBeenCalledWith({
      objectName: "abc.jpg", mime: "image/jpeg", bytes,
    });
    expect(s.setImageDone).toHaveBeenCalledWith(ID, "nearly-feed");
  });

  /**
   * Greenfield mati TIDAK boleh mematikan feed (spec §8.2). Kegagalan
   * berhenti di sini sebagai status `failed`, tidak dilempar keluar — kalau
   * dilempar, ia menjadi unhandled rejection karena pemanggilnya tidak
   * meng-await.
   */
  it("menyetel failed dan TIDAK melempar saat unggahan gagal", async () => {
    const s = store();
    const d = deps(s, { upload: vi.fn(async () => { throw new Error("SP mati"); }) });
    await expect(prosesUnggahGambar(d, ID, "abc.jpg", "image/jpeg", bytes)).resolves.toBeUndefined();
    expect(s.setImageFailed).toHaveBeenCalledWith(ID);
    expect(s.setImageDone).not.toHaveBeenCalled();
  });

  it("tidak melempar walau penyimpanan status gagal juga", async () => {
    const s = store({ setImageFailed: vi.fn(async () => { throw new Error("db mati"); }) });
    const d = deps(s, { upload: vi.fn(async () => { throw new Error("SP mati"); }) });
    await expect(prosesUnggahGambar(d, ID, "abc.jpg", "image/jpeg", bytes)).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test feed-gate-image`
Expected: FAIL — `attachImage is not exported`

- [ ] **Step 3: Tambahkan di akhir `apps/api/src/feed-gate.ts`**

Tambahkan `recoverLampirGambarSigner` ke blok impor `@nearly/shared` yang sudah ada, lalu:

```ts
/**
 * Batas ukuran gambar. Ini BUKAN rem biaya — spec §11.3 menyatakan rem biaya
 * sengaja dibuat longgar dan dipantau manual. Ini pelindung memori API:
 * tanpa batas, satu badan permintaan 100 MB cukup untuk mematikan server.
 */
export const MAKS_GAMBAR_BYTES = 2 * 1024 * 1024;

const EKSTENSI: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
};

/**
 * Deterministik dari postId, bukan acak: percobaan ulang setelah `failed`
 * menimpa objek yang sama alih-alih meninggalkan sampah di Greenfield yang
 * tidak dirujuk baris mana pun.
 */
export function objectNameOf(postId: Hex, mime: string): string {
  return `${postId.slice(2)}.${EKSTENSI[mime] ?? "bin"}`;
}

export type AttachImageInput = {
  postId: Hex; author: Address; mime: string; expiresAt: bigint;
  sig: Hex; dataBase64: string;
};

export async function attachImage(
  input: AttachImageInput, deps: FeedDeps,
): Promise<FeedResult<{ objectName: string; bytes: Uint8Array }>> {
  if (sudahLewat(deps, input.expiresAt)) return fail({ code: "expired", httpStatus: 410 });

  const post = await deps.feed.getPost(input.postId);
  if (!post || post.deleted) return fail({ code: "post_not_found", httpStatus: 404 });

  const signer = await recoverLampirGambarSigner(
    { postId: input.postId, author: input.author, mime: input.mime, expiresAt: input.expiresAt },
    input.sig,
    deps.verifyingContract,
  );
  if (!samaAlamat(signer, input.author)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  if (!samaAlamat(post.author, input.author)) {
    return fail({ code: "not_author", httpStatus: 403 });
  }

  // Satu gambar per unggahan. `failed` sengaja BOLEH dicoba ulang — itu yang
  // membuat tombol coba-ulang di UI bekerja (spec §11.4).
  if (post.imageStatus === "pending" || post.imageStatus === "ready") {
    return fail({ code: "image_slot_taken", httpStatus: 409 });
  }

  const bytes = new Uint8Array(Buffer.from(input.dataBase64, "base64"));
  if (bytes.byteLength > MAKS_GAMBAR_BYTES) {
    return fail({ code: "image_too_large", httpStatus: 413 });
  }

  const objectName = objectNameOf(input.postId, input.mime);
  await deps.feed.setImagePending(input.postId, objectName, input.mime);
  return { ok: true, value: { objectName, bytes } };
}

/**
 * Dipanggil TANPA `await` oleh rute (spec §8.2). Karena itu ia tidak boleh
 * melempar apa pun: pelemparan dari promise yang tidak di-await menjadi
 * unhandled rejection yang bisa menjatuhkan proses.
 *
 * Kegagalan berhenti di sini sebagai status `failed`, dan teks unggahannya
 * tetap tayang — Greenfield mati tidak mematikan feed.
 */
export async function prosesUnggahGambar(
  deps: FeedDeps, postId: Hex, objectName: string, mime: string, bytes: Uint8Array,
): Promise<void> {
  try {
    await deps.greenfield.upload({ objectName, mime, bytes });
    await deps.feed.setImageDone(postId, deps.greenfield.bucket);
  } catch (e) {
    console.error("unggah gambar gagal:", e);
    try {
      await deps.feed.setImageFailed(postId);
    } catch (e2) {
      // Database ikut bermasalah. Baris tertinggal `pending` (spec §11.4);
      // penulis bisa mencoba ulang setelah statusnya terlihat macet.
      console.error("menandai gambar gagal juga gagal:", e2);
    }
  }
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test feed-gate && pnpm --filter @nearly/api typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/feed-gate.ts apps/api/test/feed-gate-image.test.ts
git commit -m "feat(api): lampiran gambar dengan unggah Greenfield asinkron"
```

---

## Task 10: `feed-store.ts` — akses Supabase

**Files:**
- Create: `apps/api/src/feed-store.ts`
- Test: `apps/api/test/feed-store-mapping.test.ts`

**Interfaces:**
- Consumes: `FeedStore`, `PostRecord`, `FeedCandidate` dari Task 4.
- Produces: `PostDbRow`, `rowToPost`, `petaHop`, `createFeedStore(db: SupabaseClient): FeedStore`.

**Aturan mengikat — JANGAN N+1.** Review akhir Fase 3a menemukan pola N+1 di `listDiscovery` (satu kueri hitung koneksi per host) dan memarkirnya. Feed dimuat jauh lebih sering, jadi di sini jumlah kueri harus **tetap** berapa pun banyaknya kandidat: satu kueri per tabel pendukung, lalu digabung di memori. Jangan pernah menaruh kueri di dalam `map` atau `for` atas kandidat.

Ikuti pola `createEventStore` di `apps/api/src/event-store.ts`: helper `ensureProfile` yang sama wajib dipanggil sebelum `insert` ke `posts`, karena `posts.author` adalah foreign key ke `profiles(address)` dan penulis yang belum pernah handshake belum punya baris profil.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/feed-store-mapping.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { petaHop, rowToPost, type PostDbRow } from "../src/feed-store";

const AKU = "0x00000000000000000000000000000000000000a1" as Address;
const B = "0x00000000000000000000000000000000000000b2";
const C = "0x00000000000000000000000000000000000000c3";
const D = "0x00000000000000000000000000000000000000d4";

function row(over: Partial<PostDbRow> = {}): PostDbRow {
  return {
    post_id: `0x${"1".repeat(64)}`,
    author: AKU,
    body: "halo",
    image_bucket: null, image_object: null, image_mime: null, image_status: "none",
    created_at: "2026-09-07T10:00:00.000Z",
    deleted_at: null,
    ...over,
  };
}

describe("rowToPost", () => {
  it("mengubah created_at menjadi milidetik epoch", () => {
    expect(rowToPost(row()).createdAtMs).toBe(Date.parse("2026-09-07T10:00:00.000Z"));
  });

  it("deleted_at yang terisi menjadi deleted true", () => {
    expect(rowToPost(row({ deleted_at: "2026-09-07T11:00:00.000Z" })).deleted).toBe(true);
    expect(rowToPost(row()).deleted).toBe(false);
  });

  it("meneruskan medan gambar apa adanya", () => {
    const p = rowToPost(row({
      image_bucket: "nearly-feed", image_object: "x.jpg",
      image_mime: "image/jpeg", image_status: "ready",
    }));
    expect(p.imageBucket).toBe("nearly-feed");
    expect(p.imageObject).toBe("x.jpg");
    expect(p.imageStatus).toBe("ready");
  });
});

describe("petaHop", () => {
  const tepi = (a: string, b: string) => ({ addr_a: a, addr_b: b });

  it("koneksi langsung berjarak 1 lompatan", () => {
    expect(petaHop(AKU, [tepi(AKU, B)], []).get(B.toLowerCase())).toBe(1);
  });

  it("koneksi dari koneksi berjarak 2 lompatan", () => {
    expect(petaHop(AKU, [tepi(AKU, B)], [tepi(B, C)]).get(C.toLowerCase())).toBe(2);
  });

  it("arah tepi tidak penting", () => {
    expect(petaHop(AKU, [tepi(B, AKU)], []).get(B.toLowerCase())).toBe(1);
  });

  // Satu lompatan menang atas dua: kalau seseorang bisa dicapai lewat kedua
  // jalur, yang lebih dekat yang berlaku.
  it("1 lompatan tidak diturunkan menjadi 2", () => {
    expect(petaHop(AKU, [tepi(AKU, B), tepi(AKU, C)], [tepi(B, C)]).get(C.toLowerCase())).toBe(1);
  });

  it("penonton sendiri tidak masuk peta", () => {
    expect(petaHop(AKU, [tepi(AKU, B)], [tepi(B, AKU)]).has(AKU.toLowerCase())).toBe(false);
  });

  it("orang yang tak terjangkau tidak masuk peta", () => {
    expect(petaHop(AKU, [tepi(AKU, B)], [tepi(B, C)]).has(D.toLowerCase())).toBe(false);
  });

  it("pencocokan tidak peka besar-kecil huruf", () => {
    expect(petaHop(AKU.toUpperCase() as Address, [tepi(AKU, B)], []).get(B.toLowerCase())).toBe(1);
  });

  it("penonton tanpa koneksi menghasilkan peta kosong", () => {
    expect(petaHop(AKU, [], []).size).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test feed-store-mapping`
Expected: FAIL — `Cannot find module '../src/feed-store'`

- [ ] **Step 3: Tulis implementasinya**

`apps/api/src/feed-store.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hex } from "viem";
import type { FeedCandidate, FeedStore, ImageStatus, PostRecord } from "./ports";

export type PostDbRow = {
  post_id: string;
  author: string;
  body: string;
  image_bucket: string | null;
  image_object: string | null;
  image_mime: string | null;
  image_status: string;
  created_at: string;
  deleted_at: string | null;
};

const KOLOM_POST =
  "post_id, author, body, image_bucket, image_object, image_mime, image_status, created_at, deleted_at";

export function rowToPost(row: PostDbRow): PostRecord {
  return {
    postId: row.post_id as Hex,
    author: row.author as Address,
    body: row.body,
    imageBucket: row.image_bucket,
    imageObject: row.image_object,
    imageMime: row.image_mime,
    imageStatus: row.image_status as ImageStatus,
    createdAtMs: Date.parse(row.created_at),
    deleted: row.deleted_at !== null,
  };
}

type Tepi = { addr_a: string; addr_b: string };

/**
 * Jarak graf penonton (spec §6.4). Murni, supaya bisa diuji tanpa database.
 *
 * Dihitung dari DUA himpunan tepi yang sudah diambil lebih dulu — bukan satu
 * kueri per unggahan. Feed dimuat jauh lebih sering daripada discovery, dan
 * pola N+1 di sini akan jauh lebih mahal daripada yang diparkir di Fase 3a.
 *
 * Kolom `blocked` TIDAK ADA di tabel connections; blokir baru datang di Fase 4
 * (spec §6.4). Setiap koneksi dihitung sebagai lompatan.
 */
export function petaHop(viewer: Address, tepi1: Tepi[], tepi2: Tepi[]): Map<string, 1 | 2> {
  const aku = viewer.toLowerCase();
  const peta = new Map<string, 1 | 2>();

  const seberang = (t: Tepi, dari: Set<string>): string | null => {
    const a = t.addr_a.toLowerCase();
    const b = t.addr_b.toLowerCase();
    if (dari.has(a)) return b;
    if (dari.has(b)) return a;
    return null;
  };

  const satu = new Set<string>();
  for (const t of tepi1) {
    const lain = seberang(t, new Set([aku]));
    if (lain && lain !== aku) satu.add(lain);
  }
  for (const a of satu) peta.set(a, 1);

  for (const t of tepi2) {
    const lain = seberang(t, satu);
    // 1 lompatan menang atas 2 — yang lebih dekat yang berlaku.
    if (lain && lain !== aku && !peta.has(lain)) peta.set(lain, 2);
  }

  return peta;
}

export function createFeedStore(db: SupabaseClient): FeedStore {
  async function ensureProfile(address: Address): Promise<void> {
    const { error } = await db
      .from("profiles")
      .upsert({ address: address.toLowerCase() }, { onConflict: "address", ignoreDuplicates: true });
    if (error) throw new Error(`upsert profile gagal: ${error.message}`);
  }

  return {
    async createPost(row) {
      // posts.author adalah foreign key ke profiles(address). Penulis yang
      // belum pernah handshake belum punya baris profil, dan tanpa ini
      // insert-nya gagal dengan pelanggaran foreign key mentah dari Postgres.
      // Pelajaran nyata dari Fase 3a.
      await ensureProfile(row.author);
      const { error } = await db.from("posts").insert({
        post_id: row.postId.toLowerCase(),
        author: row.author.toLowerCase(),
        body: row.body,
        created_at: new Date(row.createdAtMs).toISOString(),
      });
      if (error) throw new Error(`insert post gagal: ${error.message}`);
    },

    async getPost(postId) {
      const { data, error } = await db
        .from("posts").select(KOLOM_POST)
        .eq("post_id", postId.toLowerCase()).maybeSingle();
      if (error) throw new Error(`baca post gagal: ${error.message}`);
      return data ? rowToPost(data as PostDbRow) : null;
    },

    async markDeleted(postId) {
      const { error } = await db.from("posts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("post_id", postId.toLowerCase());
      if (error) throw new Error(`hapus post gagal: ${error.message}`);
    },

    async setLike(postId, who, suka) {
      await ensureProfile(who);
      if (suka) {
        const { error } = await db.from("post_likes").upsert(
          { post_id: postId.toLowerCase(), address: who.toLowerCase() },
          { onConflict: "post_id,address", ignoreDuplicates: true },
        );
        if (error) throw new Error(`suka gagal: ${error.message}`);
        return;
      }
      const { error } = await db.from("post_likes").delete()
        .eq("post_id", postId.toLowerCase()).eq("address", who.toLowerCase());
      if (error) throw new Error(`batal suka gagal: ${error.message}`);
    },

    async addReport(postId, reporter, reason) {
      const { error } = await db.from("post_reports").upsert(
        { post_id: postId.toLowerCase(), reporter: reporter.toLowerCase(), reason },
        { onConflict: "post_id,reporter", ignoreDuplicates: true },
      );
      if (error) throw new Error(`lapor post gagal: ${error.message}`);
    },

    async setImagePending(postId, objectName, mime) {
      const { error } = await db.from("posts")
        .update({ image_object: objectName, image_mime: mime, image_status: "pending" })
        .eq("post_id", postId.toLowerCase());
      if (error) throw new Error(`set gambar pending gagal: ${error.message}`);
    },

    async setImageDone(postId, bucket) {
      const { error } = await db.from("posts")
        .update({ image_bucket: bucket, image_status: "ready" })
        .eq("post_id", postId.toLowerCase());
      if (error) throw new Error(`set gambar ready gagal: ${error.message}`);
    },

    async setImageFailed(postId) {
      const { error } = await db.from("posts")
        .update({ image_status: "failed" })
        .eq("post_id", postId.toLowerCase());
      if (error) throw new Error(`set gambar failed gagal: ${error.message}`);
    },

    /**
     * Jumlah kueri di sini TETAP — tidak tumbuh mengikuti jumlah kandidat.
     * Satu kueri per tabel pendukung, lalu digabung di memori. Jangan pernah
     * menaruh kueri di dalam map/for atas kandidat.
     */
    async listCandidates({ sinceMs, limit, viewer }) {
      const { data: postRows, error: e1 } = await db
        .from("posts").select(KOLOM_POST)
        .gte("created_at", new Date(sinceMs).toISOString())
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (e1) throw new Error(`ambil kandidat gagal: ${e1.message}`);

      const posts = (postRows ?? []).map((r) => rowToPost(r as PostDbRow));
      if (posts.length === 0) return [];

      const ids = posts.map((p) => p.postId.toLowerCase());
      const penulis = [...new Set(posts.map((p) => p.author.toLowerCase()))];
      const aku = viewer ? viewer.toLowerCase() : null;

      const [likes, reports, snapshots, slashed, profiles] = await Promise.all([
        db.from("post_likes").select("post_id, address").in("post_id", ids),
        db.from("post_reports").select("post_id, reporter").in("post_id", ids),
        db.from("trust_snapshots").select("address, ratio, tier, connections").in("address", penulis),
        db.from("slashes").select("subject").in("subject", penulis),
        db.from("profiles").select("address, display_name").in("address", penulis),
      ]);
      for (const r of [likes, reports, snapshots, slashed, profiles]) {
        if (r.error) throw new Error(`hidrasi feed gagal: ${r.error.message}`);
      }

      const jumlahSuka = new Map<string, number>();
      const sukaAku = new Set<string>();
      for (const r of (likes.data ?? []) as { post_id: string; address: string }[]) {
        jumlahSuka.set(r.post_id, (jumlahSuka.get(r.post_id) ?? 0) + 1);
        if (aku && r.address.toLowerCase() === aku) sukaAku.add(r.post_id);
      }

      const jumlahLapor = new Map<string, number>();
      for (const r of (reports.data ?? []) as { post_id: string }[]) {
        jumlahLapor.set(r.post_id, (jumlahLapor.get(r.post_id) ?? 0) + 1);
      }

      const snap = new Map<string, { ratio: number; tier: number; connections: number }>();
      for (const r of (snapshots.data ?? []) as
        { address: string; ratio: number; tier: number; connections: number }[]) {
        snap.set(r.address.toLowerCase(), r);
      }

      const kenaSlash = new Set(
        ((slashed.data ?? []) as { subject: string }[]).map((r) => r.subject.toLowerCase()),
      );

      const nama = new Map<string, string>();
      for (const r of (profiles.data ?? []) as { address: string; display_name: string }[]) {
        nama.set(r.address.toLowerCase(), r.display_name);
      }

      // DUA kueri untuk seluruh graf penonton, bukan satu per unggahan.
      let hop = new Map<string, 1 | 2>();
      if (aku) {
        const { data: t1, error: e2 } = await db
          .from("connections").select("addr_a, addr_b")
          .or(`addr_a.eq.${aku},addr_b.eq.${aku}`);
        if (e2) throw new Error(`ambil koneksi gagal: ${e2.message}`);

        const satu = [...new Set(((t1 ?? []) as { addr_a: string; addr_b: string }[])
          .flatMap((t) => [t.addr_a.toLowerCase(), t.addr_b.toLowerCase()])
          .filter((a) => a !== aku))];

        let t2: { addr_a: string; addr_b: string }[] = [];
        if (satu.length > 0) {
          const { data, error: e3 } = await db
            .from("connections").select("addr_a, addr_b")
            .or(`addr_a.in.(${satu.join(",")}),addr_b.in.(${satu.join(",")})`);
          if (e3) throw new Error(`ambil koneksi lapis dua gagal: ${e3.message}`);
          t2 = (data ?? []) as { addr_a: string; addr_b: string }[];
        }
        hop = petaHop(viewer as Address, (t1 ?? []) as Tepi[], t2);
      }

      return posts.map((p): FeedCandidate => {
        const a = p.author.toLowerCase();
        const s = snap.get(a);
        return {
          ...p,
          displayName: nama.get(a) ?? "",
          authorRatio: s?.ratio ?? 0,
          authorTier: s?.tier ?? 0,
          authorConnections: s?.connections ?? 0,
          authorSlashed: kenaSlash.has(a),
          reportCount: jumlahLapor.get(p.postId.toLowerCase()) ?? 0,
          likeCount: jumlahSuka.get(p.postId.toLowerCase()) ?? 0,
          sudahSuka: sukaAku.has(p.postId.toLowerCase()),
          hop: hop.get(a) ?? null,
        };
      });
    },
  };
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test feed-store-mapping && pnpm --filter @nearly/api typecheck`
Expected: PASS

- [ ] **Step 5: Buktikan tidak ada N+1**

Run: `grep -nE "for .*of (posts|kandidat|candidates)|\.map\(async" apps/api/src/feed-store.ts`
Expected: tidak ada baris yang memuat `db.from` di dalamnya. Jumlah `await db.` maupun `db.from` di `listCandidates` harus konstan (7 atau 8, tergantung penonton anonim atau tidak), bukan bergantung jumlah kandidat.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/feed-store.ts apps/api/test/feed-store-mapping.test.ts
git commit -m "feat(api): feed-store Supabase dengan hidrasi jumlah kueri tetap"
```

---

## Task 11: Adapter Greenfield

**Files:**
- Create: `apps/api/src/greenfield.ts`
- Modify: `apps/api/package.json`
- Test: `apps/api/test/greenfield-config.test.ts`

**Interfaces:**
- Consumes: `GreenfieldPort` dari Task 4.
- Produces: `createGreenfield(cfg): GreenfieldPort`.

**Yang HARUS dipahami implementer sebelum menulis (spec §8.1):**

1. **Greenfield adalah chain terpisah.** Chain id testnet `5600`, gas-nya sendiri. tBNB di BSC testnet tidak membayar apa pun di sana.
2. **Satu gambar butuh dua langkah**: `createObject` (transaksi on-chain di Greenfield, ditunggu konfirmasinya) lalu `uploadObject` (HTTP ke storage provider). Checksum Reed-Solomon dihitung sebelum keduanya.
3. **Adapter ini TIDAK diuji unit terhadap jaringan.** Ia ada di balik port; seluruh tes memakai fake. Verifikasi aslinya manual di Task 15.

- [ ] **Step 1: Pasang dependensi**

```bash
pnpm --filter @nearly/api add @bnb-chain/greenfield-js-sdk @bnb-chain/reed-solomon
```

Sematkan versi pastinya di `apps/api/package.json` (tanpa `^`), lalu catat versi yang terpasang di komentar kepala `greenfield.ts`. SDK ini bergerak cepat; versi mengambang membuat kegagalan muncul tanpa perubahan kode apa pun di sisi kita.

- [ ] **Step 2: Tulis tes konfigurasi yang gagal**

`apps/api/test/greenfield-config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { createGreenfield } from "../src/greenfield";

const cfg = {
  rpcUrl: "https://gnfd-testnet-fullnode-tendermint-ap.bnbchain.org",
  chainId: "5600",
  bucket: "nearly-feed",
  spEndpoint: "https://gnfd-testnet-sp-2.bnbchain.org",
  privateKey: `0x${"11".repeat(32)}` as Hex,
};

describe("createGreenfield", () => {
  // Membuat klien TIDAK boleh menyentuh jaringan: kalau ia melakukannya,
  // API gagal menyala saat Greenfield sedang mati — padahal spec §8.2
  // menuntut feed teks tetap hidup dalam keadaan itu.
  it("membuat port tanpa menyentuh jaringan", () => {
    const gf = createGreenfield(cfg);
    expect(gf.bucket).toBe("nearly-feed");
    expect(gf.spEndpoint).toBe("https://gnfd-testnet-sp-2.bnbchain.org");
    expect(typeof gf.upload).toBe("function");
  });

  it("menolak bucket kosong saat dibuat, bukan saat unggahan pertama", () => {
    expect(() => createGreenfield({ ...cfg, bucket: "" }))
      .toThrow(/GREENFIELD_BUCKET/);
  });

  it("menolak endpoint storage provider kosong", () => {
    expect(() => createGreenfield({ ...cfg, spEndpoint: "" }))
      .toThrow(/GREENFIELD_SP_ENDPOINT/);
  });
});
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test greenfield-config`
Expected: FAIL — `Cannot find module '../src/greenfield'`

- [ ] **Step 4: Tulis adapternya**

`apps/api/src/greenfield.ts`:

```ts
// Adapter BNB Greenfield. Diverifikasi manual saat deploy (Task 15), bukan
// oleh tes — seluruh tes memakai fake di balik GreenfieldPort.
//
// Versi SDK DISEMATKAN di package.json dengan sengaja: SDK ini bergerak
// cepat, dan versi mengambang membuat kegagalan muncul tanpa perubahan kode
// apa pun di sisi kita.
import {
  Client, RedundancyType, VisibilityType, bytesFromBase64, Long,
} from "@bnb-chain/greenfield-js-sdk";
import { NodeAdapterReedSolomon } from "@bnb-chain/reed-solomon/node.adapter";
import { privateKeyToAccount } from "viem/accounts";
import type { Hex } from "viem";
import type { GreenfieldPort } from "./ports";

export type GreenfieldConfig = {
  rpcUrl: string;
  chainId: string;
  bucket: string;
  spEndpoint: string;
  privateKey: Hex;
};

export function createGreenfield(cfg: GreenfieldConfig): GreenfieldPort {
  // Divalidasi saat pembuatan, bukan saat unggahan pertama: salah konfigurasi
  // harus ketahuan waktu API menyala, bukan berjam-jam kemudian ketika
  // seseorang mengunggah gambar pertamanya.
  if (!cfg.bucket) throw new Error("env GREENFIELD_BUCKET wajib diisi");
  if (!cfg.spEndpoint) throw new Error("env GREENFIELD_SP_ENDPOINT wajib diisi");
  if (!cfg.rpcUrl) throw new Error("env GREENFIELD_RPC wajib diisi");

  const alamat = privateKeyToAccount(cfg.privateKey).address;

  // Klien dibuat malas: Client.create bisa menyentuh jaringan, dan API harus
  // tetap menyala saat Greenfield mati (spec §8.2).
  let klien: ReturnType<typeof Client.create> | null = null;
  const dapatkanKlien = () => {
    klien ??= Client.create(cfg.rpcUrl, cfg.chainId);
    return klien;
  };

  return {
    bucket: cfg.bucket,
    spEndpoint: cfg.spEndpoint,

    async upload({ objectName, mime, bytes }) {
      const client = dapatkanKlien();

      // Langkah 1 — checksum Reed-Solomon. Wajib ada SEBELUM createObject:
      // rantai menyimpan checksum ini, dan storage provider menolak byte
      // yang tidak cocok.
      //
      // `encodeInSubWorker`, BUKAN `encodeInWorker`. Yang kedua sudah
      // deprecated dan menuntut argumen berupa path ke berkas worker yang
      // punya bootstrap `parentPort` sendiri — berkas ini tidak punya itu,
      // jadi `__filename` akan dimuat sebagai Worker tanpa ada yang
      // mengirimkan hasil balik, dan checksum-nya kosong atau salah diam-diam.
      // `encodeInSubWorker` memakai `sub-worker.js` yang sudah dibundel paket.
      const rs = new NodeAdapterReedSolomon();
      const checksums = await rs.encodeInSubWorker(bytes);

      // Langkah 2 — createObject: transaksi on-chain DI GREENFIELD, bukan
      // BSC. Gasnya dibayar dari saldo akun ini di chain Greenfield.
      const tx = await client.object.createObject({
        bucketName: cfg.bucket,
        objectName,
        creator: alamat,
        visibility: VisibilityType.VISIBILITY_TYPE_PUBLIC_READ,
        contentType: mime,
        redundancyType: RedundancyType.REDUNDANCY_EC_TYPE,
        payloadSize: Long.fromInt(bytes.byteLength),
        expectChecksums: checksums.map((c: string) => bytesFromBase64(c)),
      });
      const sim = await tx.simulate({ denom: "BNB" });
      const res = await tx.broadcast({
        denom: "BNB",
        gasLimit: Number(sim?.gasLimit),
        gasPrice: sim?.gasPrice || "5000000000",
        payer: alamat,
        granter: "",
        privateKey: cfg.privateKey,
      });

      // Langkah 3 — byte-nya sendiri, lewat HTTP ke storage provider.
      await client.object.uploadObject(
        {
          bucketName: cfg.bucket,
          objectName,
          body: { name: objectName, type: mime, size: bytes.byteLength, content: Buffer.from(bytes) },
          txnHash: res.transactionHash,
        },
        { type: "ECDSA", privateKey: cfg.privateKey },
      );
    },
  };
}
```

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test greenfield-config && pnpm --filter @nearly/api typecheck`
Expected: PASS

Kalau nama ekspor SDK berbeda dari yang ditulis di atas (`RedundancyType`, `VisibilityType`, `bytesFromBase64`, `Long`), sesuaikan ke versi yang benar-benar terpasang dan **catat versinya di komentar kepala berkas**. Jangan mengganti pendekatannya — dua langkah `createObject` lalu `uploadObject` itu memang bentuk API-nya.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/greenfield.ts apps/api/test/greenfield-config.test.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): adapter BNB Greenfield di balik port"
```

---

## Task 12: Rute feed dan perakitan

**Files:**
- Create: `apps/api/src/routes/feed.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/index.ts`, `.env.example`
- Test: `apps/api/test/feed.route.test.ts`

**Interfaces:**
- Consumes: gerbang Task 7–9; `rankFeed`, `FEED_LIMIT` Task 6; skema Zod Task 2; `createFeedStore` Task 10; `createGreenfield` Task 11.
- Produces: `feedRoutes(deps: FeedDeps)`.

**Aturan mengikat:**
- `:id` di path **wajib** sama dengan `postId` di badan, dibandingkan case-insensitive — pakai helper `sameId` bergaya `routes/events.ts`. Tanpa itu path segment diam-diam diabaikan.
- `GET /feed?who=` **TIDAK** butuh tanda tangan bukti baca (spec §9.3). Ini sengaja berbeda dari `GET /events/:id?who=`, dan alasannya wajib ditulis sebagai komentar di rute.
- `prosesUnggahGambar` dipanggil **tanpa `await`**.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/feed.route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { makePostId, postTypedData } from "@nearly/shared";
import { feedRoutes } from "../src/routes/feed";
import type { FeedCandidate, FeedDeps, FeedStore, PostRecord } from "../src/ports";

const penulis = privateKeyToAccount(`0x${"77".repeat(32)}` as Hex);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const NOW = 1_800_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);

function rekam(over: Partial<PostRecord> = {}): PostRecord {
  return {
    postId: `0x${"1".repeat(64)}` as Hex, author: penulis.address, body: "halo",
    imageBucket: null, imageObject: null, imageMime: null, imageStatus: "none",
    createdAtMs: NOW, deleted: false, ...over,
  };
}

function kandidat(over: Partial<FeedCandidate> = {}): FeedCandidate {
  return {
    ...rekam(), displayName: "Andi", authorRatio: 0.1, authorTier: 1,
    authorConnections: 4, authorSlashed: false, reportCount: 0,
    likeCount: 3, sudahSuka: false, hop: 1, ...over,
  };
}

function store(over: Partial<FeedStore> = {}): FeedStore {
  return {
    createPost: vi.fn(async () => {}), getPost: vi.fn(async () => null),
    markDeleted: vi.fn(async () => {}), setLike: vi.fn(async () => {}),
    addReport: vi.fn(async () => {}), setImagePending: vi.fn(async () => {}),
    setImageDone: vi.fn(async () => {}), setImageFailed: vi.fn(async () => {}),
    listCandidates: vi.fn(async () => []), ...over,
  };
}

function app(feed: FeedStore) {
  const deps: FeedDeps = {
    feed,
    greenfield: { bucket: "nearly-feed", spEndpoint: "https://sp.example", upload: vi.fn(async () => {}) },
    verifyingContract: KONTRAK,
    nowMs: () => NOW,
  };
  const a = new Hono();
  a.route("/", feedRoutes(deps));
  return a;
}

async function badanBuat(over: Record<string, unknown> = {}) {
  const postId = makePostId();
  const pesan = { postId, author: penulis.address, body: "halo dunia", expiresAt: EXP };
  const sig = await penulis.signTypedData(postTypedData(pesan, KONTRAK));
  return { postId, author: penulis.address, body: "halo dunia", expiresAt: EXP.toString(), sig, ...over };
}

const kirim = (a: Hono, path: string, body: unknown) =>
  a.request(path, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });

describe("POST /posts", () => {
  it("mengembalikan 200 untuk permintaan sah", async () => {
    const res = await kirim(app(store()), "/posts", await badanBuat());
    expect(res.status).toBe(200);
  });

  it("mengembalikan 400 untuk badan yang tidak valid", async () => {
    const res = await kirim(app(store()), "/posts", { author: penulis.address });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_body" });
  });

  it("mengembalikan 400 untuk body melebihi 500 karakter", async () => {
    const res = await kirim(app(store()), "/posts", await badanBuat({ body: "a".repeat(501) }));
    expect(res.status).toBe(400);
  });

  // Bukan 500. Zod menjalankan refine walau field gagal.
  it("mengembalikan 400, bukan 500, untuk expiresAt bukan angka", async () => {
    const res = await kirim(app(store()), "/posts", await badanBuat({ expiresAt: "besok" }));
    expect(res.status).toBe(400);
  });

  it("meneruskan httpStatus dari gerbang", async () => {
    const res = await kirim(app(store({ getPost: vi.fn(async () => rekam()) })), "/posts", await badanBuat());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "post_exists" });
  });
});

describe("kecocokan :id dengan badan", () => {
  it("menolak ketika :id berbeda dari postId di badan", async () => {
    const badan = await badanBuat();
    const res = await kirim(app(store()), `/posts/0x${"9".repeat(64)}/delete`, {
      postId: badan.postId, author: penulis.address, expiresAt: EXP.toString(), sig: badan.sig,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_body" });
  });

  it("menerima :id yang sama walau beda besar-kecil huruf", async () => {
    const s = store({ getPost: vi.fn(async () => null) });
    const id = `0x${"1".repeat(64)}` as Hex;
    const res = await kirim(app(s), `/posts/${id.toUpperCase()}/delete`, {
      postId: id, author: penulis.address, expiresAt: EXP.toString(), sig: `0x${"b".repeat(130)}`,
    });
    // Lolos pemeriksaan :id, lalu gagal di gerbang karena unggahan tidak ada.
    expect(res.status).toBe(404);
  });
});

describe("GET /feed", () => {
  it("mengembalikan baris terperingkat tanpa menuntut who", async () => {
    const s = store({ listCandidates: vi.fn(async () => [kandidat()]) });
    const res = await app(s).request("/feed");
    expect(res.status).toBe(200);
    const json = await res.json() as { posts: unknown[] };
    expect(json.posts).toHaveLength(1);
  });

  /**
   * Sengaja BERBEDA dari GET /events/:id?who= di Fase 3a (spec §9.3). Di sana
   * ?who= dijaga tanda tangan karena membocorkan NIAT seseorang berada di
   * suatu tempat dan waktu. Di sini ia hanya membocorkan urutan berdasarkan
   * kedekatan graf, dan graf koneksi sudah publik on-chain.
   */
  it("menerima who tanpa tanda tangan bukti baca", async () => {
    const s = store({ listCandidates: vi.fn(async () => [kandidat()]) });
    const res = await app(s).request(`/feed?who=${penulis.address}`);
    expect(res.status).toBe(200);
    expect(s.listCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ viewer: penulis.address.toLowerCase() }),
    );
  });

  it("mengabaikan who yang bukan alamat, bukan menggagalkan permintaan", async () => {
    const s = store({ listCandidates: vi.fn(async () => [kandidat()]) });
    const res = await app(s).request("/feed?who=bukan-alamat");
    expect(res.status).toBe(200);
    expect(s.listCandidates).toHaveBeenCalledWith(expect.objectContaining({ viewer: null }));
  });

  // Semua angka waktu keluar sebagai angka JSON biasa; tidak ada bigint yang
  // lolos ke serializer. Fase 3a menemukan bug ini lewat fixture kosong.
  it("seluruh baris bisa diserialisasi tanpa galat bigint", async () => {
    const s = store({ listCandidates: vi.fn(async () => [kandidat(), kandidat()]) });
    const res = await app(s).request("/feed");
    await expect(res.json()).resolves.toBeTruthy();
  });

  it("cursor bukan angka diperlakukan sebagai halaman pertama", async () => {
    const s = store({ listCandidates: vi.fn(async () => [kandidat()]) });
    const res = await app(s).request("/feed?cursor=abc");
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test feed.route`
Expected: FAIL — `Cannot find module '../src/routes/feed'`

- [ ] **Step 3: Tulis rutenya**

`apps/api/src/routes/feed.ts`:

```ts
import { Hono } from "hono";
import { isAddress, type Address, type Hex } from "viem";
import {
  AttachImageRequestSchema, CreatePostRequestSchema, DeletePostRequestSchema,
  LikeRequestSchema, ReportPostRequestSchema,
} from "@nearly/shared";
import { attachImage, createPost, deletePost, prosesUnggahGambar, reportPost, setLike } from "../feed-gate";
import { FEED_LIMIT, rankFeed } from "../feed-rank";
import type { FeedDeps } from "../ports";

/** Jendela kandidat (spec §11.6). */
const JENDELA_MS = 14 * 24 * 3_600_000;
const MAKS_KANDIDAT = 500;

/**
 * `:id` di path wajib sama dengan `postId` di badan — kalau tidak, path
 * segment itu diam-diam diabaikan dan menghasilkan bug klien yang menyakitkan
 * untuk dilacak. Case-insensitive karena id memang heksa lowercase, tapi
 * klien bisa mengirim campuran.
 */
function sameId(pathId: string, bodyId: string) {
  return pathId.toLowerCase() === bodyId.toLowerCase();
}

export function feedRoutes(deps: FeedDeps) {
  const r = new Hono();

  r.post("/posts", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = CreatePostRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);

    const b = parsed.data;
    const hasil = await createPost({
      postId: b.postId as Hex, author: b.author as Address, body: b.body,
      expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.post("/posts/:id/delete", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = DeletePostRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    if (!sameId(c.req.param("id"), parsed.data.postId)) {
      return c.json({ code: "invalid_body" }, 400);
    }

    const b = parsed.data;
    const hasil = await deletePost({
      postId: b.postId as Hex, author: b.author as Address,
      expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.post("/posts/:id/like", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = LikeRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    if (!sameId(c.req.param("id"), parsed.data.postId)) {
      return c.json({ code: "invalid_body" }, 400);
    }

    const b = parsed.data;
    const hasil = await setLike({
      postId: b.postId as Hex, who: b.who as Address, suka: b.suka,
      expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.post("/posts/:id/report", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = ReportPostRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    if (!sameId(c.req.param("id"), parsed.data.postId)) {
      return c.json({ code: "invalid_body" }, 400);
    }

    const b = parsed.data;
    const hasil = await reportPost({
      postId: b.postId as Hex, reporter: b.reporter as Address, reason: b.reason,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.post("/posts/:id/image", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = AttachImageRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);
    if (!sameId(c.req.param("id"), parsed.data.postId)) {
      return c.json({ code: "invalid_body" }, 400);
    }

    const b = parsed.data;
    const hasil = await attachImage({
      postId: b.postId as Hex, author: b.author as Address, mime: b.mime,
      expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex, dataBase64: b.dataBase64,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);

    // TANPA await, dengan sengaja (spec §8.2). Unggahan ke Greenfield butuh
    // hitungan detik — dua langkah, satu di antaranya transaksi on-chain di
    // chain Greenfield. Menunggunya akan membuat menulis unggahan terasa
    // macet, dan Greenfield yang mati akan ikut mematikan penulisan.
    // prosesUnggahGambar sudah dijamin tidak pernah melempar.
    void prosesUnggahGambar(
      deps, b.postId as Hex, hasil.value.objectName, b.mime, hasil.value.bytes,
    );
    return c.json({ ok: true, imageStatus: "pending" });
  });

  /**
   * TIDAK butuh tanda tangan bukti baca, sengaja berbeda dari
   * GET /events/:id?who= di Fase 3a (spec §9.3).
   *
   * Di sana `?who=` dijaga ketat karena membocorkan NIAT seseorang berada di
   * suatu tempat dan waktu — informasi yang belum terjadi dan tidak ada di
   * mana pun selain database kita. Di sini `?who=` hanya membocorkan urutan
   * berdasarkan kedekatan graf, dan graf koneksi SUDAH publik on-chain di
   * ConnectionRegistry. Memasang gerbang di sini menambah gesekan tanpa
   * menambah perlindungan.
   *
   * `who` yang cacat bukan galat: rute ini tidak boleh gagal untuk orang yang
   * membuka tautan. Ia cukup diperlakukan sebagai penonton anonim.
   */
  r.get("/feed", async (c) => {
    const q = c.req.query();
    const viewer = q.who && isAddress(q.who) ? (q.who.toLowerCase() as Address) : null;

    const offsetMentah = Number(q.cursor);
    const offset = Number.isInteger(offsetMentah) && offsetMentah > 0
      ? Math.min(offsetMentah, MAKS_KANDIDAT)
      : 0;

    const kandidat = await deps.feed.listCandidates({
      sinceMs: deps.nowMs() - JENDELA_MS,
      limit: MAKS_KANDIDAT,
      viewer,
    });

    // Peringkat dihitung ulang tiap permintaan lalu dipotong per halaman.
    // Konsekuensinya diakui di spec §11.5: unggahan bisa bergeser antar
    // halaman saat menggulir lama, karena `kebaruan` terus meluruh.
    const semua = rankFeed(kandidat, {
      nowMs: deps.nowMs(),
      viewer,
      spEndpoint: deps.greenfield.spEndpoint,
      limit: offset + FEED_LIMIT,
    });
    const posts = semua.slice(offset);

    return c.json({
      posts,
      cursor: posts.length === FEED_LIMIT ? String(offset + FEED_LIMIT) : null,
    });
  });

  return r;
}
```

- [ ] **Step 4: Rakit ke aplikasi**

Di `apps/api/src/app.ts`: impor `feedRoutes` dan `FeedStore`/`GreenfieldPort`, tambahkan keduanya ke `TrustDeps`, lalu daftarkan rutenya. **`onChanged` TIDAK dipanggil dari rute feed** — unggahan dan suka tidak mengubah graf pertemuan, jadi tidak ada skor trust yang perlu dihitung ulang.

```ts
import { feedRoutes } from "./routes/feed";
import type { FeedStore, GreenfieldPort } from "./ports";

// di dalam TrustDeps:
  feed: FeedStore;
  greenfield: GreenfieldPort;

// di dalam createApp, setelah eventRoutes:
  app.route("/", feedRoutes(deps));
```

Di `apps/api/src/index.ts`, tambahkan sebelum `createApp`:

```ts
import { createFeedStore } from "./feed-store";
import { createGreenfield } from "./greenfield";

// di dalam createApp({ ... }):
  feed: createFeedStore(supabase),
  greenfield: createGreenfield({
    rpcUrl: required("GREENFIELD_RPC"),
    chainId: required("GREENFIELD_CHAIN_ID"),
    bucket: required("GREENFIELD_BUCKET"),
    spEndpoint: required("GREENFIELD_SP_ENDPOINT"),
    privateKey: required("RELAYER_PRIVATE_KEY") as Hex,
  }),
```

- [ ] **Step 5: Tambahkan variabel di `.env.example`**

```
# --- BNB Greenfield (Fase 3b) ---
# Greenfield adalah CHAIN TERPISAH dari BSC testnet. tBNB di BSC tidak
# membayar apa pun di sini — akun RELAYER_PRIVATE_KEY harus didanai
# TERSENDIRI di chain Greenfield lewat faucet atau jembatan BSC<->Greenfield.
GREENFIELD_RPC=https://gnfd-testnet-fullnode-tendermint-ap.bnbchain.org
GREENFIELD_CHAIN_ID=5600
# Bucket dibuat sekali secara manual saat deploy. Lihat Task 15.
GREENFIELD_BUCKET=
# Endpoint storage provider. URL baca publik berbentuk
# <endpoint>/view/<bucket>/<object>.
GREENFIELD_SP_ENDPOINT=
```

- [ ] **Step 6: Jalankan seluruh tes API**

Run: `pnpm --filter @nearly/api test && pnpm --filter @nearly/api typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/feed.ts apps/api/src/app.ts apps/api/src/index.ts apps/api/test/feed.route.test.ts .env.example
git commit -m "feat(api): enam endpoint feed dan perakitannya"
```

---

## Task 13: Mobile — klien HTTP bersama dan klien feed

**Files:**
- Create: `apps/mobile/src/http.ts`, `apps/mobile/src/feed-api.ts`
- Modify: `apps/mobile/src/api.ts`, `apps/mobile/src/events-api.ts`, `apps/mobile/src/messages.ts`
- Test: `apps/mobile/test/http.test.ts`, `apps/mobile/test/feed-messages.test.ts`

**Interfaces:**
- Produces: `ApiError` (dipindah ke `http.ts`), `req<T>(path, init?)`, `postJson<T>(path, body)`, `feedErrorMessage(code)`, dan klien feed `getFeed`, `postPost`, `postLike`, `postReport`, `postDelete`, `postImage`.

**Kenapa task ini ada.** Review akhir Fase 3a menemukan duplikasi klien HTTP dan memarkirnya: `api.ts` punya `post<T>` privat, `events-api.ts` punya `req<T>` yang nyaris identik. Menambah `feed-api.ts` menjadikannya salinan **ketiga**. Ekstraksi dilakukan **sebelum** klien feed ditulis, bukan sesudah.

`ApiError` pindah ke `http.ts` dan **di-re-export dari `api.ts`** supaya impor yang sudah ada di `app/scan.tsx`, `app/events/*` dan lainnya tidak perlu disentuh.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/http.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, postJson, req } from "../src/http";

const asli = globalThis.fetch;
afterEach(() => { globalThis.fetch = asli; });

function palsu(status: number, body: unknown) {
  globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  })) as unknown as typeof fetch;
}

describe("req", () => {
  it("mengembalikan JSON pada respons sukses", async () => {
    palsu(200, { ok: true });
    await expect(req<{ ok: boolean }>("/x")).resolves.toEqual({ ok: true });
  });

  it("melempar ApiError dengan code dan status dari badan", async () => {
    palsu(409, { code: "post_exists" });
    await expect(req("/x")).rejects.toMatchObject({ code: "post_exists", status: 409 });
  });

  it("meneruskan reason kalau ada", async () => {
    palsu(422, { code: "not_colocated", reason: "time_too_far" });
    await expect(req("/x")).rejects.toMatchObject({ reason: "time_too_far" });
  });

  // Badan bukan JSON tidak boleh menjadi galat parse yang membingungkan.
  it("memakai code unknown kalau badan tidak bisa dibaca", async () => {
    globalThis.fetch = vi.fn(async () => new Response("bukan json", { status: 500 })) as unknown as typeof fetch;
    await expect(req("/x")).rejects.toMatchObject({ code: "unknown", status: 500 });
  });
});

describe("postJson", () => {
  it("mengirim metode POST dengan content-type JSON", async () => {
    const mata = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = mata as unknown as typeof fetch;
    await postJson("/x", { a: 1 });
    const [, init] = mata.mock.calls[0]!;
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).body).toBe(JSON.stringify({ a: 1 }));
  });
});

describe("ApiError", () => {
  it("pesannya memuat code, dan reason kalau ada", () => {
    expect(new ApiError("expired", 410).message).toContain("expired");
    expect(new ApiError("not_colocated", 422, "cell_too_far").message).toContain("cell_too_far");
  });
});
```

`apps/mobile/test/feed-messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { feedErrorMessage } from "../src/messages";

describe("feedErrorMessage", () => {
  it("menerjemahkan setiap kode gerbang feed ke bahasa Indonesia", () => {
    for (const kode of [
      "post_exists", "post_not_found", "not_author",
      "image_slot_taken", "image_too_large", "bad_signature", "expired", "invalid_body",
    ]) {
      const pesan = feedErrorMessage(kode);
      expect(pesan).not.toContain("_");
      expect(pesan.length).toBeGreaterThan(10);
    }
  });

  it("kode yang tidak dikenal tetap menghasilkan kalimat, bukan kode mentah", () => {
    expect(feedErrorMessage("kode_aneh_dari_masa_depan")).not.toContain("kode_aneh");
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile test`
Expected: FAIL — `Cannot find module '../src/http'`

- [ ] **Step 3: Buat `apps/mobile/src/http.ts`**

```ts
import { CONFIG } from "./config";

export class ApiError extends Error {
  constructor(public code: string, public status: number, public reason?: string) {
    super(`${code}${reason ? ` (${reason})` : ""}`);
  }
}

/**
 * Satu-satunya klien HTTP aplikasi ini. Sebelum berkas ini ada, api.ts dan
 * events-api.ts memelihara salinan yang nyaris identik — dan feed akan
 * menjadi yang ketiga.
 */
export async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CONFIG.apiUrl}${path}`, init);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      typeof json.code === "string" ? json.code : "unknown",
      res.status,
      typeof json.reason === "string" ? json.reason : undefined,
    );
  }
  return json as T;
}

export function postJson<T>(path: string, body: unknown): Promise<T> {
  return req<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
```

- [ ] **Step 4: Alihkan `api.ts` dan `events-api.ts`**

Di `apps/mobile/src/api.ts`: hapus definisi `ApiError` dan fungsi `post<T>` privat, ganti dengan

```ts
import { postJson, ApiError } from "./http";
// Di-re-export supaya impor `{ ApiError } from "./api"` yang sudah ada di
// app/scan.tsx dan layar lain tidak perlu disentuh.
export { ApiError };
```

lalu ganti setiap pemanggilan `post(` menjadi `postJson(`.

Di `apps/mobile/src/events-api.ts`: hapus fungsi `req<T>` privat dan impor `ApiError` dari `./api`, ganti dengan `import { req } from "./http";`.

- [ ] **Step 5: Tambahkan `feedErrorMessage` di `apps/mobile/src/messages.ts`**

```ts
const FEED_MESSAGES: Record<string, string> = {
  post_exists: "Unggahan dengan id itu sudah ada. Coba tulis ulang.",
  post_not_found: "Unggahan ini sudah tidak ada.",
  not_author: "Hanya penulisnya yang bisa mengubah unggahan ini.",
  image_slot_taken: "Unggahan ini sudah punya gambar. Satu gambar per unggahan.",
  image_too_large: "Gambarnya terlalu besar. Maksimal 2 MB.",
  bad_signature: "Tanda tangan tidak cocok. Coba lagi.",
  expired: "Permintaannya sudah kedaluwarsa. Coba lagi.",
  invalid_body: "Ada isian yang belum benar.",
};

export function feedErrorMessage(code: string): string {
  return FEED_MESSAGES[code] ?? "Gagal. Coba lagi sebentar.";
}
```

- [ ] **Step 6: Buat `apps/mobile/src/feed-api.ts`**

```ts
import type { Hex } from "viem";
import { postJson, req } from "./http";

export type FeedPost = {
  postId: Hex;
  author: string;
  displayName: string;
  tier: number;
  body: string;
  imageUrl: string | null;
  imageStatus: "none" | "pending" | "ready" | "failed";
  likeCount: number;
  sudahSuka: boolean;
  /** 1, 2, atau null (luar jaringan). Menyalakan baris alasan di kartu. */
  hop: 1 | 2 | null;
  createdAtMs: number;
};

export function getFeed(who?: string, cursor?: string) {
  const q = new URLSearchParams();
  if (who) q.set("who", who);
  if (cursor) q.set("cursor", cursor);
  const s = q.toString();
  return req<{ posts: FeedPost[]; cursor: string | null }>(`/feed${s ? `?${s}` : ""}`);
}

export const postPost = (b: unknown) => postJson<{ ok: true }>("/posts", b);
export const postLike = (id: Hex, b: unknown) => postJson<{ ok: true }>(`/posts/${id}/like`, b);
export const postReport = (id: Hex, b: unknown) => postJson<{ ok: true }>(`/posts/${id}/report`, b);
export const postDelete = (id: Hex, b: unknown) => postJson<{ ok: true }>(`/posts/${id}/delete`, b);
export const postImage = (id: Hex, b: unknown) =>
  postJson<{ ok: true; imageStatus: string }>(`/posts/${id}/image`, b);
```

- [ ] **Step 7: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile test && pnpm --filter @nearly/mobile typecheck`
Expected: PASS

- [ ] **Step 8: Buktikan duplikasi benar-benar hilang**

Run: `grep -c "await res.json().catch" apps/mobile/src/*.ts`
Expected: hanya `http.ts` yang bernilai 1; `api.ts` dan `events-api.ts` bernilai 0.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/http.ts apps/mobile/src/api.ts apps/mobile/src/events-api.ts apps/mobile/src/feed-api.ts apps/mobile/src/messages.ts apps/mobile/test/http.test.ts apps/mobile/test/feed-messages.test.ts
git commit -m "refactor(mobile): satu klien HTTP bersama, plus klien feed"
```

---

## Task 14: Mobile — layar feed dan tulis

**Files:**
- Create: `apps/mobile/app/feed/index.tsx`, `apps/mobile/app/feed/new.tsx`
- Modify: `apps/mobile/app/index.tsx`, `apps/mobile/package.json`
- Test: `apps/mobile/test/feed-alasan.test.ts`

**Interfaces:**
- Consumes: `getFeed`, `postPost`, `postLike`, `postImage`, `FeedPost` (Task 13); `postTypedData`, `likeTypedData`, `lampirGambarTypedData`, `makePostId` (Task 1); `createDevSigner`, `CONFIG`.
- Produces: `alasanMuncul(hop, displayName)` — diekspor dari `apps/mobile/src/messages.ts` supaya bisa diuji tanpa merender.

**Aturan mengikat.** Setiap kartu **wajib** menyebut alasan ia muncul (spec §10.3). Ini bukan hiasan: spec induk §8 memegang prinsip bahwa peringkat tidak pernah tampil telanjang, selalu bersama buktinya.

**Kontrak penandatanganan.** Domain feed memakai `CONFIG.verifyingContract` (ConnectionRegistry), **bukan** `CONFIG.attendanceRegistry` yang dipakai layar acara.

- [ ] **Step 1: Pasang pemilih gambar**

```bash
pnpm --filter @nearly/mobile add expo-image-picker
```

Tambahkan `"expo-image-picker"` ke array `plugins` di `apps/mobile/app.json`.

- [ ] **Step 2: Tulis tes yang gagal**

`apps/mobile/test/feed-alasan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { alasanMuncul } from "../src/messages";

describe("alasanMuncul", () => {
  it("1 lompatan menyebut pertemuan langsung", () => {
    expect(alasanMuncul(1, "Andi")).toContain("Andi");
    expect(alasanMuncul(1, "Andi").toLowerCase()).toContain("bertemu");
  });

  it("2 lompatan menyebut perantara tanpa mengaku kamu bertemu dia", () => {
    const pesan = alasanMuncul(2, "Andi");
    expect(pesan.toLowerCase()).toContain("kenalan");
  });

  it("luar jaringan dinyatakan apa adanya", () => {
    expect(alasanMuncul(null, "Andi").toLowerCase()).toContain("luar jaringan");
  });

  // Nama kosong wajar: profil tidak mewajibkan nama, alamat-lah identitasnya.
  it("tidak menghasilkan kalimat rusak saat nama kosong", () => {
    for (const hop of [1, 2, null] as const) {
      const pesan = alasanMuncul(hop, "");
      expect(pesan.trim().length).toBeGreaterThan(5);
      expect(pesan).not.toContain("  ");
    }
  });
});
```

- [ ] **Step 3: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile test feed-alasan`
Expected: FAIL — `alasanMuncul is not exported`

- [ ] **Step 4: Tambahkan `alasanMuncul` di `apps/mobile/src/messages.ts`**

```ts
/**
 * Baris alasan di setiap kartu feed (spec §10.3). Spec induk §8 memegang
 * prinsip bahwa peringkat tidak pernah tampil telanjang — selalu bersama
 * buktinya. Feed yang tidak bisa menjelaskan dirinya melanggar prinsip itu.
 */
export function alasanMuncul(hop: 1 | 2 | null, displayName: string): string {
  const nama = displayName.trim() || "orang ini";
  if (hop === 1) return `Kamu pernah bertemu ${nama}.`;
  if (hop === 2) return `Kenalanmu pernah bertemu ${nama}.`;
  return "Di luar jaringanmu.";
}
```

- [ ] **Step 5: Buat `apps/mobile/app/feed/index.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import {
  ActivityIndicator, Button, FlatList, Image, Pressable, StyleSheet, Text, View,
} from "react-native";
import type { Hex } from "viem";
import { likeTypedData } from "@nearly/shared";
import { CONFIG } from "../../src/config";
import { createDevSigner } from "../../src/signer";
import { ApiError } from "../../src/http";
import { getFeed, postLike, type FeedPost } from "../../src/feed-api";
import { alasanMuncul, feedErrorMessage } from "../../src/messages";

export default function FeedScreen() {
  const signer = useMemo(
    // Domain feed terikat ke ConnectionRegistry, BUKAN AttendanceRegistry.
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);

  const muat = useCallback(async () => {
    try {
      const { posts } = await getFeed(signer.address);
      setPosts(posts);
      setPesan(null);
    } catch (e) {
      setPosts([]);
      setPesan(e instanceof ApiError ? feedErrorMessage(e.code) : "Feed gagal dimuat.");
    }
  }, [signer.address]);

  useEffect(() => { void muat(); }, [muat]);
  useFocusEffect(useCallback(() => { void muat(); }, [muat]));

  async function suka(p: FeedPost) {
    const berikutnya = !p.sudahSuka;
    try {
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 300);
      const sig = await signer.signTypedData(likeTypedData(
        { postId: p.postId, who: signer.address, suka: berikutnya, expiresAt },
        CONFIG.verifyingContract,
      ));
      await postLike(p.postId, {
        postId: p.postId, who: signer.address, suka: berikutnya,
        expiresAt: expiresAt.toString(), sig,
      });
      // Muat ulang dari server, bukan menebak di klien: jumlah suka milik
      // server, dan menebaknya membuat layar berbohong soal keadaan nyata.
      await muat();
    } catch (e) {
      setPesan(e instanceof ApiError ? feedErrorMessage(e.code) : "Gagal menyukai.");
    }
  }

  if (posts === null) return <ActivityIndicator style={s.tengah} />;

  return (
    <View style={s.root}>
      <Link href="/feed/new" style={s.tulis}>Tulis sesuatu</Link>
      {pesan && <Text style={s.pesan}>{pesan}</Text>}
      <FlatList
        data={posts}
        keyExtractor={(p) => p.postId}
        ListEmptyComponent={<Text style={s.kosong}>Belum ada unggahan.</Text>}
        renderItem={({ item: p }) => (
          <View style={s.kartu}>
            <Text style={s.nama}>{p.displayName.trim() || p.author}</Text>
            {/* Spec §10.3 — kartu harus menjelaskan kenapa ia muncul. */}
            <Text style={s.alasan}>{alasanMuncul(p.hop, p.displayName)}</Text>
            <Text style={s.isi}>{p.body}</Text>
            {p.imageStatus === "ready" && p.imageUrl
              ? <Image source={{ uri: p.imageUrl }} style={s.gambar} resizeMode="cover" />
              : null}
            {p.imageStatus === "pending"
              ? <Text style={s.catatan}>Gambar sedang diunggah…</Text> : null}
            {p.imageStatus === "failed"
              ? <Text style={s.catatan}>Gambar gagal diunggah.</Text> : null}
            <Pressable onPress={() => void suka(p)} hitSlop={8}>
              <Text style={s.suka}>{p.sudahSuka ? "♥" : "♡"} {p.likeCount}</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  tengah: { flex: 1 },
  tulis: { fontSize: 17, paddingVertical: 8 },
  pesan: { fontSize: 14, opacity: 0.8 },
  kosong: { fontSize: 15, opacity: 0.6, paddingVertical: 24 },
  kartu: { paddingVertical: 14, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  nama: { fontSize: 15, fontWeight: "600" },
  alasan: { fontSize: 12, opacity: 0.6 },
  isi: { fontSize: 15, lineHeight: 21 },
  gambar: { width: "100%", height: 200, borderRadius: 12 },
  catatan: { fontSize: 12, opacity: 0.6, fontStyle: "italic" },
  suka: { fontSize: 15, paddingTop: 4 },
});
```

- [ ] **Step 6: Buat `apps/mobile/app/feed/new.tsx`**

```tsx
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Button, Image, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { lampirGambarTypedData, makePostId, postTypedData } from "@nearly/shared";
import { CONFIG } from "../../src/config";
import { createDevSigner } from "../../src/signer";
import { ApiError } from "../../src/http";
import { postImage, postPost } from "../../src/feed-api";
import { feedErrorMessage } from "../../src/messages";

const MAKS = 500;

export default function TulisScreen() {
  const router = useRouter();
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [teks, setTeks] = useState("");
  const [gambar, setGambar] = useState<{ uri: string; base64: string; mime: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  async function pilihGambar() {
    const izin = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!izin.granted) {
      setPesan("Nearly butuh izin galeri untuk melampirkan gambar.");
      return;
    }
    const hasil = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], base64: true, quality: 0.7,
    });
    const aset = hasil.assets?.[0];
    if (hasil.canceled || !aset?.base64) return;
    const mime = aset.mimeType === "image/png" ? "image/png" : "image/jpeg";
    setGambar({ uri: aset.uri, base64: aset.base64, mime });
  }

  async function kirim() {
    if (sibuk) return;
    setSibuk(true);
    setPesan(null);
    try {
      const postId = makePostId();
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 300);
      const sig = await signer.signTypedData(postTypedData(
        { postId, author: signer.address, body: teks, expiresAt }, CONFIG.verifyingContract,
      ));
      await postPost({
        postId, author: signer.address, body: teks,
        expiresAt: expiresAt.toString(), sig,
      });

      // Gambar dikirim SETELAH teks terbit, dan kegagalannya tidak membatalkan
      // unggahan (spec §8.2). Tanda tangannya tipe LampirGambar yang terpisah.
      if (gambar) {
        try {
          const expGambar = BigInt(Math.floor(Date.now() / 1000) + 300);
          const sigGambar = await signer.signTypedData(lampirGambarTypedData(
            { postId, author: signer.address, mime: gambar.mime, expiresAt: expGambar },
            CONFIG.verifyingContract,
          ));
          await postImage(postId, {
            postId, author: signer.address, mime: gambar.mime,
            expiresAt: expGambar.toString(), sig: sigGambar, dataBase64: gambar.base64,
          });
        } catch {
          setPesan("Teks terbit, tapi gambarnya gagal dikirim. Coba lampirkan lagi nanti.");
        }
      }
      router.replace("/feed");
    } catch (e) {
      setPesan(e instanceof ApiError ? feedErrorMessage(e.code) : "Gagal mengunggah.");
    } finally {
      setSibuk(false);
    }
  }

  const sisa = MAKS - teks.length;

  return (
    <View style={s.root}>
      <TextInput
        style={s.input}
        multiline
        maxLength={MAKS}
        placeholder="Apa yang lagi kamu bangun?"
        value={teks}
        onChangeText={setTeks}
      />
      <Text style={s.hitung}>{sisa} karakter tersisa</Text>
      {gambar && <Image source={{ uri: gambar.uri }} style={s.pratinjau} resizeMode="cover" />}
      <Button title={gambar ? "Ganti gambar" : "Tambah gambar"} onPress={() => void pilihGambar()} />
      <Button
        title={sibuk ? "Mengirim…" : "Unggah"}
        onPress={() => void kirim()}
        disabled={sibuk || teks.trim().length === 0}
      />
      {pesan && <Text style={s.pesan}>{pesan}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  input: { minHeight: 120, fontSize: 16, lineHeight: 22, textAlignVertical: "top" },
  hitung: { fontSize: 12, opacity: 0.6 },
  pratinjau: { width: "100%", height: 180, borderRadius: 12 },
  pesan: { fontSize: 14, opacity: 0.8 },
});
```

- [ ] **Step 7: Tambahkan tautan di beranda**

Di `apps/mobile/app/index.tsx`, setelah baris `<Link href="/events" style={s.link}>Acara</Link>`:

```tsx
      <Link href="/feed" style={s.link}>Feed</Link>
```

- [ ] **Step 8: Jalankan tes dan typecheck**

Run: `pnpm --filter @nearly/mobile test && pnpm --filter @nearly/mobile typecheck`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/app/feed apps/mobile/app/index.tsx apps/mobile/src/messages.ts apps/mobile/test/feed-alasan.test.ts apps/mobile/package.json apps/mobile/app.json pnpm-lock.yaml
git commit -m "feat(mobile): layar feed dan tulis unggahan"
```

---

## Task 15: Perbaiki spec induk, terapkan migrasi, verifikasi lapangan

**Files:**
- Modify: `docs/superpowers/specs/2026-09-03-nearly-design.md`
- Apply: `supabase/migrations/0004_feed.sql`

**Catatan untuk controller.** Bagian deploy dan verifikasi lapangan **berhenti di pemilik project**: ia membelanjakan dana di chain Greenfield, menyentuh Supabase produksi, dan butuh perangkat fisik. Kerjakan Step 1–2, lalu serahkan Step 3 ke atas.

- [ ] **Step 1: Perbaiki kalimat urutan fase di spec induk**

Di `docs/superpowers/specs/2026-09-03-nearly-design.md` §11, entri **Fase 5 — FYP** menulis bahwa tombol ingin bertemu di kartu feed *"mekaniknya sudah ada dari Fase 3"*. Itu kini terbalik. Ganti kalimat tersebut menjadi:

> tombol "Ingin bertemu" di kartu feed (mekaniknya menyusul di Fase 3c — feed
> dikerjakan lebih dulu justru karena penanda itu butuh permukaan berisi orang
> yang belum kamu temui)

Tambahkan juga satu baris di akhir daftar fase:

> **Catatan urutan (2026-09-07).** Fase 3 dipecah menjadi 3a (event & kehadiran, tuntas),
> 3b (feed, dokumen `2026-09-07-nearly-fase-3b-feed-design.md`), dan 3c ("ingin bertemu",
> menyusul). Feed didahulukan dari "ingin bertemu" karena penanda itu tidak punya permukaan
> untuk hidup sampai feed ada.

- [ ] **Step 2: Jalankan seluruh suite dan buktikan batas global**

```bash
pnpm -r test
pnpm -r typecheck
git diff --stat main..HEAD -- packages/trust
```

Expected: seluruh tes hijau, typecheck bersih, dan **diff `packages/trust` KOSONG**.

Run: `grep -rn "trust_snapshots" apps/api/src/feed-store.ts | grep -i "insert\|update\|upsert\|delete"`
Expected: tidak ada hasil — feed hanya MEMBACA `trust_snapshots` (spec §13.5).

- [ ] **Step 3: Commit, lalu serahkan sisanya ke pemilik project**

```bash
git add docs/superpowers/specs/2026-09-03-nearly-design.md
git commit -m "docs: perbaiki urutan fase di spec induk setelah feed didahulukan"
```

Sisanya **dikerjakan pemilik project**, dan controller berhenti di sini:

1. **Danai akun Greenfield.** Alamat `RELAYER_PRIVATE_KEY` harus punya saldo di **chain Greenfield** (chain id 5600) — terpisah dari tBNB BSC testnet. Lewat faucet Greenfield atau jembatan BSC↔Greenfield.
2. **Buat bucket sekali**, `visibility: PUBLIC_READ`, lalu isi `GREENFIELD_BUCKET` dan `GREENFIELD_SP_ENDPOINT` di `.env`.
3. **Terapkan `supabase/migrations/0004_feed.sql`** lewat Supabase SQL Editor.
4. **Uji jalur lengkap** dari dua perangkat:
   - A menulis unggahan teks → muncul di feed B
   - Kartu di perangkat B menyebut alasan yang benar (`Kamu pernah bertemu…` kalau A dan B pernah handshake)
   - B menyukai → angka naik; membatalkan → angka turun
   - A melampirkan gambar → status `pending` terlihat, lalu gambarnya muncul
   - Buka URL `<sp-endpoint>/view/<bucket>/<object>` di peramban → gambarnya tampil
   - A menghapus unggahannya → hilang dari feed B
   - **Matikan `GREENFIELD_SP_ENDPOINT` sementara** lalu unggah bergambar → teks tetap terbit dan status jadi `failed`. Ini pembuktian langsung spec §8.2: Greenfield mati tidak mematikan feed.

Setelah lolos, `superpowers:finishing-a-development-branch` memutuskan integrasi ke `main`.

---
