# Fase 4a — Blokir Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun blokir dua arah yang bisa dipasang ke siapa pun termasuk orang asing, memutus jangkauan di feed dan penanda, menghentikan trust mengalir lewat koneksi terblokir, dan bisa dicabut dari sebuah daftar.

**Architecture:** Blokir hidup di tabel `blocks` tersendiri dengan arah eksplisit `(blocker, blocked)`. `packages/trust` SUDAH membuang edge terblokir dan tidak disentuh sama sekali — sambungannya cuma satu titik, `rowsToGraph` yang berhenti menulis `blocked: false` keras. Feed dan penanda menyaring lewat himpunan blokir yang dimuat pemanggil, bukan lewat kebergantungan antar-store.

**Tech Stack:** pnpm monorepo · TypeScript strict · Hono · Supabase (service role) · viem (EIP-712) · Zod · Vitest · Expo Router / React Native

**Spec:** `docs/superpowers/specs/2026-09-08-nearly-fase-4a-blokir-design.md`

## Global Constraints

- **`packages/trust` TIDAK BOLEH DISENTUH.** Dibuktikan `git diff --stat <base>..HEAD -- packages/trust` kosong (spec §4).
- **Tidak ada bagian fase ini yang menyentuh blockchain** — tanpa kontrak, transaksi, maupun relayer baru (spec §2).
- **Kedua tipe EIP-712 baru tidak boleh punya pasangan typehash di Solidity mana pun** (spec §6).
- Setelah fase ini aplikasi punya **dua puluh satu** tipe EIP-712, dan tidak satu pun boleh bertabrakan (spec §6.1).
- Domain EIP-712: `{ name: "Nearly", version: "1", chainId: 97, verifyingContract: <ConnectionRegistry> }`.
- **Blokir dua arah** — memutus jangkauan ke dua arah di permukaan yang Nearly kendalikan (spec §2.2).
- **Blokir bisa dicabut**, dan tanda "ingin bertemu" dari KEDUA arah kembali dihitung (spec §5.2).
- **Handshake saat terblokir TETAP BERHASIL** — sengaja tidak diubah (spec §5.4).
- **Gerbang lapor tidak disentuh sama sekali** (spec §5.5).
- **Memblokir diri sendiri ditolak di gerbang**, dan CHECK basis data adalah lapis terakhir — TIDAK ada pemeriksaan ketiga di skema Zod (spec §7.1).
- `GET /blokir` **menolak 403** tanpa bukti sah — bukan daftar kosong (spec §7).
- **Setiap pemulihan tanda tangan lewat `pulihkanTandaTangan`** — penjaga struktural di `apps/api/test/sig-rusak.test.ts` menegakkannya otomatis.
- RLS menyala di tabel baru, **tanpa policy**.
- Semua teks yang terlihat pengguna berbahasa Indonesia.

---

## Struktur Berkas

| Berkas | Tanggung jawab |
|---|---|
| `packages/shared/src/blokir.ts` | Dua tipe EIP-712 + typed data + recover |
| `packages/shared/src/index.ts` (ubah) | Ekspor `./blokir` |
| `packages/shared/src/schema.ts` (ubah) | `BlokirRequestSchema` |
| `packages/shared/test/typehash-semua.test.ts` (ubah) | 19 → 21 |
| `supabase/migrations/0006_blokir.sql` | Tabel `blocks` |
| `apps/api/src/ports.ts` (ubah) | `BlokirStore`, `BlokirDeps`, `METODE_BLOKIR_STORE`; parameter `kecuali` di `MeetStore` |
| `apps/api/src/blokir-store.ts` | Akses Supabase untuk `blocks` |
| `apps/api/src/blokir-gate.ts` | Gerbang pasang/cabut + daftar |
| `apps/api/src/routes/blokir.ts` | Dua endpoint |
| `apps/api/src/trust/load-graph.ts` (ubah) | `blocks` → `edge.blocked` |
| `apps/api/src/trust/store.ts` (ubah) | Ambil baris `blocks` |
| `apps/api/src/feed-store.ts` (ubah) | Saring kandidat + `petaHop` membuang edge terblokir |
| `apps/api/src/meet-store.ts` (ubah) | Empat metode baca menerima `kecuali` |
| `apps/api/src/routes/profile.ts` (ubah) | Angka & bendera memperhitungkan blokir |
| `apps/api/src/app.ts`, `index.ts` (ubah) | Perakitan |
| `apps/mobile/src/blokir-api.ts` | Pembangun bukti baca + pembacaan daftar |
| `apps/mobile/src/blokir-actions.ts` | **Satu-satunya tempat `Blokir` ditandatangani** |
| `apps/mobile/src/messages.ts` (ubah) | `blokirErrorMessage` + teks tombol |
| `apps/mobile/app/blokir.tsx` | Layar daftar blokir |
| `apps/mobile/app/index.tsx` (ubah) | Tautan berlencana ke daftar |
| `apps/mobile/app/profile/[address].tsx` (ubah) | Tombol blokir + tanda |
| `docs/superpowers/specs/2026-09-03-nearly-design.md` (ubah) | Perbaiki §14.6 yang basi |

---
## Task 1: Dua tipe EIP-712 blokir

**Files:**
- Create: `packages/shared/src/blokir.ts`
- Modify: `packages/shared/src/index.ts`, `packages/shared/test/typehash-semua.test.ts`
- Test: `packages/shared/test/blokir.test.ts`

**Interfaces:**
- Consumes: `NEARLY_CHAIN_ID` dari `packages/shared/src/handshake.ts`.
- Produces:
  - `type BlokirMessage = { target: Address; who: Address; blokir: boolean; expiresAt: bigint }`
  - `type LihatBlokirMessage = { who: Address; expiresAt: bigint }`
  - `blokirTypedData`, `lihatBlokirTypedData`
  - `recoverBlokirSigner`, `recoverLihatBlokirSigner`
  - `BLOKIR_TYPES`

**`LihatBlokir` adalah tipe KETIGA berbentuk `{ who, expiresAt }`**, bersama `LihatKecocokan` dan `TandaiDilihat`. Ketiganya identik bentuknya dan hanya nama tipenya yang memisahkan bukti baca dari perintah tulis. Jangan pernah menggabungkannya — lihat spec §6.1.

- [ ] **Step 1: Tulis tes yang gagal**

`packages/shared/test/blokir.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  blokirTypedData, lihatBlokirTypedData,
  recoverBlokirSigner, recoverLihatBlokirSigner,
} from "../src/blokir";
import { lihatKecocokanTypedData, tandaiDilihatTypedData } from "../src/meet";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = "0x000000000000000000000000000000000000beef" as Address;
const KONTRAK = "0x00000000000000000000000000000000000c0de0" as Address;
const EXP = 1_800_000_000n;

describe("Blokir", () => {
  it("memulihkan penanda tangan yang benar", async () => {
    const msg = { target: B, who: A.address as Address, blokir: true, expiresAt: EXP };
    const sig = await A.signTypedData(blokirTypedData(msg, KONTRAK));
    expect((await recoverBlokirSigner(msg, sig, KONTRAK)).toLowerCase())
      .toBe(A.address.toLowerCase());
  });

  // `blokir` ikut ditandatangani supaya PENCABUTAN juga terbukti. Tanpa ini
  // siapa pun bisa mencabut blokir orang lain lewat badan permintaan.
  it("membalik `blokir` membatalkan tanda tangan", async () => {
    const msg = { target: B, who: A.address as Address, blokir: true, expiresAt: EXP };
    const sig = await A.signTypedData(blokirTypedData(msg, KONTRAK));
    const dibalik = { ...msg, blokir: false };
    expect((await recoverBlokirSigner(dibalik, sig, KONTRAK)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });

  it("domain terikat ke kontrak — kontrak lain tidak memulihkan penanda tangan", async () => {
    const msg = { target: B, who: A.address as Address, blokir: true, expiresAt: EXP };
    const sig = await A.signTypedData(blokirTypedData(msg, KONTRAK));
    const lain = "0x00000000000000000000000000000000000c0de1" as Address;
    expect((await recoverBlokirSigner(msg, sig, lain)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });
});

describe("LihatBlokir vs dua tipe sebentuk lainnya", () => {
  const msg = { who: A.address as Address, expiresAt: EXP };

  it("memulihkan penanda tangan yang benar", async () => {
    const sig = await A.signTypedData(lihatBlokirTypedData(msg, KONTRAK));
    expect((await recoverLihatBlokirSigner(msg, sig, KONTRAK)).toLowerCase())
      .toBe(A.address.toLowerCase());
  });

  // Ketiganya berbentuk { who, expiresAt }. Hanya nama tipenya yang berbeda,
  // dan itulah satu-satunya hal yang membuat digest-nya berbeda.
  it("tanda tangan LihatKecocokan TIDAK sah sebagai LihatBlokir", async () => {
    const sig = await A.signTypedData(lihatKecocokanTypedData(msg, KONTRAK));
    expect((await recoverLihatBlokirSigner(msg, sig, KONTRAK)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });

  it("tanda tangan TandaiDilihat TIDAK sah sebagai LihatBlokir", async () => {
    const sig = await A.signTypedData(tandaiDilihatTypedData(msg, KONTRAK));
    expect((await recoverLihatBlokirSigner(msg, sig, KONTRAK)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });

  it("tanda tangan LihatBlokir TIDAK sah sebagai LihatKecocokan — arah sebaliknya", async () => {
    const { recoverLihatKecocokanSigner } = await import("../src/meet");
    const sig = await A.signTypedData(lihatBlokirTypedData(msg, KONTRAK));
    expect((await recoverLihatKecocokanSigner(msg, sig, KONTRAK)).toLowerCase())
      .not.toBe(A.address.toLowerCase());
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/shared test blokir`
Expected: FAIL — `Cannot find module '../src/blokir'`

- [ ] **Step 3: Buat `packages/shared/src/blokir.ts`**

```ts
import { recoverTypedDataAddress, type Address, type Hex } from "viem";
import { NEARLY_CHAIN_ID } from "./handshake";

/**
 * Perintah TULIS: memblokir seseorang, atau mencabut blokir itu.
 *
 * `blokir` sengaja bool, bukan dua tipe terpisah — polanya sama dengan
 * `InginBertemu`. Dengan begini PENCABUTAN ikut ditandatangani; tanpa itu
 * siapa pun bisa mencabut blokir orang lain lewat badan permintaan, dan
 * mencabut blokir orang lain adalah persis serangan yang blokir ada untuk
 * mencegah.
 *
 * TIDAK PERNAH naik on-chain (spec §2). Blokir itu privat; koneksinya yang
 * publik on-chain, dan itu memang fakta pertemuan yang tidak disembunyikan.
 */
export type BlokirMessage = {
  target: Address;
  who: Address;
  blokir: boolean;
  expiresAt: bigint;
};

/**
 * Bukti BACA untuk daftar blokir sendiri.
 *
 * Bentuk fieldnya IDENTIK dengan `LihatKecocokan` dan `TandaiDilihat` di
 * `meet.ts`, dan itu disengaja. Ketiganya `{ who, expiresAt }`; hanya nama
 * tipenya yang memisahkan bukti BACA dari perintah TULIS.
 *
 * JANGAN menggabungkan ketiganya karena terlihat mubazir. Kalau bukti baca
 * sah sebagai perintah tulis, tanda tangan yang bocor lewat query string bisa
 * dipakai mengubah keadaan orang lain — di sini: mencabut blokir mereka.
 */
export type LihatBlokirMessage = {
  who: Address;
  expiresAt: bigint;
};

const TYPES = {
  Blokir: [
    { name: "target", type: "address" },
    { name: "who", type: "address" },
    { name: "blokir", type: "bool" },
    { name: "expiresAt", type: "uint64" },
  ],
  LihatBlokir: [
    { name: "who", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const BLOKIR_TYPES = TYPES;

function domain(verifyingContract: Address) {
  return { name: "Nearly", version: "1", chainId: NEARLY_CHAIN_ID, verifyingContract } as const;
}

export function blokirTypedData(msg: BlokirMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { Blokir: TYPES.Blokir },
    primaryType: "Blokir",
    message: msg,
  } as const;
}

export function lihatBlokirTypedData(msg: LihatBlokirMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { LihatBlokir: TYPES.LihatBlokir },
    primaryType: "LihatBlokir",
    message: msg,
  } as const;
}

export function recoverBlokirSigner(
  msg: BlokirMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...blokirTypedData(msg, verifyingContract), signature });
}

export function recoverLihatBlokirSigner(
  msg: LihatBlokirMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...lihatBlokirTypedData(msg, verifyingContract), signature });
}
```

- [ ] **Step 4: Ekspor dari `packages/shared/src/index.ts`**

Tambahkan satu baris di akhir daftar ekspor:

```ts
export * from "./blokir";
```

- [ ] **Step 5: Perbarui penjaga typehash**

`packages/shared/test/typehash-semua.test.ts` — empat perubahan:

```ts
// 1. tambah impor
import { BLOKIR_TYPES } from "../src/blokir";

// 2. sebarkan ke SEMUA
const SEMUA: Record<string, readonly Field[]> = {
  ...HANDSHAKE_TYPES, ...VOUCH_TYPES, ...EVENT_TYPES, ...FEED_TYPES, ...MEET_TYPES,
  ...BLOKIR_TYPES,
};

// 3. naikkan jumlahnya
const JUMLAH_TIPE = 21;

// 4. tambahkan BLOKIR_TYPES ke penjumlahan per-keluarga di tes pertama
const total = Object.keys(HANDSHAKE_TYPES).length + Object.keys(VOUCH_TYPES).length
  + Object.keys(EVENT_TYPES).length + Object.keys(FEED_TYPES).length
  + Object.keys(MEET_TYPES).length + Object.keys(BLOKIR_TYPES).length;
```

Ganti judul tes `"kesembilan belas encodeType unik"` menjadi `"kedua puluh satu encodeType unik"`.

Tambahkan blok baru setelah tes `"encodeType meet persis seperti spec §5"`:

```ts
  it("tidak ada typehash blokir di Solidity mana pun", () => {
    const berkasSol = readdirSync(SOL_DIR).filter((f) => f.endsWith(".sol"));
    expect(berkasSol.length).toBeGreaterThan(0);
    for (const berkas of berkasSol) {
      const sumber = readFileSync(`${SOL_DIR}${berkas}`, "utf8");
      for (const nama of Object.keys(BLOKIR_TYPES)) {
        expect(sumber).not.toContain(`${nama}(`);
      }
    }
  });

  it("encodeType blokir persis seperti spec §6", () => {
    expect(encodeType("Blokir", BLOKIR_TYPES.Blokir))
      .toBe("Blokir(address target,address who,bool blokir,uint64 expiresAt)");
    expect(encodeType("LihatBlokir", BLOKIR_TYPES.LihatBlokir))
      .toBe("LihatBlokir(address who,uint64 expiresAt)");
  });
```

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/shared test`
Expected: PASS, termasuk `typehash-semua` dengan 21 tipe.

- [ ] **Step 7: Buktikan penjaga tabrakan masih menggigit**

Dua mutasi, jalankan sungguhan dan kembalikan masing-masing. Jangan commit versi yang bermutasi.

**Mutasi A — jalur pertumbuhan.** Tambahkan sementara tipe dengan nama yang BELUM ADA di keenam keluarga (periksa dulu dengan grep). Harapkan: jumlah per-keluarga naik 21→22 DAN `SEMUA` naik 21→22.

**Mutasi B — jalur tabrakan.** Jangan tambah apa pun. Ganti NAMA `BLOKIR_TYPES.LihatBlokir` menjadi `LihatKecocokan`, yang sudah dipakai `MEET_TYPES`. Harapkan: jumlah per-keluarga tetap 21 sehingga asersi jumlah HIJAU, sementara `Object.keys(SEMUA)` turun ke 20 sehingga asersi SEMUA yang MERAH. Inilah jalur yang membuktikan penjaga tabrakan nama benar-benar bekerja.

- [ ] **Step 8: Commit**

```bash
git add packages/shared/src/blokir.ts packages/shared/src/index.ts \
  packages/shared/test/blokir.test.ts packages/shared/test/typehash-semua.test.ts
git commit -m "feat(shared): dua tipe EIP-712 blokir"
```

---

## Task 2: Skema Zod permintaan blokir

**Files:**
- Modify: `packages/shared/src/schema.ts`
- Test: `packages/shared/test/schema-blokir.test.ts`

**Interfaces:**
- Consumes: helper privat `address`, `signature`, `unixSeconds` yang SUDAH ADA di `schema.ts`.
- Produces: `BlokirRequestSchema`.

`GET /blokir` tidak punya skema badan — parameternya di query string dan divalidasi di rute (Task 7).

- [ ] **Step 1: Tulis tes yang gagal**

`packages/shared/test/schema-blokir.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BlokirRequestSchema } from "../src/schema";

const dasar = {
  target: "0x000000000000000000000000000000000000beef",
  who: "0x000000000000000000000000000000000000cafe",
  blokir: true,
  expiresAt: "1800000000",
  sig: `0x${"11".repeat(65)}`,
};

describe("BlokirRequestSchema", () => {
  it("menerima badan yang sah", () => {
    expect(BlokirRequestSchema.safeParse(dasar).success).toBe(true);
  });

  // Tipe EIP-712-nya `bool`. String "true" menghasilkan digest berbeda tanpa
  // suara, jadi harus ditolak di sini, bukan ditemukan sebagai tanda tangan
  // yang misterius tidak cocok.
  it("menolak `blokir` berupa string", () => {
    expect(BlokirRequestSchema.safeParse({ ...dasar, blokir: "true" }).success).toBe(false);
  });

  // Penolakan memblokir diri sendiri hidup di GERBANG, bukan di sini
  // (spec §7.1). Kalau skema ikut menolaknya, pemeriksaan gerbang tidak
  // pernah terjangkau lewat rute dan menjadi kode mati.
  it("MENERIMA target sama dengan who — penolakannya tugas gerbang", () => {
    expect(BlokirRequestSchema.safeParse({ ...dasar, target: dasar.who }).success).toBe(true);
  });

  it("menolak alamat yang bukan heksadesimal 40 digit", () => {
    expect(BlokirRequestSchema.safeParse({ ...dasar, target: "0xbukan" }).success).toBe(false);
  });

  // safeParse TIDAK BOLEH melempar untuk apa pun. Fase 3a pernah kebobolan:
  // `.refine` yang memanggil BigInt() atas string non-angka melempar
  // SyntaxError yang lolos dari safeParse dan berakhir 500, bukan 400.
  it("expiresAt non-angka gagal bersih, tanpa melempar", () => {
    expect(() => BlokirRequestSchema.safeParse({ ...dasar, expiresAt: "besok" }))
      .not.toThrow();
    expect(BlokirRequestSchema.safeParse({ ...dasar, expiresAt: "besok" }).success).toBe(false);
  });

  it("menolak tanda tangan yang panjangnya salah", () => {
    expect(BlokirRequestSchema.safeParse({ ...dasar, sig: `0x${"11".repeat(64)}` }).success)
      .toBe(false);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/shared test schema-blokir`
Expected: FAIL — `BlokirRequestSchema is not exported`

- [ ] **Step 3: Tambahkan skema di akhir `packages/shared/src/schema.ts`**

```ts
/**
 * `target` boleh sama dengan `who`. Penolakan memblokir diri sendiri hidup di
 * gerbang (spec §7.1), bukan di sini — kalau skema ikut menolaknya,
 * pemeriksaan gerbang tidak akan pernah terjangkau lewat rute dan membusuk
 * jadi kode mati yang tidak ada tesnya bisa menjangkau.
 */
export const BlokirRequestSchema = z.object({
  target: address,
  who: address,
  // Wajib boolean asli: tipe EIP-712-nya `bool`, dan "true" berupa string
  // menghasilkan digest berbeda tanpa suara.
  blokir: z.boolean(),
  expiresAt: unixSeconds,
  sig: signature,
});
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/shared test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/schema.ts packages/shared/test/schema-blokir.test.ts
git commit -m "feat(shared): skema Zod permintaan blokir"
```

---
## Task 3: Migrasi `0006_blokir.sql`

**Files:**
- Create: `supabase/migrations/0006_blokir.sql`

**Interfaces:**
- Produces: tabel `blocks`, dipakai Task 5, 8, 9, 10.

- [ ] **Step 1: Buat berkasnya**

```sql
-- Fase 4a: blokir. Tabel TERSENDIRI, bukan kolom di `connections`, karena dua
-- alasan yang sama-sama memaksa (spec §2.1):
--
--   1. Orang asing bisa diblokir. `connections` menurut definisi hanya memuat
--      orang yang pernah ditemui; orang yang menandaimu dari feed tidak punya
--      baris di sana.
--   2. `connections` tidak bisa menyimpan arah. Skemanya `check (addr_a <
--      addr_b)` dengan satu baris per pasangan, jadi satu boolean di sana
--      tidak bisa membedakan "A memblokir B" dari "B memblokir A".
create table if not exists blocks (
  -- Huruf kecil SAJA. Fase 3b pernah kebobolan di sini: regex
  -- case-insensitive di kolom kunci membuat satu orang masuk dua kali dengan
  -- casing berbeda dan melubangi ambang tiga pelapor. Kunci di sini juga
  -- gabungan, jadi jebakannya identik.
  blocker    text not null check (blocker ~ '^0x[0-9a-f]{40}$'),
  blocked    text not null check (blocked ~ '^0x[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  -- Arah disimpan eksplisit. Trust meruntuhkannya jadi simetris (spec §4),
  -- tapi antarmuka butuh tahu siapa yang memulai supaya hanya pemblokir yang
  -- melihat tombol cabut.
  primary key (blocker, blocked),
  -- Lapis TERAKHIR, bukan pengganti pemeriksaan gerbang (spec §7.1). Ia
  -- menahan penulisan langsung ke tabel di luar jalur rute; gerbang tetap
  -- yang menolak lebih dulu dengan pesan yang bisa dibaca pengguna.
  constraint blocks_bukan_diri_sendiri check (blocker <> blocked)
);

-- Arah kedua butuh indeksnya sendiri: primary key melayani kueri "siapa yang
-- diblokir X", indeks ini melayani "siapa yang memblokir X". Blokir dua arah
-- berarti KEDUA kueri itu panas.
create index if not exists blocks_blocked_idx on blocks (blocked);

-- RLS menyala tanpa policy, seperti setiap tabel lain. API memakai service
-- role key; ketiadaan policy inilah yang menahan klien anonim.
alter table blocks enable row level security;
```

**JANGAN menambahkan foreign key ke `profiles`.** Berbeda dari `ingin_bertemu` di Fase 3c yang kedua kolomnya FK. Alasannya di spec §3: kamu bisa memblokir alamat yang belum pernah menyentuh Nearly, dan `ensureProfile` untuk orang yang mungkin tidak pernah muncul lagi hanya menumpuk baris profil kosong.

- [ ] **Step 2: Verifikasi bentuknya**

```bash
grep -c "enable row level security" supabase/migrations/0006_blokir.sql   # 1
grep -c "create policy" supabase/migrations/0006_blokir.sql               # 0
grep -c "0-9a-fA-F" supabase/migrations/0006_blokir.sql                   # 0
grep -c "references profiles" supabase/migrations/0006_blokir.sql         # 0
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0006_blokir.sql
git commit -m "feat(db): tabel blocks dengan arah eksplisit"
```

**JANGAN menerapkan migrasinya.** Pemilik project yang menerapkan migrasi (Task 14).

---

## Task 4: Port dan tipe blokir

**Files:**
- Modify: `apps/api/src/ports.ts`
- Test: `apps/api/test/blokir-ports.test.ts`

**Interfaces:**
- Produces (dipakai Task 5–10):

```ts
type BlokirStore = {
  /** Idempoten. `blokir: false` menghapus barisnya. */
  setBlokir(blocker: Address, blocked: Address, blokir: boolean): Promise<void>;
  /** Hanya arah ini: apakah `blocker` memblokir `blocked`. */
  adaBlokir(blocker: Address, blocked: Address): Promise<boolean>;
  /** Yang DIBLOKIR oleh `who`, terurut terbaru dulu. Untuk daftar & tombol cabut. */
  diblokirOleh(who: Address): Promise<BarisBlokir[]>;
  /**
   * Semua alamat yang punya hubungan blokir dengan `who` ke ARAH MANA PUN.
   * Inilah yang dipakai penyaringan: blokir dua arah tidak peduli siapa yang
   * memulai.
   */
  himpunanUntuk(who: Address): Promise<Set<string>>;
  /** Seluruh pasangan terblokir, untuk memuat graf trust sekali jalan. */
  semuaPasangan(): Promise<PasanganBlokir[]>;
};

type BarisBlokir   = { address: Address; atMs: number };
type PasanganBlokir = { blocker: string; blocked: string };
type BlokirDeps    = { blokir: BlokirStore; verifyingContract: Address; nowMs: () => number };
```

  plus parameter `kecuali` di empat metode baca `MeetStore` (Step 4).

**Kenapa `himpunanUntuk` mengembalikan Set, bukan array.** Pemanggilnya menyaring daftar — feed menyaring kandidat, meet menyaring tanda. Set membuat setiap pemeriksaan O(1); array membuat penyaringan feed jadi kuadratik terhadap jumlah kandidat.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/blokir-ports.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { METODE_BLOKIR_STORE } from "../src/ports";

/**
 * Tes bentuk, bukan perilaku. Ia ada supaya penambahan atau penghapusan
 * metode di BlokirStore menjadi tindakan sadar: setiap fake di tes gerbang
 * harus ikut diperbarui.
 *
 * Nama tes ini sengaja TIDAK menyebut jumlah metode — di Fase 3c judul
 * serupa berbunyi "sembilan metode" dan tetap berbunyi begitu setelah satu
 * metode dihapus, asersinya benar dan judulnya berbohong.
 */
describe("bentuk BlokirStore", () => {
  it("daftar metodenya persis seperti yang tercatat", () => {
    expect(METODE_BLOKIR_STORE).toEqual([
      "setBlokir", "adaBlokir", "diblokirOleh", "himpunanUntuk", "semuaPasangan",
    ]);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test blokir-ports`
Expected: FAIL — `METODE_BLOKIR_STORE is not exported`

- [ ] **Step 3: Tambahkan tipe di `apps/api/src/ports.ts`**

Taruh setelah blok `MeetDeps` yang sudah ada:

```ts
/** Satu baris di daftar blokir. */
export type BarisBlokir = { address: Address; atMs: number };

/** Satu pasangan terblokir mentah, untuk memuat graf trust sekali jalan. */
export type PasanganBlokir = { blocker: string; blocked: string };

export type BlokirStore = {
  /** Idempoten. `blokir: false` menghapus barisnya. */
  setBlokir(blocker: Address, blocked: Address, blokir: boolean): Promise<void>;
  /** Hanya arah ini: apakah `blocker` memblokir `blocked`. */
  adaBlokir(blocker: Address, blocked: Address): Promise<boolean>;
  /** Yang DIBLOKIR oleh `who`, terbaru dulu. Hanya arah ini — cuma pemblokir
   * yang boleh melihat tombol cabut. */
  diblokirOleh(who: Address): Promise<BarisBlokir[]>;
  /**
   * Semua alamat yang punya hubungan blokir dengan `who` ke ARAH MANA PUN.
   * Inilah yang dipakai penyaringan feed dan penanda: blokir dua arah tidak
   * peduli siapa yang memulai. Set, bukan array, karena pemanggilnya
   * menyaring daftar dan array membuatnya kuadratik.
   */
  himpunanUntuk(who: Address): Promise<Set<string>>;
  /** Seluruh pasangan terblokir. Dipakai loadGraph SEKALI per recompute. */
  semuaPasangan(): Promise<PasanganBlokir[]>;
};

export const METODE_BLOKIR_STORE = [
  "setBlokir", "adaBlokir", "diblokirOleh", "himpunanUntuk", "semuaPasangan",
] as const satisfies readonly (keyof BlokirStore)[];

// Arah kedua dari pengait: `satisfies` di atas menangkap nama yang salah eja
// atau dihapus; ini menangkap metode yang DITAMBAHKAN tanpa didaftarkan.
type SisaMetodeBlokirStore = Exclude<keyof BlokirStore, (typeof METODE_BLOKIR_STORE)[number]>;
type AssertNeverBlokir<T extends never> = T;
type _PastikanMetodeBlokirStoreLengkap = AssertNeverBlokir<SisaMetodeBlokirStore>;

export type BlokirDeps = {
  blokir: BlokirStore;
  /** Alamat ConnectionRegistry — domain EIP-712 blokir terikat padanya (spec §6). */
  verifyingContract: Address;
  nowMs: () => number;
};
```

- [ ] **Step 4: Tambahkan parameter `kecuali` ke empat metode baca `MeetStore`**

Di deklarasi `MeetStore` yang sudah ada, ubah empat tanda tangan ini:

```ts
  /**
   * `kecuali` adalah alamat yang tidak boleh ikut dihitung — himpunan blokir
   * pemanggil (spec §5.2). Diberikan pemanggil, bukan dibaca sendiri: store
   * ini memiliki tabel `ingin_bertemu` saja, dan store yang membaca tabel
   * orang lain adalah pola yang sudah ditolak sejak `rsvpAddresses` di
   * Fase 3c ditaruh di EventStore, bukan MeetStore.
   */
  hitungTanda(target: Address, kecuali: readonly string[]): Promise<number>;
  adaTanda(target: Address, who: Address, kecuali: readonly string[]): Promise<boolean>;
  tandaOleh(who: Address, kecuali: readonly string[]): Promise<Tanda[]>;
  tandaKe(target: Address, kecuali: readonly string[]): Promise<Tanda[]>;
```

`METODE_MEET_STORE` tidak berubah — nama metodenya sama.

- [ ] **Step 5: Jalankan typecheck dan lihat apa yang rusak**

Run: `pnpm --filter @nearly/api typecheck`
Expected: FAIL di setiap pemanggil keempat metode itu — `routes/profile.ts`, `routes/events.ts`, `meet-gate.ts`, `meet-store.ts`, dan fake di beberapa berkas tes.

**Itu memang yang diharapkan.** Typecheck yang menunjuk setiap pemanggil adalah cara paling murah menemukan semua tempat yang harus memutuskan apa yang terjadi saat ada blokir. Task 9 dan 10 yang memperbaikinya; di task ini cukup catat daftarnya.

- [ ] **Step 6: Perbaiki hanya pemanggil yang tidak menyentuh blokir**

Untuk tes-tes yang punya fake `MeetStore`, tambahkan parameter yang diabaikan supaya tipenya cocok. Contoh bentuknya:

```ts
hitungTanda: vi.fn(async (_t: Address, _kecuali: readonly string[]) => 0),
```

Jangan sentuh `routes/profile.ts`, `routes/events.ts`, `meet-gate.ts`, dan `meet-store.ts` di task ini — keempatnya milik Task 9 dan 10. Untuk sementara berikan `[]` sebagai argumen di sana supaya typecheck lewat, dengan komentar `// TODO Task 10` — **satu-satunya TODO yang boleh ada di rencana ini, dan ia hilang di Task 10.**

- [ ] **Step 7: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test && pnpm --filter @nearly/api typecheck`
Expected: PASS, typecheck bersih.

- [ ] **Step 8: Buktikan pengait dua arah menggigit**

Dua mutasi, jalankan sungguhan lalu kembalikan:

**Arah 1:** ganti `"adaBlokir"` di `METODE_BLOKIR_STORE` jadi `"adaBlokirXXX"`. Harapkan galat `TS2820` di klausa `satisfies`.

**Arah 2:** tambahkan metode `metodeBaruUjiCoba(): Promise<void>` ke antarmuka `BlokirStore` tanpa menyentuh konstanta. Harapkan `TS2344` di baris `AssertNeverBlokir`.

Kalau salah satu mutasi kompilasi bersih, pengaitnya tidak bekerja — laporkan, jangan tutupi.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/ports.ts apps/api/test/
git commit -m "feat(api): port blokir dan parameter kecuali di MeetStore"
```

---
## Task 5: `blokir-store.ts` — akses Supabase

**Files:**
- Create: `apps/api/src/blokir-store.ts`
- Test: `apps/api/test/blokir-store.test.ts`

**Interfaces:**
- Consumes: `BlokirStore`, `BarisBlokir`, `PasanganBlokir` dari Task 4; `potongKelompok` dari `apps/api/src/feed-store.ts` (sudah diekspor, `UKURAN_KELOMPOK` = 100).
- Produces: `createBlokirStore(db: SupabaseClient): BlokirStore`.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/blokir-store.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { createBlokirStore } from "../src/blokir-store";

const A = "0x00000000000000000000000000000000000000aa" as Address;
const B = "0x00000000000000000000000000000000000000bb" as Address;

/** Klien palsu yang MEREKAM panggilan, supaya bentuk kuerinya bisa diasersi. */
function dbPalsu(hasil: Record<string, unknown>[] = []) {
  const panggilan: { tabel: string; op: string; arg: unknown }[] = [];
  const rantai = (tabel: string) => ({
    select: () => rantai(tabel),
    eq: (kolom: string, nilai: unknown) => {
      panggilan.push({ tabel, op: `eq:${kolom}`, arg: nilai });
      return rantai(tabel);
    },
    or: (klausa: string) => {
      panggilan.push({ tabel, op: "or", arg: klausa });
      return rantai(tabel);
    },
    order: () => rantai(tabel),
    limit: () => rantai(tabel),
    then: (r: (v: unknown) => unknown) => r({ data: hasil, error: null }),
    upsert: (baris: unknown) => {
      panggilan.push({ tabel, op: "upsert", arg: baris });
      return { then: (r: (v: unknown) => unknown) => r({ error: null }) };
    },
    delete: () => ({
      eq: (kolom: string, nilai: unknown) => {
        panggilan.push({ tabel, op: `delete-eq:${kolom}`, arg: nilai });
        return {
          eq: (k2: string, v2: unknown) => {
            panggilan.push({ tabel, op: `delete-eq:${k2}`, arg: v2 });
            return { then: (r: (v: unknown) => unknown) => r({ error: null }) };
          },
        };
      },
    }),
  });
  return { db: { from: (t: string) => rantai(t) } as never, panggilan };
}

describe("createBlokirStore", () => {
  it("setBlokir(true) menulis baris huruf kecil", async () => {
    const { db, panggilan } = dbPalsu();
    await createBlokirStore(db).setBlokir(A, B, true);
    const up = panggilan.find((p) => p.op === "upsert");
    expect(up?.tabel).toBe("blocks");
    expect(up?.arg).toEqual({ blocker: A.toLowerCase(), blocked: B.toLowerCase() });
  });

  it("setBlokir(false) MENGHAPUS baris, bukan menulis bendera", async () => {
    const { db, panggilan } = dbPalsu();
    await createBlokirStore(db).setBlokir(A, B, false);
    expect(panggilan.some((p) => p.op.startsWith("delete-eq:blocker"))).toBe(true);
    expect(panggilan.some((p) => p.op === "upsert")).toBe(false);
  });

  // Blokir DUA ARAH: himpunan penyaring tidak peduli siapa yang memulai.
  // Kalau hanya satu arah yang dibaca, orang yang memblokirmu tetap muncul di
  // feedmu — separuh fitur ini bocor tanpa satu galat pun.
  it("himpunanUntuk membaca KEDUA arah", async () => {
    const { db, panggilan } = dbPalsu([
      { blocker: A.toLowerCase(), blocked: B.toLowerCase() },
      { blocker: "0x00000000000000000000000000000000000000cc", blocked: A.toLowerCase() },
    ]);
    const set = await createBlokirStore(db).himpunanUntuk(A);
    const klausa = panggilan.find((p) => p.op === "or")?.arg as string;
    expect(klausa).toContain("blocker.eq.");
    expect(klausa).toContain("blocked.eq.");
    // Alamat SENDIRI tidak boleh ikut masuk himpunan — kalau ikut, penonton
    // menyaring unggahannya sendiri dari feednya sendiri.
    expect(set.has(A.toLowerCase())).toBe(false);
    expect(set.has(B.toLowerCase())).toBe(true);
    expect(set.has("0x00000000000000000000000000000000000000cc")).toBe(true);
  });

  it("diblokirOleh hanya arah pemblokir", async () => {
    const { db, panggilan } = dbPalsu([
      { blocked: B.toLowerCase(), created_at: "2026-09-08T00:00:00.000Z" },
    ]);
    const baris = await createBlokirStore(db).diblokirOleh(A);
    expect(panggilan.some((p) => p.op === "eq:blocker")).toBe(true);
    expect(panggilan.some((p) => p.op === "or")).toBe(false);
    expect(baris[0]?.address).toBe(B.toLowerCase());
    expect(baris[0]?.atMs).toBe(Date.parse("2026-09-08T00:00:00.000Z"));
  });

  it("adaBlokir memeriksa tepat satu arah", async () => {
    const { db, panggilan } = dbPalsu([{ blocker: A.toLowerCase(), blocked: B.toLowerCase() }]);
    expect(await createBlokirStore(db).adaBlokir(A, B)).toBe(true);
    expect(panggilan.filter((p) => p.op.startsWith("eq:")).length).toBe(2);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test blokir-store`
Expected: FAIL — `Cannot find module '../src/blokir-store'`

- [ ] **Step 3: Buat `apps/api/src/blokir-store.ts`**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address } from "viem";
import type { BarisBlokir, BlokirStore, PasanganBlokir } from "./ports";

type BarisDb = { blocker: string; blocked: string; created_at: string };

export function createBlokirStore(db: SupabaseClient): BlokirStore {
  return {
    async setBlokir(blocker, blocked, blokir) {
      const b = blocker.toLowerCase();
      const t = blocked.toLowerCase();

      if (!blokir) {
        // Mencabut MENGHAPUS barisnya, bukan menulis bendera. Tanpa baris,
        // tidak ada keadaan "pernah diblokir" yang bisa membusuk — dan tanda
        // "ingin bertemu" yang tertekan kembali dihitung dengan sendirinya
        // karena penyaringnya membaca tabel ini (spec §5.2).
        const { error } = await db.from("blocks").delete()
          .eq("blocker", b).eq("blocked", t);
        if (error) throw new Error(`cabut blokir gagal: ${error.message}`);
        return;
      }

      const { error } = await db.from("blocks")
        .upsert({ blocker: b, blocked: t }, { onConflict: "blocker,blocked", ignoreDuplicates: true });
      if (error) throw new Error(`pasang blokir gagal: ${error.message}`);
    },

    async adaBlokir(blocker, blocked) {
      const { data, error } = await db.from("blocks").select("blocker")
        .eq("blocker", blocker.toLowerCase()).eq("blocked", blocked.toLowerCase());
      if (error) throw new Error(`baca blokir gagal: ${error.message}`);
      return (data ?? []).length > 0;
    },

    async diblokirOleh(who) {
      const { data, error } = await db.from("blocks").select("blocked, created_at")
        .eq("blocker", who.toLowerCase())
        .order("created_at", { ascending: false });
      if (error) throw new Error(`baca daftar blokir gagal: ${error.message}`);
      return ((data ?? []) as Pick<BarisDb, "blocked" | "created_at">[])
        .map((r): BarisBlokir => ({
          address: r.blocked as Address,
          atMs: Date.parse(r.created_at),
        }));
    },

    async himpunanUntuk(who) {
      const a = who.toLowerCase();
      // KEDUA arah. Blokir dua arah tidak peduli siapa yang memulai; membaca
      // satu arah saja membuat orang yang memblokirmu tetap muncul di feedmu.
      const { data, error } = await db.from("blocks").select("blocker, blocked")
        .or(`blocker.eq.${a},blocked.eq.${a}`);
      if (error) throw new Error(`baca himpunan blokir gagal: ${error.message}`);

      const keluar = new Set<string>();
      for (const r of (data ?? []) as Pick<BarisDb, "blocker" | "blocked">[]) {
        const lain = r.blocker.toLowerCase() === a ? r.blocked.toLowerCase() : r.blocker.toLowerCase();
        // Alamat sendiri tidak pernah masuk. CHECK basis data sudah membuat
        // baris blocker = blocked mustahil, tapi penjaga ini gratis dan
        // menahan akibat terburuknya: penonton menyaring unggahannya sendiri.
        if (lain !== a) keluar.add(lain);
      }
      return keluar;
    },

    async semuaPasangan() {
      const { data, error } = await db.from("blocks").select("blocker, blocked");
      if (error) throw new Error(`baca semua blokir gagal: ${error.message}`);
      return ((data ?? []) as Pick<BarisDb, "blocker" | "blocked">[])
        .map((r): PasanganBlokir => ({
          blocker: r.blocker.toLowerCase(),
          blocked: r.blocked.toLowerCase(),
        }));
    },
  };
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test blokir-store`
Expected: PASS

- [ ] **Step 5: Buktikan tes arah menggigit**

Mutasi: ubah `.or(\`blocker.eq.${a},blocked.eq.${a}\`)` di `himpunanUntuk` menjadi `.eq("blocker", a)` — yaitu membaca satu arah saja. Jalankan `pnpm --filter @nearly/api test blokir-store`. Harapkan tes `"himpunanUntuk membaca KEDUA arah"` MERAH. Kembalikan.

Kalau tidak merah, tesnya tidak menguji apa yang namanya klaim — laporkan.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/blokir-store.ts apps/api/test/blokir-store.test.ts
git commit -m "feat(api): blokir-store dengan pembacaan dua arah"
```

---

## Task 6: `blokir-gate.ts` — gerbang

**Files:**
- Create: `apps/api/src/blokir-gate.ts`
- Test: `apps/api/test/blokir-gate.test.ts`

**Interfaces:**
- Consumes: `recoverBlokirSigner` dari `@nearly/shared`; `BlokirDeps`, `BarisBlokir` dari Task 4; `pulihkanTandaTangan` dari `apps/api/src/pulihkan-tanda-tangan.ts`.
- Produces: `BlokirFailure`, `BlokirResult<T>`, `setBlokir`, `daftarBlokir`.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/blokir-gate.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { blokirTypedData, lihatBlokirTypedData } from "@nearly/shared";
import { setBlokir } from "../src/blokir-gate";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = "0x000000000000000000000000000000000000beef" as Address;
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const NOW = 1_700_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);

function deps() {
  return {
    verifyingContract: VC, nowMs: () => NOW,
    blokir: {
      setBlokir: vi.fn(async () => {}),
      adaBlokir: vi.fn(async () => false),
      diblokirOleh: vi.fn(async () => []),
      himpunanUntuk: vi.fn(async () => new Set<string>()),
      semuaPasangan: vi.fn(async () => []),
    },
  } as never;
}

async function masukan(over: Record<string, unknown> = {}) {
  const msg = {
    target: (over.target as Address) ?? B,
    who: A.address as Address,
    blokir: (over.blokir as boolean) ?? true,
    expiresAt: (over.expiresAt as bigint) ?? EXP,
  };
  return { ...msg, sig: await A.signTypedData(blokirTypedData(msg, VC)), ...over } as never;
}

describe("setBlokir", () => {
  it("memblokir orang lain berhasil", async () => {
    const d = deps();
    const r = await setBlokir(await masukan(), d);
    expect(r.ok).toBe(true);
    expect((d as { blokir: { setBlokir: { mock: { calls: unknown[][] } } } })
      .blokir.setBlokir.mock.calls[0]).toEqual([B, A.address, true]);
  });

  it("mencabut blokir berhasil dan meneruskan false", async () => {
    const d = deps();
    const r = await setBlokir(await masukan({ blokir: false }), d);
    expect(r.ok).toBe(true);
    expect((d as { blokir: { setBlokir: { mock: { calls: unknown[][] } } } })
      .blokir.setBlokir.mock.calls[0]?.[2]).toBe(false);
  });

  // Ditolak di GERBANG, bukan di skema (spec §7.1). Alamat huruf kecil
  // dipakai supaya viem tetap menerimanya sebagai alamat sah — `toUpperCase`
  // menghasilkan "0X..." yang gagal isAddress dan membuat signTypedData
  // melempar SEBELUM gerbangnya sempat dijalankan.
  it("memblokir diri sendiri ditolak 400", async () => {
    const d = deps();
    const r = await setBlokir(
      await masukan({ target: A.address.toLowerCase() as Address }), d);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.failure.code).toBe("blokir_diri");
    expect(!r.ok && r.failure.httpStatus).toBe(400);
    expect((d as { blokir: { setBlokir: { mock: { calls: unknown[] } } } })
      .blokir.setBlokir.mock.calls.length).toBe(0);
  });

  it("kedaluwarsa ditolak 410", async () => {
    const d = deps();
    const lewat = BigInt(Math.floor(NOW / 1000) - 1);
    const r = await setBlokir(await masukan({ expiresAt: lewat }), d);
    expect(!r.ok && r.failure.code).toBe("expired");
  });

  // Batas persis: expiresAt * 1000 === nowMs() masih SAH. Tanpa tes ini,
  // membalik `>` jadi `>=` tidak merahkan apa pun.
  it("tepat di batas kedaluwarsa masih sah", async () => {
    const d = deps();
    const r = await setBlokir(await masukan({ expiresAt: BigInt(NOW / 1000) }), d);
    expect(r.ok).toBe(true);
  });

  it("tanda tangan orang lain ditolak 401", async () => {
    const lain = privateKeyToAccount(`0x${"b2".repeat(32)}` as Hex);
    const msg = { target: B, who: A.address as Address, blokir: true, expiresAt: EXP };
    const sig = await lain.signTypedData(blokirTypedData(msg, VC));
    const r = await setBlokir({ ...msg, sig } as never, deps());
    expect(!r.ok && r.failure.code).toBe("bad_signature");
  });

  // Tanda tangan yang PANJANGNYA sah tapi byte `v`-nya rusak membuat viem
  // melempar. Itu harus jadi 401, bukan 500.
  it("tanda tangan cacat bentuk → 401, bukan lemparan", async () => {
    const msg = { target: B, who: A.address as Address, blokir: true, expiresAt: EXP };
    const rusak = (`0x${"99".repeat(65)}`) as Hex;
    const r = await setBlokir({ ...msg, sig: rusak } as never, deps());
    expect(!r.ok && r.failure.httpStatus).toBe(401);
  });

  // LihatBlokir berbentuk { who, expiresAt } — beda dari Blokir, jadi kasus
  // ini mudah. Yang sulit ada di Task 7: LihatKecocokan sebagai LihatBlokir.
  it("tanda tangan LihatBlokir TIDAK sah sebagai perintah blokir", async () => {
    const d = deps();
    const sig = await A.signTypedData(
      lihatBlokirTypedData({ who: A.address as Address, expiresAt: EXP }, VC));
    const r = await setBlokir({
      target: B, who: A.address as Address, blokir: true, expiresAt: EXP, sig,
    } as never, d);
    expect(!r.ok && r.failure.code).toBe("bad_signature");
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test blokir-gate`
Expected: FAIL — `Cannot find module '../src/blokir-gate'`

- [ ] **Step 3: Buat `apps/api/src/blokir-gate.ts`**

```ts
import type { Address, Hex } from "viem";
import { recoverBlokirSigner } from "@nearly/shared";
import type { BarisBlokir, BlokirDeps } from "./ports";
import { pulihkanTandaTangan } from "./pulihkan-tanda-tangan";

export type BlokirFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "blokir_diri"; httpStatus: 400 };

export type BlokirResult<T> = { ok: true; value: T } | { ok: false; failure: BlokirFailure };

const fail = (failure: BlokirFailure): { ok: false; failure: BlokirFailure } =>
  ({ ok: false, failure });

const samaAlamat = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const sudahLewat = (deps: BlokirDeps, expiresAt: bigint) =>
  deps.nowMs() > Number(expiresAt) * 1000;

export type SetBlokirInput = {
  target: Address; who: Address; blokir: boolean; expiresAt: bigint; sig: Hex;
};

export async function setBlokir(
  input: SetBlokirInput, deps: BlokirDeps,
): Promise<BlokirResult<void>> {
  if (sudahLewat(deps, input.expiresAt)) return fail({ code: "expired", httpStatus: 410 });

  /**
   * Memblokir diri sendiri ditolak DI SINI dan hanya di sini (spec §7.1).
   * Skema Zod sengaja menerimanya; kalau ikut menolak, pemeriksaan ini tidak
   * pernah terjangkau lewat rute dan membusuk jadi kode mati. CHECK di basis
   * data adalah lapis terakhir untuk penulisan di luar jalur rute, bukan
   * pengganti pemeriksaan ini.
   */
  if (samaAlamat(input.target, input.who)) {
    return fail({ code: "blokir_diri", httpStatus: 400 });
  }

  const signer = await pulihkanTandaTangan(() => recoverBlokirSigner(
    {
      target: input.target, who: input.who,
      blokir: input.blokir, expiresAt: input.expiresAt,
    },
    input.sig,
    deps.verifyingContract,
  ));
  if (signer === null || !samaAlamat(signer, input.who)) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  await deps.blokir.setBlokir(input.target, input.who, input.blokir);
  return { ok: true, value: undefined };
}

/**
 * Daftar blokir. TIDAK mengembalikan `BlokirResult` karena bukti bacanya
 * diverifikasi di rute (Task 7) — polanya sama dengan `daftarKecocokan` di
 * Fase 3c, dan alasannya sama: bukti baca datang lewat query string, bukan
 * badan permintaan, jadi rutelah yang memegang bentuknya.
 */
export async function daftarBlokir(
  who: Address, deps: BlokirDeps,
): Promise<{ blokir: BarisBlokir[] }> {
  return { blokir: await deps.blokir.diblokirOleh(who) };
}
```

- [ ] **Step 4: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test blokir-gate`
Expected: PASS, 8 tes.

- [ ] **Step 5: Buktikan dua tes menggigit**

**Mutasi A:** pindahkan pemeriksaan `samaAlamat(input.target, input.who)` ke SETELAH `await deps.blokir.setBlokir(...)`. Harapkan tes `"memblokir diri sendiri ditolak 400"` merah pada asersi `setBlokir.mock.calls.length === 0`.

**Mutasi B:** ganti `>` jadi `>=` di `sudahLewat`. Harapkan tes `"tepat di batas kedaluwarsa masih sah"` merah, dan tes kedaluwarsa yang lain tetap hijau.

Kembalikan keduanya.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/blokir-gate.ts apps/api/test/blokir-gate.test.ts
git commit -m "feat(api): gerbang blokir"
```

---
## Task 7: Rute blokir dan perakitan

**Files:**
- Create: `apps/api/src/routes/blokir.ts`
- Modify: `apps/api/src/app.ts`, `apps/api/src/index.ts`
- Test: `apps/api/test/blokir.route.test.ts`

**Interfaces:**
- Consumes: `setBlokir`, `daftarBlokir` (Task 6); `BlokirRequestSchema` dan `recoverLihatBlokirSigner` dari `@nearly/shared`; `createBlokirStore` (Task 5).
- Produces: `blokirRoutes(deps: BlokirDeps)`.

**`onChanged` TIDAK dipanggil dari rute ini** — walaupun blokir memang mengubah graf. Alasannya di Step 3; ini kebalikan dari Fase 3c dan harus dibaca sebelum menulis kodenya.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/blokir.route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  blokirTypedData, lihatBlokirTypedData, lihatKecocokanTypedData, tandaiDilihatTypedData,
} from "@nearly/shared";
import { blokirRoutes } from "../src/routes/blokir";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = "0x000000000000000000000000000000000000beef" as Address;
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const NOW = 1_700_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);

function store(over: Record<string, unknown> = {}) {
  return {
    setBlokir: vi.fn(async () => {}),
    adaBlokir: vi.fn(async () => false),
    diblokirOleh: vi.fn(async () => [{ address: B, atMs: NOW }]),
    himpunanUntuk: vi.fn(async () => new Set<string>()),
    semuaPasangan: vi.fn(async () => []),
    ...over,
  };
}

function app(s = store()) {
  const a = new Hono();
  a.route("/", blokirRoutes({ blokir: s, verifyingContract: VC, nowMs: () => NOW } as never));
  return { a, s };
}

async function kueriBukti(penandatangan = A) {
  const sig = await penandatangan.signTypedData(
    lihatBlokirTypedData({ who: penandatangan.address as Address, expiresAt: EXP }, VC));
  return `who=${penandatangan.address}&expiresAt=${EXP}&sig=${sig}`;
}

describe("POST /blokir", () => {
  it("badan sah → 200", async () => {
    const { a, s } = app();
    const msg = { target: B, who: A.address as Address, blokir: true, expiresAt: EXP };
    const sig = await A.signTypedData(blokirTypedData(msg, VC));
    const r = await a.request("/blokir", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...msg, expiresAt: EXP.toString(), sig }),
    });
    expect(r.status).toBe(200);
    expect(s.setBlokir).toHaveBeenCalled();
  });

  it("badan tak sah → 400 invalid_body", async () => {
    const { a } = app();
    const r = await a.request("/blokir", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ target: "bukan-alamat" }),
    });
    expect(r.status).toBe(400);
    expect((await r.json() as { code: string }).code).toBe("invalid_body");
  });

  it("memblokir diri sendiri → 400 blokir_diri", async () => {
    const { a } = app();
    const diri = A.address.toLowerCase() as Address;
    const msg = { target: diri, who: A.address as Address, blokir: true, expiresAt: EXP };
    const sig = await A.signTypedData(blokirTypedData(msg, VC));
    const r = await a.request("/blokir", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...msg, expiresAt: EXP.toString(), sig }),
    });
    expect(r.status).toBe(400);
    expect((await r.json() as { code: string }).code).toBe("blokir_diri");
  });
});

describe("GET /blokir", () => {
  it("bukti sah → 200 dengan daftar", async () => {
    const { a } = app();
    const r = await a.request(`/blokir?${await kueriBukti()}`);
    expect(r.status).toBe(200);
    expect((await r.json() as { blokir: unknown[] }).blokir).toHaveLength(1);
  });

  // 403, BUKAN daftar kosong. Daftar kosong tidak bisa dibedakan dari "kamu
  // tidak memblokir siapa pun", jadi otorisasi yang rusak akan terlihat
  // seperti keadaan normal dan tidak ada yang menyadarinya.
  it("tanpa tanda tangan → 403, bukan daftar kosong", async () => {
    const { a, s } = app();
    const r = await a.request("/blokir");
    expect(r.status).toBe(403);
    expect(s.diblokirOleh).not.toHaveBeenCalled();
  });

  it("tanda tangan penandatangan salah → 403", async () => {
    const { a } = app();
    const lain = privateKeyToAccount(`0x${"b2".repeat(32)}` as Hex);
    const sig = await lain.signTypedData(
      lihatBlokirTypedData({ who: A.address as Address, expiresAt: EXP }, VC));
    const r = await a.request(`/blokir?who=${A.address}&expiresAt=${EXP}&sig=${sig}`);
    expect(r.status).toBe(403);
  });

  it("tanda tangan cacat bentuk → 403, bukan 500", async () => {
    const { a } = app();
    const rusak = `0x${"99".repeat(65)}`;
    const r = await a.request(`/blokir?who=${A.address}&expiresAt=${EXP}&sig=${rusak}`);
    expect(r.status).toBe(403);
  });

  // INI tes yang paling penting di berkas ini. LihatKecocokan dan
  // TandaiDilihat berbentuk field IDENTIK dengan LihatBlokir; tanda
  // tangannya sah, dari kunci yang benar, atas nilai yang benar. HANYA nama
  // tipenya yang berbeda, dan itulah satu-satunya hal yang menolaknya.
  it("tanda tangan LihatKecocokan → 403", async () => {
    const { a } = app();
    const sig = await A.signTypedData(
      lihatKecocokanTypedData({ who: A.address as Address, expiresAt: EXP }, VC));
    const r = await a.request(`/blokir?who=${A.address}&expiresAt=${EXP}&sig=${sig}`);
    expect(r.status).toBe(403);
  });

  it("tanda tangan TandaiDilihat → 403", async () => {
    const { a } = app();
    const sig = await A.signTypedData(
      tandaiDilihatTypedData({ who: A.address as Address, expiresAt: EXP }, VC));
    const r = await a.request(`/blokir?who=${A.address}&expiresAt=${EXP}&sig=${sig}`);
    expect(r.status).toBe(403);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test blokir.route`
Expected: FAIL — `Cannot find module '../src/routes/blokir'`

- [ ] **Step 3: Buat `apps/api/src/routes/blokir.ts`**

```ts
import { Hono } from "hono";
import { isAddress, type Address, type Hex } from "viem";
import { BlokirRequestSchema, recoverLihatBlokirSigner } from "@nearly/shared";
import { daftarBlokir, setBlokir } from "../blokir-gate";
import type { BlokirDeps } from "../ports";
import { pulihkanTandaTangan } from "../pulihkan-tanda-tangan";

/**
 * Mengembalikan alamat pemanggil HANYA kalau `who`, `expiresAt`, dan `sig`
 * lengkap, belum kedaluwarsa, dan tanda tangan LihatBlokir-nya memang milik
 * `who`. Selain itu null.
 *
 * `recoverLihatBlokirSigner` dan TIDAK PERNAH yang lain. `LihatKecocokan` dan
 * `TandaiDilihat` berbentuk field identik `{ who, expiresAt }`; kalau salah
 * satunya diterima di sini, tanda tangan yang bocor dari layar kecocokan
 * membuka daftar blokir orang lain. Kelas kesalahan Ruling 23.
 */
async function pemanggilTerbukti(
  q: Record<string, string>, deps: BlokirDeps,
): Promise<Address | null> {
  const { who, expiresAt, sig } = q;
  if (!who || !expiresAt || !sig) return null;
  if (!isAddress(who)) return null;
  if (!/^\d+$/.test(expiresAt)) return null;
  if (deps.nowMs() > Number(expiresAt) * 1000) return null;

  const signer = await pulihkanTandaTangan(() => recoverLihatBlokirSigner(
    { who: who as Address, expiresAt: BigInt(expiresAt) },
    sig as Hex,
    deps.verifyingContract,
  ));
  if (signer === null || signer.toLowerCase() !== who.toLowerCase()) return null;
  return who.toLowerCase() as Address;
}

export function blokirRoutes(deps: BlokirDeps) {
  const r = new Hono();

  r.post("/blokir", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = BlokirRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);

    const b = parsed.data;
    const hasil = await setBlokir({
      target: b.target as Address, who: b.who as Address, blokir: b.blokir,
      expiresAt: BigInt(b.expiresAt), sig: b.sig as Hex,
    }, deps);
    if (!hasil.ok) return c.json(hasil.failure, hasil.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.get("/blokir", async (c) => {
    const pemanggil = await pemanggilTerbukti(c.req.query(), deps);
    // 403, BUKAN daftar kosong. Daftar kosong tidak bisa dibedakan dari "kamu
    // tidak memblokir siapa pun", jadi otorisasi yang rusak akan terlihat
    // seperti keadaan normal.
    if (!pemanggil) return c.json({ code: "butuh_bukti" }, 403);
    return c.json(await daftarBlokir(pemanggil, deps));
  });

  return r;
}
```

- [ ] **Step 4: Rakit di `apps/api/src/app.ts`**

Tambahkan `blokir: BlokirStore;` ke `TrustDeps`, impor `blokirRoutes`, dan daftarkan:

```ts
  // `onChanged` TIDAK dipanggil dari rute blokir, walaupun blokir MEMANG
  // mengubah graf trust — dan ini kebalikan dari Fase 3c, jadi alasannya
  // ditulis di sini alih-alih diserahkan ke ingatan.
  //
  // Recompute melakukan loadGraph + computeTrust + setScore on-chain untuk
  // setiap tier yang berubah. Dipanggil dari rute, ia menempel pada permintaan
  // pengguna: memblokir seseorang akan terasa macet berdetik-detik, dan
  // relayer membakar gas tepat pada saat seseorang sedang berusaha
  // menyingkirkan orang lain — momen paling buruk untuk gagal.
  //
  // Skornya menyusul pada recompute berikutnya, yang dipicu handshake atau
  // vouch mana pun. Yang HARUS langsung berlaku adalah penyaringan feed dan
  // penanda (Task 9 dan 10), dan keduanya membaca tabel `blocks` secara
  // langsung tanpa menunggu recompute sama sekali.
  app.route("/", blokirRoutes(deps));
```

- [ ] **Step 5: Rakit di `apps/api/src/index.ts`**

Impor `createBlokirStore` dari `./blokir-store` dan tambahkan `blokir: createBlokirStore(supabase),` ke objek deps.

- [ ] **Step 6: Jalankan seluruh suite**

Run: `pnpm --filter @nearly/api test && pnpm --filter @nearly/api typecheck`
Expected: PASS. Berkas tes yang membangun `TrustDeps` lengkap butuh stub `blokir` — tambahkan stub lima metode seperti di `store()` pada tes ini.

- [ ] **Step 7: Buktikan tes kebingungan tipe menggigit**

Mutasi: di `pemanggilTerbukti`, tambahkan fallback yang mencoba `recoverLihatKecocokanSigner` kalau `recoverLihatBlokirSigner` menghasilkan alamat yang tidak cocok. Jalankan `pnpm --filter @nearly/api test blokir.route`. Harapkan tes `"tanda tangan LihatKecocokan → 403"` MERAH dan sisanya hijau. Kembalikan.

Ini simulasi persis pelebaran yang batas tipe ini ada untuk mencegah.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/blokir.ts apps/api/src/app.ts apps/api/src/index.ts \
  apps/api/test/
git commit -m "feat(api): dua endpoint blokir dan perakitannya"
```

---

## Task 8: Trust — `blocked` dibaca dari tabel, bukan ditulis keras

**Files:**
- Modify: `apps/api/src/trust/load-graph.ts`, `apps/api/src/trust/store.ts`
- Test: `apps/api/test/load-graph.test.ts` (tambah)

**Interfaces:**
- Consumes: `PasanganBlokir` dari Task 4; `BlokirStore.semuaPasangan` dari Task 5.
- Produces: medan `blocks` di `GraphRows`; `rowsToGraph` menghasilkan `edge.blocked` yang benar.

**`packages/trust` TIDAK DISENTUH.** Ia sudah membuang edge terblokir di `graph.ts:62,75`, `compute.ts:18`, `diversity.ts:58,97`, dan `fingerprint.ts:34`. Yang berubah cuma nilai yang masuk ke sana.

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan ke `apps/api/test/load-graph.test.ts`:

```ts
describe("rowsToGraph: blocked", () => {
  const KONEKSI = {
    addr_a: "0x00000000000000000000000000000000000000aa",
    addr_b: "0x00000000000000000000000000000000000000bb",
    cell: "u0nd9uu", created_at: new Date(NOW).toISOString(),
  };

  it("tanpa blokir, edge tidak terblokir", () => {
    const g = rowsToGraph(rows({ connections: [KONEKSI] as never, blocks: [] }), NOW);
    expect(g.edges[0]?.blocked).toBe(false);
  });

  it("A memblokir B → edge terblokir", () => {
    const g = rowsToGraph(rows({
      connections: [KONEKSI] as never,
      blocks: [{ blocker: KONEKSI.addr_a, blocked: KONEKSI.addr_b }],
    }), NOW);
    expect(g.edges[0]?.blocked).toBe(true);
  });

  // Arah kebalikan HARUS ikut memblokir edge-nya. packages/trust cuma punya
  // satu boolean per edge, dan trust tidak boleh mengalir ke arah mana pun
  // (spec §4). Membaca satu arah saja membuat separuh blokir tidak berefek
  // pada skor sama sekali.
  it("B memblokir A → edge yang SAMA juga terblokir", () => {
    const g = rowsToGraph(rows({
      connections: [KONEKSI] as never,
      blocks: [{ blocker: KONEKSI.addr_b, blocked: KONEKSI.addr_a }],
    }), NOW);
    expect(g.edges[0]?.blocked).toBe(true);
  });

  it("blokir ke orang yang tidak punya koneksi tidak membuat edge apa pun", () => {
    const g = rowsToGraph(rows({
      connections: [],
      blocks: [{ blocker: KONEKSI.addr_a, blocked: "0x00000000000000000000000000000000000000cc" }],
    }), NOW);
    expect(g.edges).toHaveLength(0);
  });

  it("huruf besar di baris blokir tetap cocok", () => {
    const g = rowsToGraph(rows({
      connections: [KONEKSI] as never,
      blocks: [{ blocker: KONEKSI.addr_a.toUpperCase(), blocked: KONEKSI.addr_b.toUpperCase() }],
    }), NOW);
    expect(g.edges[0]?.blocked).toBe(true);
  });
});
```

Perbarui juga helper `rows()` di berkas itu supaya `blocks: []` jadi bawaannya.

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test load-graph`
Expected: FAIL — tiga tes merah karena `blocked` selalu `false`.

- [ ] **Step 3: Tambahkan `blocks` ke `GraphRows` dan pakai di `rowsToGraph`**

Di `apps/api/src/trust/load-graph.ts`:

```ts
// tambahkan ke GraphRows
export type GraphRows = {
  connections: ConnRow[];
  vouches: VouchRow[];
  seeds: SeedRow[];
  slashes: SlashRow[];
  checkins: CheckInRow[];
  events: EventWindowRow[];
  blocks: PasanganBlokir[];
};

/**
 * Kunci kanonik satu pasangan, urutan tidak dipedulikan. Blokir disimpan
 * berarah tapi trust cuma punya satu boolean per edge — dan itu benar, karena
 * trust tidak boleh mengalir ke arah mana pun lewat pasangan yang salah
 * satunya memblokir (spec §4).
 */
function kunciPasangan(a: string, b: string): string {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? `${x}|${y}` : `${y}|${x}`;
}
```

Lalu di `rowsToGraph`, sebelum `const edges = ...`:

```ts
  const terblokir = new Set(rows.blocks.map((b) => kunciPasangan(b.blocker, b.blocked)));
```

dan ganti `blocked: false` menjadi:

```ts
      blocked: terblokir.has(kunciPasangan(r.addr_a, r.addr_b)),
```

Impor `PasanganBlokir` dari `../ports`.

- [ ] **Step 4: Ambil barisnya di `apps/api/src/trust/store.ts`**

Tambahkan satu `fetchAllPages` ke `Promise.all` yang sudah ada, mengikuti bentuk yang persis sama dengan tetangganya:

```ts
        fetchAllPages<PasanganBlokir>(
          (f, t) =>
            db.from("blocks").select("blocker, blocked")
              .order("blocker", { ascending: true }).order("blocked", { ascending: true })
              .range(f, t) as never,
          "baca blokir",
        ),
```

dan teruskan ke `rowsToGraph({ connections, vouches, seeds, slashes, checkins, events, blocks }, nowMs)`.

**Dimuat SEKALI per recompute**, bukan satu kueri per edge — graf dimuat utuh setiap kali, dan kueri per-edge akan mengubah satu recompute jadi ribuan perjalanan ke database (spec §4).

- [ ] **Step 5: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test && pnpm --filter @nearly/api typecheck`
Expected: PASS

- [ ] **Step 6: Buktikan arah kedua benar-benar diuji**

Mutasi: ganti `kunciPasangan` supaya TIDAK mengurutkan — kembalikan `` `${a.toLowerCase()}|${b.toLowerCase()}` `` apa adanya. Jalankan `pnpm --filter @nearly/api test load-graph`. Harapkan tes `"B memblokir A → edge yang SAMA juga terblokir"` MERAH, sementara tes `"A memblokir B"` tetap hijau. Kembalikan.

- [ ] **Step 7: Verifikasi `packages/trust` tidak tersentuh**

```bash
git status --porcelain packages/trust    # harus kosong
```

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/trust/load-graph.ts apps/api/src/trust/store.ts apps/api/test/load-graph.test.ts
git commit -m "feat(api): graf trust membaca blokir dari tabel"
```

---
## Task 9: Feed — kandidat disaring dan `petaHop` membuang edge terblokir

**Files:**
- Modify: `apps/api/src/feed-store.ts`
- Test: `apps/api/test/feed-blokir.test.ts`

**Interfaces:**
- Consumes: `BlokirStore.himpunanUntuk` dari Task 5.
- Produces: `petaHop(viewer, tepi1, tepi2, terblokir)` — parameter keempat baru; `createFeedStore(db, blokir)`.

Dua perubahan, dan **keduanya wajib**. Menyaring kandidat saja membuat unggahan hilang tapi jarak hop ke orang ketiga tetap dihitung lewat edge yang seharusnya putus — feed dan trust lalu memberi jawaban berbeda tentang graf yang sama, dan yang salah justru feed karena ia yang menentukan apa yang orang lihat (spec §5.1).

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/feed-blokir.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { petaHop } from "../src/feed-store";

const AKU = "0x00000000000000000000000000000000000000aa" as Address;
const B = "0x00000000000000000000000000000000000000bb";
const C = "0x00000000000000000000000000000000000000cc";

const tepi = (a: string, b: string) => ({ addr_a: a, addr_b: b });

describe("petaHop dengan blokir", () => {
  it("tanpa blokir, B satu lompatan dan C dua", () => {
    const h = petaHop(AKU, [tepi(AKU, B)], [tepi(B, C)], new Set());
    expect(h.get(B)).toBe(1);
    expect(h.get(C)).toBe(2);
  });

  it("memblokir B menghapus B dari peta", () => {
    const h = petaHop(AKU, [tepi(AKU, B)], [tepi(B, C)], new Set([B]));
    expect(h.has(B)).toBe(false);
  });

  // INI konsekuensi yang tidak akan diduga pengguna, dan yang membuat
  // penyaringan kandidat saja tidak cukup: C tadinya terjangkau LEWAT B.
  // Memblokir B memutus jalannya, jadi C keluar dari jangkauan sama sekali.
  it("memblokir B juga mengeluarkan C yang hanya terjangkau lewat B", () => {
    const h = petaHop(AKU, [tepi(AKU, B)], [tepi(B, C)], new Set([B]));
    expect(h.has(C)).toBe(false);
  });

  it("C tetap dua lompatan kalau ada jalan lain yang tidak lewat B", () => {
    const D = "0x00000000000000000000000000000000000000dd";
    const h = petaHop(AKU, [tepi(AKU, B), tepi(AKU, D)], [tepi(B, C), tepi(D, C)], new Set([B]));
    expect(h.get(C)).toBe(2);
  });

  it("alamat sendiri tetap nol walau entah bagaimana ada di himpunan blokir", () => {
    const h = petaHop(AKU, [], [], new Set([AKU.toLowerCase()]));
    expect(h.get(AKU.toLowerCase())).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test feed-blokir`
Expected: FAIL — `petaHop` menerima tiga argumen, bukan empat.

- [ ] **Step 3: Ubah `petaHop` di `apps/api/src/feed-store.ts`**

Ganti komentar lama yang berbunyi *"Kolom `blocked` TIDAK ADA di tabel connections; blokir baru datang di Fase 4"* dengan:

```ts
 * `terblokir` memuat setiap alamat yang punya hubungan blokir dengan penonton
 * ke arah mana pun. Edge yang menyentuhnya dibuang SEBELUM lompatan dihitung,
 * bukan sesudahnya — kalau disaring sesudah, orang ketiga yang hanya
 * terjangkau LEWAT orang yang diblokir tetap terhitung dua lompatan padahal
 * jalannya sudah putus, dan feed akan tidak sepakat dengan graf trust yang
 * memang membuang edge itu sepenuhnya (spec §5.1).
```

Lalu tanda tangannya dan penyaringannya:

```ts
export function petaHop(
  viewer: Address, tepi1: Tepi[], tepi2: Tepi[], terblokir: ReadonlySet<string>,
): Map<string, 0 | 1 | 2> {
  const aku = viewer.toLowerCase();
  const peta = new Map<string, 0 | 1 | 2>();
  peta.set(aku, 0);

  // Edge yang menyentuh alamat terblokir dibuang lebih dulu, kedua lapisnya.
  const hidup = (t: Tepi) =>
    !terblokir.has(t.addr_a.toLowerCase()) && !terblokir.has(t.addr_b.toLowerCase());
  const t1 = tepi1.filter(hidup);
  const t2 = tepi2.filter(hidup);
```

dan ganti dua perulangan di bawahnya supaya memakai `t1` dan `t2`, bukan `tepi1` dan `tepi2`.

- [ ] **Step 4: Saring kandidat di `listCandidates`**

`createFeedStore` menerima `BlokirStore` sebagai parameter kedua. Di `listCandidates`, setelah `const aku = viewer ? viewer.toLowerCase() : null;`:

```ts
      // Dua arah: unggahan orang yang kamu blokir hilang dari feedmu, DAN
      // unggahanmu hilang dari feed mereka. Yang kedua terjadi sendirinya
      // karena himpunan ini simetris (spec §5.1).
      const terblokir = aku ? await blokir.himpunanUntuk(viewer as Address) : new Set<string>();
```

Saring `posts` tepat setelah `rowToPost`:

```ts
      const posts = (postRows ?? []).map((r) => rowToPost(r as PostDbRow))
        .filter((p) => !terblokir.has(p.author.toLowerCase()));
```

dan teruskan `terblokir` sebagai argumen keempat `petaHop`.

- [ ] **Step 5: Perbarui pemanggil**

`apps/api/src/index.ts`: `feed: createFeedStore(supabase, createBlokirStore(supabase))`. Buat satu instans `blokirStore` di atas lalu pakai ulang untuk `feed` dan `blokir` — dua instans bekerja, tapi satu lebih jelas bahwa keduanya membaca tabel yang sama.

Tes lama yang memanggil `petaHop` dengan tiga argumen: tambahkan `new Set()` sebagai argumen keempat.

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/api test && pnpm --filter @nearly/api typecheck`
Expected: PASS

- [ ] **Step 7: Buktikan penyaringan terjadi SEBELUM lompatan dihitung**

Mutasi: pindahkan penyaringan supaya berjalan di akhir — hapus `.filter(hidup)` dan sebagai gantinya hapus kunci terblokir dari `peta` sebelum `return`. Jalankan `pnpm --filter @nearly/api test feed-blokir`. Harapkan tes `"memblokir B juga mengeluarkan C yang hanya terjangkau lewat B"` MERAH sementara tes `"memblokir B menghapus B dari peta"` tetap hijau — itu memisahkan penyaringan yang benar dari penyaringan yang cuma terlihat benar. Kembalikan.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/feed-store.ts apps/api/src/index.ts apps/api/test/
git commit -m "feat(api): feed menyaring blokir di kandidat dan di jarak hop"
```

---

## Task 10: Penanda — tanda dari dan ke yang diblokir berhenti dihitung

**Files:**
- Modify: `apps/api/src/meet-store.ts`, `apps/api/src/routes/profile.ts`, `apps/api/src/routes/events.ts`, `apps/api/src/meet-gate.ts`
- Test: `apps/api/test/meet-blokir.test.ts`

**Interfaces:**
- Consumes: parameter `kecuali` dari Task 4; `BlokirStore.himpunanUntuk` dari Task 5.
- Produces: keempat metode baca `MeetStore` menghormati `kecuali`; `MeetDeps` mendapat `blokir: BlokirStore`.

**Ini task yang menghapus satu-satunya `// TODO Task 10` yang ditinggalkan Task 4.** Kalau masih ada yang tersisa setelah task ini, itu cacat.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/api/test/meet-blokir.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import { createMeetStore } from "../src/meet-store";

const A = "0x00000000000000000000000000000000000000aa" as Address;
const B = "0x00000000000000000000000000000000000000bb";

/** Merekam `not(...)` supaya bentuk kuerinya bisa diasersi. */
function dbPalsu(baris: Record<string, unknown>[] = []) {
  const panggilan: { op: string; arg: unknown }[] = [];
  const rantai = () => ({
    select: () => rantai(),
    eq: () => rantai(),
    not: (kolom: string, op: string, nilai: unknown) => {
      panggilan.push({ op: `not:${kolom}:${op}`, arg: nilai });
      return rantai();
    },
    order: () => rantai(),
    then: (r: (v: unknown) => unknown) => r({ data: baris, error: null, count: baris.length }),
  });
  return { db: { from: () => rantai() } as never, panggilan };
}

describe("MeetStore menghormati `kecuali`", () => {
  it("hitungTanda tanpa pengecualian tidak memasang filter not", async () => {
    const { db, panggilan } = dbPalsu();
    await createMeetStore(db).hitungTanda(A, []);
    expect(panggilan.filter((p) => p.op.startsWith("not:")).length).toBe(0);
  });

  it("hitungTanda dengan pengecualian memasang filter not", async () => {
    const { db, panggilan } = dbPalsu();
    await createMeetStore(db).hitungTanda(A, [B]);
    const not = panggilan.find((p) => p.op.startsWith("not:"));
    expect(not).toBeDefined();
    expect(String(not?.arg)).toContain(B);
  });

  it("tandaOleh dengan pengecualian memasang filter not", async () => {
    const { db, panggilan } = dbPalsu();
    await createMeetStore(db).tandaOleh(A, [B]);
    expect(panggilan.some((p) => p.op.startsWith("not:"))).toBe(true);
  });

  it("tandaKe dengan pengecualian memasang filter not", async () => {
    const { db, panggilan } = dbPalsu();
    await createMeetStore(db).tandaKe(A, [B]);
    expect(panggilan.some((p) => p.op.startsWith("not:"))).toBe(true);
  });

  it("adaTanda dengan pengecualian memasang filter not", async () => {
    const { db, panggilan } = dbPalsu();
    await createMeetStore(db).adaTanda(A, B as Address, [B]);
    expect(panggilan.some((p) => p.op.startsWith("not:"))).toBe(true);
  });

  // Daftar pengecualian yang panjang tidak boleh membangun query string
  // raksasa yang ditolak PostgREST — jebakan yang sama yang melahirkan
  // potongKelompok di Fase 3b.
  it("pengecualian lebih dari UKURAN_KELOMPOK dipotong, bukan dikirim sekaligus", async () => {
    const { db, panggilan } = dbPalsu();
    const banyak = Array.from({ length: 250 }, (_, i) =>
      `0x${String(i).padStart(40, "0")}`);
    await createMeetStore(db).hitungTanda(A, banyak);
    const nots = panggilan.filter((p) => p.op.startsWith("not:"));
    expect(nots.length).toBeGreaterThanOrEqual(3);
    for (const n of nots) expect(String(n.arg).split(",").length).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/api test meet-blokir`
Expected: FAIL — metode-metodanya belum menerima argumen kedua.

- [ ] **Step 3: Terapkan `kecuali` di `apps/api/src/meet-store.ts`**

Tambahkan helper di berkas itu:

```ts
/**
 * Memasang filter "bukan salah satu dari" secara bertahap, dipotong per
 * UKURAN_KELOMPOK. `.not(kolom, "in", "(a,b,c)")` masuk ke query string sama
 * seperti `.in()`, jadi daftar panjang menabrak batas panjang URL PostgREST —
 * jebakan yang sama yang melahirkan potongKelompok di Fase 3b.
 *
 * Rantai `not` yang beruntun adalah konjungsi: baris harus lolos SEMUA
 * kelompok, dan itu memang artinya "tidak ada di daftar mana pun".
 */
function tanpa<T>(q: T, kolom: string, kecuali: readonly string[]): T {
  let keluar = q;
  for (const bagian of potongKelompok([...new Set(kecuali.map((a) => a.toLowerCase()))])) {
    keluar = (keluar as { not: (k: string, o: string, v: string) => T })
      .not(kolom, "in", `(${bagian.join(",")})`);
  }
  return keluar;
}
```

Lalu pasang di keempat metode: `hitungTanda` dan `tandaKe` menyaring kolom `who`; `tandaOleh` menyaring kolom `target`; `adaTanda` menyaring `who`.

- [ ] **Step 4: Berikan himpunan blokir dari pemanggil**

`MeetDeps` di `ports.ts` mendapat `blokir: BlokirStore`. Lalu di setiap pemanggil, ganti `[]` yang ditinggalkan Task 4 dengan himpunan sungguhan:

- `apps/api/src/routes/profile.ts` — `hitungTanda(addr, [...await deps.blokir.himpunanUntuk(addr)])` untuk angka publik, dan himpunan pemanggil untuk kedua bendera pribadi.
- `apps/api/src/routes/events.ts` — himpunan pemanggil untuk `tandaOleh` dan `tandaKe`.
- `apps/api/src/meet-gate.ts` — himpunan pemanggil untuk `daftarKecocokan`.

**Hapus setiap `// TODO Task 10`.** Verifikasi dengan `grep -rn "TODO Task 10" apps/` yang harus kosong.

- [ ] **Step 5: Tolak menandai saat terblokir, di gerbang**

Di `setTanda` pada `apps/api/src/meet-gate.ts`, setelah verifikasi tanda tangan dan sebelum menulis:

```ts
  // Selama terblokir, keduanya tidak bisa saling menandai (spec §5.2).
  // Diperiksa SETELAH tanda tangan supaya tidak menjadi orakel: tanpa tanda
  // tangan yang sah, tidak ada yang bisa memancing keberadaan blokir.
  if (await deps.blokir.himpunanUntuk(input.who).then((s) => s.has(input.target.toLowerCase()))) {
    return fail({ code: "terblokir", httpStatus: 403 });
  }
```

Tambahkan `| { code: "terblokir"; httpStatus: 403 }` ke `MeetFailure`.

- [ ] **Step 6: Jalankan seluruh suite**

Run: `pnpm --filter @nearly/api test && pnpm --filter @nearly/api typecheck`
Expected: PASS. Fake `MeetDeps` di tes lama butuh stub `blokir` lima metode.

- [ ] **Step 7: Buktikan pemotongan dan urutan pemeriksaan menggigit**

**Mutasi A:** ganti `potongKelompok(...)` di `tanpa` dengan `[[...kecuali]]` — satu kelompok utuh. Harapkan tes `"pengecualian lebih dari UKURAN_KELOMPOK dipotong"` MERAH.

**Mutasi B:** pindahkan pemeriksaan `terblokir` di `setTanda` ke SEBELUM verifikasi tanda tangan. Tulis satu tes tambahan yang membuktikannya jadi orakel — permintaan dengan tanda tangan sampah mengembalikan `terblokir` alih-alih `bad_signature` — lalu pastikan tes itu merah sebelum mutasi dikembalikan.

Kembalikan keduanya.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/meet-store.ts apps/api/src/meet-gate.ts apps/api/src/routes/ \
  apps/api/src/ports.ts apps/api/test/
git commit -m "feat(api): tanda dari dan ke yang diblokir berhenti dihitung"
```

---
## Task 11: Mobile — klien blokir dan pesan galat

**Files:**
- Create: `apps/mobile/src/blokir-api.ts`, `apps/mobile/src/blokir-actions.ts`
- Modify: `apps/mobile/src/messages.ts`
- Test: `apps/mobile/test/blokir-bukti.test.ts`, `apps/mobile/test/blokir-messages.test.ts`

**Interfaces:**
- Consumes: `postJson`, `req` dari `apps/mobile/src/http.ts`; `CONFIG` dari `src/config.ts`; tipe EIP-712 dari `@nearly/shared`; `PenandaSigner` dari `apps/mobile/src/meet-api.ts`.
- Produces: `type BarisBlokir`, `kueriBuktiBlokir`, `getBlokir` (di `blokir-api.ts`); `aksiBlokir(signer, target, sedangDiblokir)` (di `blokir-actions.ts`); `blokirErrorMessage`, `blokirTombolLabel` (di `messages.ts`).

**`blokir-actions.ts` adalah SATU-SATUNYA tempat `Blokir` ditandatangani.** Aturan yang sama yang membuat `meet-actions.ts` ada: dua tempat menandatangani satu operasi adalah cara termudah salah satunya diperbaiki nanti dan yang lain tertinggal diam-diam.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/blokir-bukti.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { recoverBlokirSigner, recoverLihatBlokirSigner, recoverLihatKecocokanSigner } from "@nearly/shared";
import { CONFIG } from "../src/config";
import { kueriBuktiBlokir } from "../src/blokir-api";
import { aksiBlokir } from "../src/blokir-actions";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const B = "0x000000000000000000000000000000000000beef" as Address;
const signer = {
  address: A.address as Address,
  signTypedData: (a: Parameters<typeof A.signTypedData>[0]) => A.signTypedData(a),
};

const aslinya = globalThis.fetch;
afterEach(() => { globalThis.fetch = aslinya; });

describe("kueriBuktiBlokir", () => {
  it("menghasilkan bukti LihatBlokir yang bisa dipulihkan", async () => {
    const kueri = new URLSearchParams(await kueriBuktiBlokir(signer as never));
    const pulih = await recoverLihatBlokirSigner(
      { who: kueri.get("who") as Address, expiresAt: BigInt(kueri.get("expiresAt")!) },
      kueri.get("sig") as Hex, CONFIG.verifyingContract);
    expect(pulih.toLowerCase()).toBe(A.address.toLowerCase());
  });

  // Bentuk fieldnya identik dengan LihatKecocokan. Kalau pembangunnya suatu
  // saat tertukar, tanda tangan ini akan tetap "terlihat sah" sampai
  // dipulihkan dengan tipe yang salah.
  it("BUKAN tanda tangan LihatKecocokan", async () => {
    const kueri = new URLSearchParams(await kueriBuktiBlokir(signer as never));
    const pulih = await recoverLihatKecocokanSigner(
      { who: kueri.get("who") as Address, expiresAt: BigInt(kueri.get("expiresAt")!) },
      kueri.get("sig") as Hex, CONFIG.verifyingContract);
    expect(pulih.toLowerCase()).not.toBe(A.address.toLowerCase());
  });

  it("alamat masuk kueri apa adanya, tanpa diubah casingnya", async () => {
    const kueri = new URLSearchParams(await kueriBuktiBlokir(signer as never));
    expect(kueri.get("who")).toBe(A.address);
  });
});

describe("aksiBlokir", () => {
  it("menandatangani Blokir dan mengirim `blokir` sesuai kebalikan keadaan", async () => {
    let dikirim: Record<string, unknown> = {};
    globalThis.fetch = (async (_u: string, init?: RequestInit) => {
      dikirim = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as never;

    await aksiBlokir(signer as never, B, false);
    expect(dikirim.blokir).toBe(true);

    const pulih = await recoverBlokirSigner(
      {
        target: dikirim.target as Address, who: dikirim.who as Address,
        blokir: dikirim.blokir as boolean, expiresAt: BigInt(String(dikirim.expiresAt)),
      },
      dikirim.sig as Hex, CONFIG.verifyingContract);
    expect(pulih.toLowerCase()).toBe(A.address.toLowerCase());
  });

  it("sedang diblokir → mengirim blokir false", async () => {
    let dikirim: Record<string, unknown> = {};
    globalThis.fetch = (async (_u: string, init?: RequestInit) => {
      dikirim = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as never;
    await aksiBlokir(signer as never, B, true);
    expect(dikirim.blokir).toBe(false);
  });
});
```

`apps/mobile/test/blokir-messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { blokirErrorMessage, blokirTombolLabel } from "../src/messages";

describe("blokirErrorMessage", () => {
  it("menerjemahkan setiap kode gerbang blokir", () => {
    for (const kode of ["expired", "bad_signature", "blokir_diri", "butuh_bukti", "invalid_body"]) {
      const p = blokirErrorMessage(kode);
      expect(p).not.toContain("_");
      expect(p.length).toBeGreaterThan(10);
    }
  });

  it("kode tak dikenal jatuh ke kalimat cadangan", () => {
    expect(blokirErrorMessage("entah-apa")).toBe(blokirErrorMessage("juga-entah"));
  });
});

describe("blokirTombolLabel", () => {
  it("belum diblokir → mengajak memblokir", () => {
    expect(blokirTombolLabel(false, false)).toContain("Blokir");
  });

  it("sudah diblokir → menawarkan mencabut", () => {
    expect(blokirTombolLabel(true, false)).toContain("Cabut");
  });

  // Label harus jujur tentang apa yang terjadi kalau diketuk. Sedang sibuk
  // berarti ketukan berikutnya tidak melakukan apa-apa, jadi labelnya tidak
  // boleh menjanjikan aksi.
  it("sedang sibuk → tidak menjanjikan aksi apa pun", () => {
    expect(blokirTombolLabel(false, true)).not.toContain("Blokir");
    expect(blokirTombolLabel(true, true)).not.toContain("Cabut");
  });
});
```

- [ ] **Step 2: Jalankan tes, pastikan gagal**

Run: `pnpm --filter @nearly/mobile test blokir`
Expected: FAIL — modulnya belum ada.

- [ ] **Step 3: Buat `apps/mobile/src/blokir-api.ts`**

```ts
import type { Address } from "viem";
import { lihatBlokirTypedData } from "@nearly/shared";
import { CONFIG } from "./config";
import { req } from "./http";
import type { PenandaSigner } from "./meet-api";

/** Satu baris di layar daftar blokir. */
export type BarisBlokir = { address: string; atMs: number };

const UMUR_DETIK = 300;
const kedaluwarsa = () => BigInt(Math.floor(Date.now() / 1000) + UMUR_DETIK);

/**
 * Bukti BACA untuk `GET /blokir`. Dibangun dengan `lihatBlokirTypedData` dan
 * TIDAK PERNAH yang lain — `LihatKecocokan` dan `TandaiDilihat` berbentuk
 * field identik `{ who, expiresAt }`, dan memakai salah satunya di sini
 * berarti satu tanda tangan bisa dipakai untuk dua hal berbeda.
 *
 * `signer.address` masuk kueri APA ADANYA. Server memvalidasinya dengan
 * `isAddress` yang strict EIP-55: alamat dari viem sudah checksummed dan
 * lolos, tapi alamat huruf campur yang dirakit tangan akan ditolak 403.
 */
export async function kueriBuktiBlokir(signer: PenandaSigner): Promise<string> {
  const expiresAt = kedaluwarsa();
  const sig = await signer.signTypedData(
    lihatBlokirTypedData({ who: signer.address, expiresAt }, CONFIG.verifyingContract) as never);
  return new URLSearchParams({
    who: signer.address, expiresAt: expiresAt.toString(), sig,
  }).toString();
}

export function getBlokir(kueri: string): Promise<{ blokir: BarisBlokir[] }> {
  return req<{ blokir: BarisBlokir[] }>(`/blokir?${kueri}`);
}
```

- [ ] **Step 4: Buat `apps/mobile/src/blokir-actions.ts`**

```ts
import type { Address } from "viem";
import { blokirTypedData } from "@nearly/shared";
import { CONFIG } from "./config";
import { postJson } from "./http";
import type { PenandaSigner } from "./meet-api";

const UMUR_DETIK = 300;

/**
 * SATU-SATUNYA tempat `Blokir` ditandatangani di seluruh aplikasi mobile.
 *
 * Dua tempat menandatangani satu operasi adalah cara termudah salah satunya
 * diperbaiki nanti dan yang lain tertinggal diam-diam — dan di sini yang
 * tertinggal akan berupa blokir yang tidak benar-benar memblokir.
 *
 * `sedangDiblokir` adalah keadaan SEKARANG; yang dikirim kebalikannya.
 */
export async function aksiBlokir(
  signer: PenandaSigner, target: Address, sedangDiblokir: boolean,
): Promise<void> {
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + UMUR_DETIK);
  const pesan = {
    target, who: signer.address, blokir: !sedangDiblokir, expiresAt,
  };
  const sig = await signer.signTypedData(
    blokirTypedData(pesan, CONFIG.verifyingContract) as never);
  await postJson<{ ok: true }>("/blokir", {
    ...pesan, expiresAt: expiresAt.toString(), sig,
  });
}
```

- [ ] **Step 5: Tambahkan pesan di `apps/mobile/src/messages.ts`**

```ts
const BLOKIR_MESSAGES: Record<string, string> = {
  blokir_diri: "Kamu tidak bisa memblokir dirimu sendiri.",
  bad_signature: "Tanda tangan tidak cocok. Coba lagi.",
  expired: "Permintaannya sudah kedaluwarsa. Coba lagi.",
  // Sama seperti di layar kecocokan: bukan salah pengguna, dan yang menolong
  // adalah memuat ulang, bukan mengetuk tombol yang sama lagi.
  butuh_bukti: "Buktinya belum ada, sudah kedaluwarsa, atau dari dompet yang berbeda. Muat ulang layar ini untuk mencoba lagi.",
  terblokir: "Kalian saling memblokir, jadi ini tidak bisa dilakukan.",
  invalid_body: "Ada isian yang belum benar.",
};

export function blokirErrorMessage(code: string): string {
  return BLOKIR_MESSAGES[code] ?? "Gagal. Coba lagi sebentar.";
}

/**
 * Label tombol blokir. Sengaja fungsi murni supaya bisa diuji tanpa merender
 * — repo ini tidak punya harness uji render React Native, dan pola yang sama
 * sudah dipakai `teksLencana` dan `tombolTandaLabel`.
 */
export function blokirTombolLabel(sudahDiblokir: boolean, sibuk: boolean): string {
  if (sibuk) return "Mengirim…";
  return sudahDiblokir ? "Cabut blokir" : "Blokir orang ini";
}
```

- [ ] **Step 6: Jalankan tes, pastikan lulus**

Run: `pnpm --filter @nearly/mobile test && pnpm --filter @nearly/mobile typecheck`
Expected: PASS

- [ ] **Step 7: Buktikan tes batas tipe menggigit**

Mutasi: di `kueriBuktiBlokir`, ganti `lihatBlokirTypedData` dengan `lihatKecocokanTypedData`. Jalankan `pnpm --filter @nearly/mobile test blokir-bukti`. Harapkan DUA tes merah — yang positif dan yang negatif. Kembalikan.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/blokir-api.ts apps/mobile/src/blokir-actions.ts \
  apps/mobile/src/messages.ts apps/mobile/test/
git commit -m "feat(mobile): klien blokir dan satu situs penandatanganan"
```

---

## Task 12: Mobile — layar daftar blokir

**Files:**
- Create: `apps/mobile/app/blokir.tsx`
- Modify: `apps/mobile/app/index.tsx`
- Test: tidak ada tes render baru — lihat catatan di Step 1

**Interfaces:**
- Consumes: `getBlokir`, `kueriBuktiBlokir`, `BarisBlokir` (Task 11); `aksiBlokir` (Task 11); `blokirErrorMessage`, `blokirTombolLabel` (Task 11); `createDevSigner`, `CONFIG`.
- Produces: rute `/blokir` di aplikasi mobile.

**Repo ini tidak punya harness uji render React Native**, dan membangunnya jauh di luar cakupan fase ini. Karena itu setiap logika yang bisa diuji sudah diekstrak jadi fungsi murni di Task 11 (`blokirTombolLabel`, `blokirErrorMessage`), dan layar ini hanya merangkainya.

- [ ] **Step 1: Buat `apps/mobile/app/blokir.tsx`**

```tsx
import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Button, FlatList, StyleSheet, Text, View } from "react-native";
import type { Address } from "viem";
import { CONFIG } from "../src/config";
import { createDevSigner } from "../src/signer";
import { ApiError } from "../src/http";
import { getBlokir, kueriBuktiBlokir, type BarisBlokir } from "../src/blokir-api";
import { aksiBlokir } from "../src/blokir-actions";
import { blokirErrorMessage } from "../src/messages";

export default function BlokirScreen() {
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.verifyingContract),
    [],
  );
  const [baris, setBaris] = useState<BarisBlokir[] | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);

  const muat = useCallback(async () => {
    try {
      const { blokir } = await getBlokir(await kueriBuktiBlokir(signer));
      setBaris(blokir);
      setPesan(null);
    } catch (e) {
      setBaris([]);
      setPesan(e instanceof ApiError ? blokirErrorMessage(e.code) : "Daftar blokir gagal dimuat.");
    }
  }, [signer]);

  // SATU pemicu. `useFocusEffect` sudah menyala saat layar pertama kali
  // fokus — yaitu saat mount — jadi `useEffect` di sebelahnya akan jadi
  // duplikat: dua tanda tangan dan dua permintaan setiap layar dibuka.
  useFocusEffect(useCallback(() => { void muat(); }, [muat]));

  async function cabut(alamat: string) {
    if (sibuk) return;
    setSibuk(alamat);
    setPesan(null);
    try {
      await aksiBlokir(signer, alamat as Address, true);
    } catch (e) {
      setPesan(e instanceof ApiError ? blokirErrorMessage(e.code) : "Gagal mencabut blokir.");
      setSibuk(null);
      return;
    }
    setSibuk(null);
    try {
      await muat();
    } catch {
      // Pencabutannya SUDAH tersimpan. Mengatakan "gagal mencabut" di sini
      // akan berbohong tentang aksi yang berhasil.
      setPesan("Blokir sudah dicabut, tapi daftarnya gagal dimuat ulang.");
    }
  }

  if (baris === null) return <ActivityIndicator style={s.tengah} />;

  return (
    <View style={s.root}>
      {pesan && <Text style={s.pesan}>{pesan}</Text>}
      <FlatList
        data={baris}
        keyExtractor={(b) => b.address}
        ListEmptyComponent={
          // Kalau `pesan` terisi, daftar kosong ini BUKAN berarti "kamu tidak
          // memblokir siapa pun" — itu kegagalan otorisasi, dan menampilkannya
          // sebagai keadaan normal adalah kebohongan yang tidak bisa dideteksi
          // pengguna.
          pesan ? null : (
            <Text style={s.kosong}>
              Kamu belum memblokir siapa pun. Blokir bisa dipasang dari layar profil seseorang.
            </Text>
          )
        }
        renderItem={({ item }) => (
          <View style={s.kartu}>
            <Text style={s.alamat}>{item.address}</Text>
            <Button
              title={sibuk === item.address ? "Mengirim…" : "Cabut blokir"}
              disabled={sibuk === item.address}
              onPress={() => { void cabut(item.address); }}
            />
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  tengah: { flex: 1 },
  pesan: { color: "#b00", marginBottom: 8 },
  kosong: { color: "#666", lineHeight: 20 },
  kartu: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#eee", gap: 8 },
  alamat: { fontFamily: "monospace", fontSize: 12 },
});
```

- [ ] **Step 2: Tautkan dari beranda**

Di `apps/mobile/app/index.tsx`, tambahkan setelah tautan kecocokan:

```tsx
      <Link href="/blokir" style={s.link}>Daftar blokir</Link>
```

- [ ] **Step 3: Jalankan tes dan typecheck**

Run: `pnpm --filter @nearly/mobile test && pnpm --filter @nearly/mobile typecheck`
Expected: PASS, typecheck bersih.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/app/blokir.tsx apps/mobile/app/index.tsx
git commit -m "feat(mobile): layar daftar blokir"
```

---

## Task 13: Mobile — tombol blokir di layar profil

**Files:**
- Modify: `apps/mobile/app/profile/[address].tsx`
- Test: tidak ada tes render baru — logikanya sudah di `blokirTombolLabel` (Task 11)

**Interfaces:**
- Consumes: `aksiBlokir` (Task 11); `blokirErrorMessage`, `blokirTombolLabel` (Task 11).

- [ ] **Step 1: Tambahkan medan `sudahKublokir` ke respons profil**

Di `apps/api/src/routes/profile.ts`, di cabang yang sudah terbukti lewat `LihatProfil` — tempat `sudahKutandai` dan `salingMenandai` dihasilkan — tambahkan:

```ts
      sudahKublokir: await deps.blokir.adaBlokir(pemanggil, addr),
```

**Hanya di cabang terbukti**, sama seperti dua bendera pribadi lain: siapa yang memblokir siapa bukan informasi publik. Tanpa bukti, kuncinya HILANG — bukan `false`, karena `false` adalah klaim dan ketiadaan kunci adalah kebenaran.

Tambahkan tes di `apps/api/test/profile-meet.route.test.ts` yang membuktikan kuncinya tidak ada tanpa bukti dan ada dengan bukti.

- [ ] **Step 2: Tambahkan tombol di layar profil**

```tsx
      {p.sudahKublokir !== undefined && !isOwnProfile && (
        <View style={s.section}>
          <Button
            title={blokirTombolLabel(p.sudahKublokir, blokirBusy)}
            disabled={blokirBusy}
            onPress={() => { void toggleBlokir(); }}
          />
          {p.sudahKublokir && (
            <Text style={s.catatan}>
              Kamu memblokir orang ini. Kalian tidak saling muncul di feed, dan tidak bisa saling menandai.
            </Text>
          )}
          {blokirMessage && <Text style={s.pesan}>{blokirMessage}</Text>}
        </View>
      )}
```

dengan handler yang mengikuti pola `toggleTanda` yang sudah ada di berkas itu: bersihkan pesan di awal, jaga ketukan ganda dengan `blokirBusy`, pisahkan galat aksi dari galat muat ulang, dan jangan pernah mengatakan "gagal memblokir" untuk blokir yang sebenarnya berhasil.

**`sudahKublokir !== undefined`, bukan cek truthiness.** Melonggarkannya membuat "tidak diketahui" diam-diam jadi "belum diblokir", dan layar akan mengklaim fakta yang tidak dimilikinya.

- [ ] **Step 3: Jalankan tes dan typecheck**

Run: `pnpm -r test && pnpm -r typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/profile.ts apps/mobile/app/profile/ apps/api/test/
git commit -m "feat(mobile): tombol blokir dan tandanya di layar profil"
```

---

## Task 14: Perbaiki spec induk, verifikasi batas global, serah terima

**Files:**
- Modify: `docs/superpowers/specs/2026-09-03-nearly-design.md`
- Apply: `supabase/migrations/0006_blokir.sql` (oleh pemilik project)

- [ ] **Step 1: Perbaiki urutan pengorbanan yang basi di §14.6**

Kalimatnya sekarang menyebut *"FYP (Fase 5) dulu, lalu vouch/tag di Fase 2"*. FYP sudah dibangun sebagai Fase 3b dan tergabung. Ganti dengan urutan yang berlaku: **4b (radar & visibilitas) yang pertama dikorbankan**, lalu vouch/tag. Catat juga bahwa Fase 4 dipecah tiga (spec 4a §1).

- [ ] **Step 2: Jalankan verifikasi batas global dan laporkan keluarannya apa adanya**

```bash
BASE=$(git merge-base main HEAD)
git diff --stat "$BASE"..HEAD -- packages/trust          # WAJIB kosong
git diff --stat "$BASE"..HEAD -- packages/contracts      # WAJIB kosong
grep -rn "TODO Task 10" apps/                            # WAJIB kosong
grep -rn "blocked: false" apps/api/src/trust/            # WAJIB kosong
grep -rn "await recover[A-Za-z]*Signer(" apps/api/src | grep -v pulihkanTandaTangan   # WAJIB kosong

# Dua permukaan yang spec §5.4 dan §5.5 nyatakan SENGAJA tidak disentuh.
# Tanpa pemeriksaan ini, "tidak diubah" cuma niat, bukan fakta yang terbukti.
git diff --stat "$BASE"..HEAD -- apps/api/src/handshake-gate.ts   # WAJIB kosong
git diff --stat "$BASE"..HEAD -- apps/api/src/routes/report.ts    # WAJIB kosong

pnpm -r test && pnpm -r typecheck
```

**Kalau ada yang gagal, laporkan dan berhenti.** Jangan menyesuaikan perintahnya sampai lulus — perintah verifikasi yang disetel sampai hijau tidak memverifikasi apa pun.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-09-03-nearly-design.md
git commit -m "docs: perbaiki urutan pengorbanan §14.6 yang basi setelah 3b"
```

- [ ] **Step 4: Serahkan ke pemilik project**

1. **Terapkan `supabase/migrations/0006_blokir.sql`** lewat Supabase SQL Editor.

2. **Uji jalur lengkap** dari dua dompet:
   - A memblokir B dari layar profil B → angka "ingin bertemu" B turun kalau A pernah menandainya
   - Unggahan B hilang dari feed A, **dan** unggahan A hilang dari feed B
   - A mencoba menandai B → ditolak `terblokir`
   - Daftar blokir A memuat B; mencabutnya mengembalikan semuanya, **termasuk tanda dari kedua arah**
   - Setelah handshake atau vouch mana pun memicu recompute, skor trust berubah karena edge-nya putus

3. **Uji penjaga privasi lewat curl**, karena inilah yang tidak bisa dibuktikan tes:
   - `GET /blokir` tanpa tanda tangan → **403**, bukan daftar kosong
   - `GET /blokir` dengan tanda tangan `LihatKecocokan` → **403**
   - `GET /profile/<alamat>` tanpa bukti → `sudahKublokir` **TIDAK ADA**
   - `POST /blokir` dengan `target` sama dengan `who` → **400** `blokir_diri`
   - `POST /blokir` dengan tanda tangan `0x` + 130 karakter `9` → **401**, bukan 500

Setelah lolos, `superpowers:finishing-a-development-branch` memutuskan integrasi ke `main`.
