# Nearly Fase 3a — Event & Kehadiran Terverifikasi: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Seseorang bisa membuat event, orang lain RSVP, dan check-in hanya berhasil kalau ia memindai QR host **dan** berada di dalam geofence saat acara berlangsung — tercatat on-chain.

**Architecture:** Logika murni (geofence, jendela waktu, EIP-712) di `packages/shared`; seluruh aturan penolakan di `apps/api/src/event-gate.ts` yang diuji dengan store palsu; penyimpanan di `apps/api/src/event-store.ts`; kontrak `AttendanceRegistry` meniru pola dua-tanda-tangan `ConnectionRegistry`. `packages/trust` tidak tersentuh — peralihan `occasionId` dari tebakan geohash ke event terverifikasi terkurung di `apps/api/src/trust/load-graph.ts`.

**Tech Stack:** TypeScript, pnpm workspace, Hono, Supabase (Postgres), viem, Zod, Vitest, Foundry (Solidity 0.8.24), Expo / React Native / Expo Router.

**Spec:** `docs/superpowers/specs/2026-09-05-nearly-fase-3a-event-design.md`

## Global Constraints

Nilai-nilai berikut berlaku di **setiap** task. Disalin apa adanya dari spec dan dari aturan repo Fase 1–2.

- **Bahasa.** Seluruh komentar kode, pesan commit, pesan error yang dilihat pengguna, dan nama test ditulis dalam **bahasa Indonesia**. Ikuti gaya berkas yang sudah ada.
- **Import relatif ditulis TANPA ekstensi** (`from "./geofence"`, bukan `"./geofence.js"`). Metro tidak memetakan `"./x.js"` ke `x.ts`, dan build mobile akan gagal.
- **Signer tidak boleh dibuat di badan komponen React.** Bungkus dengan `useMemo`, lihat `apps/mobile/app/qr.tsx:11`.
- **Satuan waktu.** `expiresAt`, `startsAt`, `endsAt` = unix **DETIK**, dibawa sebagai `bigint` di TypeScript dan `string` di JSON. `atMs` = **MILIDETIK** dari `Date.now()`. Jangan pernah membandingkan keduanya tanpa konversi eksplisit.
- **Chain.** BSC testnet, `chainId 97` (`NEARLY_CHAIN_ID` di `packages/shared/src/handshake.ts`). Bukan opBNB.
- **Domain EIP-712** selalu `{ name: "Nearly", version: "1", chainId: 97, verifyingContract }`.
- **Setiap pihak mengirim `cell` dan `atMs` MILIKNYA SENDIRI.** Tidak ada endpoint yang menerima klaim lokasi atas nama orang lain.
- **Jangan menyebut hasil check-in sebagai SBT, NFT, atau POAP.** Sebutnya **"catatan kehadiran on-chain"** (spec §2.3).
- **Geohash presisi 7** (`GEOHASH_PRECISION`). Server tidak pernah menerima maupun menyimpan lat/lon.
- **RLS menyala tanpa policy publik** di setiap tabel baru; API mengaksesnya lewat service role key.
- **`packages/trust` tidak boleh disentuh** oleh task mana pun dalam rencana ini.

---

## Struktur Berkas

**Dibuat:**

| Berkas | Tanggung jawab |
|---|---|
| `packages/shared/src/geofence.ts` | Sel geofence, uji "di dalam", uji "sedang berlangsung". Murni |
| `packages/shared/src/event.ts` | Empat tipe EIP-712 event + konversi sel ↔ bytes32. Murni |
| `packages/contracts/src/AttendanceRegistry.sol` | Event & kehadiran on-chain |
| `packages/contracts/test/AttendanceRegistry.t.sol` | Uji kontrak |
| `supabase/migrations/0003_events.sql` | Empat tabel |
| `apps/api/src/event-gate.ts` | Seluruh aturan penolakan. Tanpa I/O langsung |
| `apps/api/src/event-store.ts` | Implementasi `EventStore` di atas Supabase |
| `apps/api/src/attendance-relayer.ts` | Pengiriman transaksi ke `AttendanceRegistry` |
| `apps/api/src/routes/events.ts` | Tujuh endpoint |
| `apps/mobile/src/events-api.ts` | Klien HTTP untuk endpoint event |
| `apps/mobile/src/events/useCheckInQr.ts` | Rotasi QR check-in milik host |
| `apps/mobile/app/events/index.tsx` | Discovery |
| `apps/mobile/app/events/new.tsx` | Buat event |
| `apps/mobile/app/events/[id].tsx` | Detail + RSVP + check-in |
| `apps/mobile/app/events/[id]/host-qr.tsx` | QR check-in host |

**Diubah:**

| Berkas | Perubahan |
|---|---|
| `packages/shared/src/index.ts` | Ekspor dua modul baru |
| `packages/shared/src/schema.ts` | Lima skema Zod baru |
| `packages/contracts/script/Deploy.s.sol` | Kontrak keempat |
| `apps/api/src/ports.ts` | `EventStore`, `AttendanceChainPort`, baris-baris terkait |
| `apps/api/src/abi.ts` | `ATTENDANCE_REGISTRY_ABI` |
| `apps/api/src/app.ts` | Pasang `eventRoutes` |
| `apps/api/src/index.ts` | Rangkai store, relayer, env baru |
| `apps/api/src/trust/load-graph.ts` | `occasionId` dari check-in terverifikasi |
| `apps/api/src/trust/store.ts` | `loadGraph` ikut membaca `checkins` & `events` |
| `apps/mobile/app/_layout.tsx` | Daftarkan rute event |
| `apps/mobile/app/scan.tsx` | Kenali QR check-in, bukan hanya QR handshake |

---

## Task 1: Geofence & jendela waktu

**Files:**
- Create: `packages/shared/src/geofence.ts`
- Create: `packages/shared/test/geofence.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `neighborCells(cell: string): string[]` dari `packages/shared/src/geohash.ts`.
- Produces: `geofenceCells(centerCell: string): string[]`, `isInsideGeofence(centerCell: string, deviceCell: string): boolean`, `isEventLive(startsAt: bigint, endsAt: bigint, atMs: number): boolean`, `GEOFENCE_SPAN_M = 460`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `packages/shared/test/geofence.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { geofenceCells, isInsideGeofence, isEventLive } from "../src/geofence";
import { neighborCells } from "../src/geohash";

const CENTER = "qqguv1r";

describe("geofenceCells", () => {
  it("berisi sel pusat dan kedelapan tetangganya", () => {
    const cells = geofenceCells(CENTER);
    expect(cells).toHaveLength(9);
    expect(cells).toContain(CENTER);
    for (const n of neighborCells(CENTER)) expect(cells).toContain(n);
  });

  it("tidak mengandung duplikat", () => {
    expect(new Set(geofenceCells(CENTER)).size).toBe(9);
  });
});

describe("isInsideGeofence", () => {
  it("sel pusat ada di dalam", () => {
    expect(isInsideGeofence(CENTER, CENTER)).toBe(true);
  });

  it("kedelapan tetangga ada di dalam", () => {
    for (const n of neighborCells(CENTER)) {
      expect(isInsideGeofence(CENTER, n)).toBe(true);
    }
  });

  it("sel yang jauh ada di luar", () => {
    expect(isInsideGeofence(CENTER, "w1xyz00")).toBe(false);
  });

  // Batas yang paling mudah salah: geofence berhenti di cincin PERTAMA.
  // Tetangga-dari-tetangga sudah di luar, dan kalau ini lolos berarti
  // areanya diam-diam jadi 3x lebih lebar dari yang ditulis spec.
  it("tetangga dari tetangga sudah di luar", () => {
    const ring1 = neighborCells(CENTER);
    const ring2 = ring1
      .flatMap((c) => neighborCells(c))
      .filter((c) => c !== CENTER && !ring1.includes(c));
    expect(ring2.length).toBeGreaterThan(0);
    for (const c of ring2) expect(isInsideGeofence(CENTER, c)).toBe(false);
  });
});

describe("isEventLive", () => {
  const starts = 1_700_000_000n;
  const ends = 1_700_003_600n;

  it("detik pertama termasuk", () => {
    expect(isEventLive(starts, ends, Number(starts) * 1000)).toBe(true);
  });

  it("detik terakhir termasuk", () => {
    expect(isEventLive(starts, ends, Number(ends) * 1000)).toBe(true);
  });

  it("satu detik sebelum mulai belum termasuk", () => {
    expect(isEventLive(starts, ends, (Number(starts) - 1) * 1000)).toBe(false);
  });

  it("satu detik setelah selesai sudah tidak termasuk", () => {
    expect(isEventLive(starts, ends, (Number(ends) + 1) * 1000)).toBe(false);
  });

  // atMs MILIDETIK, startsAt DETIK. Kalau konversinya lupa, milidetik akan
  // selalu jauh lebih besar dari detik dan SEMUA event tampak sudah selesai.
  it("milidetik di tengah detik mulai tetap dihitung sudah mulai", () => {
    expect(isEventLive(starts, ends, Number(starts) * 1000 + 999)).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
pnpm --filter @nearly/shared test geofence
```

Diharapkan: FAIL, `Failed to resolve import "../src/geofence"`.

- [ ] **Step 3: Tulis implementasi minimal**

Buat `packages/shared/src/geofence.ts`:

```ts
import { neighborCells } from "./geohash";

/**
 * Sel geohash7 ≈153 m; pusat + 8 tetangga membentuk kotak 3x3 ≈460 m.
 * Angka ini muncul di layar buat-event, jadi ia hidup di satu tempat saja.
 */
export const GEOFENCE_SPAN_M = 460;

/**
 * Geofence sebuah event: sel tempat host berdiri, plus cincin pertama.
 *
 * Cincin pertama diikutkan karena alasan yang sama seperti di colocation.ts —
 * dua orang berdiri berdampingan bisa jatuh di sel berbeda kalau kebetulan
 * persis di garis batas. Tanpa toleransi ini, check-in akan gagal secara acak
 * bagi orang yang berdiri di pinggir ruangan.
 */
export function geofenceCells(centerCell: string): string[] {
  return [centerCell, ...neighborCells(centerCell)];
}

export function isInsideGeofence(centerCell: string, deviceCell: string): boolean {
  return geofenceCells(centerCell).includes(deviceCell);
}

/**
 * `startsAt`/`endsAt` unix DETIK (satuan yang sama dengan kontrak), `atMs`
 * MILIDETIK. Konversinya eksplisit di sini supaya tidak ada pemanggil yang
 * perlu memikirkannya.
 *
 * Kedua ujung INKLUSIF, sama dengan penjagaan di AttendanceRegistry.checkIn.
 */
export function isEventLive(startsAt: bigint, endsAt: bigint, atMs: number): boolean {
  const atSec = Math.floor(atMs / 1000);
  return atSec >= Number(startsAt) && atSec <= Number(endsAt);
}
```

- [ ] **Step 4: Ekspor dari index**

Tambahkan ke `packages/shared/src/index.ts`, setelah baris `export * from "./colocation";`:

```ts
export * from "./geofence";
```

- [ ] **Step 5: Jalankan test, pastikan lulus**

```bash
pnpm --filter @nearly/shared test geofence
```

Diharapkan: PASS, 11 test.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/geofence.ts packages/shared/test/geofence.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): geofence sel geohash + uji jendela waktu event"
```

---

## Task 2: Tipe EIP-712 event

**Files:**
- Create: `packages/shared/src/event.ts`
- Create: `packages/shared/test/event.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `NEARLY_CHAIN_ID` dari `packages/shared/src/handshake.ts`.
- Produces:
  - Tipe: `CreateEventMessage`, `CheckInOfferMessage`, `CheckInAcceptMessage`, `RsvpMessage`
  - `EVENT_TYPES` (dipakai test kunci di Task 3)
  - `cellToBytes32(cell: string): Hex`, `bytes32ToCell(b: Hex): string`
  - `createEventTypedData(msg, verifyingContract)`, `checkInOfferTypedData`, `checkInAcceptTypedData`, `rsvpTypedData`
  - `recoverCreateEventSigner(msg, sig, verifyingContract): Promise<Address>`, `recoverCheckInOfferSigner`, `recoverCheckInAcceptSigner`, `recoverRsvpSigner`
  - `makeEventId(): Hex`

- [ ] **Step 1: Tulis test yang gagal**

Buat `packages/shared/test/event.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  bytes32ToCell, cellToBytes32, checkInAcceptTypedData, checkInOfferTypedData,
  createEventTypedData, makeEventId, recoverCheckInAcceptSigner,
  recoverCheckInOfferSigner, recoverCreateEventSigner, recoverRsvpSigner, rsvpTypedData,
} from "../src/event";

const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const account = privateKeyToAccount(PK);
const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;
const EVENT_ID = "0x1111111111111111111111111111111111111111111111111111111111111111" as Hex;
const NONCE = "0x2222222222222222222222222222222222222222222222222222222222222222" as Hex;
const EXPIRES = 1_700_000_030n;

describe("cellToBytes32", () => {
  it("bolak-balik menghasilkan sel yang sama", () => {
    expect(bytes32ToCell(cellToBytes32("qqguv1r"))).toBe("qqguv1r");
  });

  it("hasilnya bytes32 yang sah", () => {
    expect(cellToBytes32("qqguv1r")).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("sel berbeda menghasilkan bytes32 berbeda", () => {
    expect(cellToBytes32("qqguv1r")).not.toBe(cellToBytes32("qqguv1s"));
  });
});

describe("makeEventId", () => {
  it("berbentuk bytes32", () => {
    expect(makeEventId()).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("dua panggilan tidak menghasilkan id yang sama", () => {
    expect(makeEventId()).not.toBe(makeEventId());
  });
});

describe("tanda tangan CreateEvent", () => {
  const msg = {
    eventId: EVENT_ID,
    host: account.address,
    startsAt: 1_700_000_000n,
    endsAt: 1_700_003_600n,
    centerCell: cellToBytes32("qqguv1r"),
    expiresAt: EXPIRES,
  };

  it("pulih ke penandatangan", async () => {
    const sig = await account.signTypedData(createEventTypedData(msg, CONTRACT));
    expect(await recoverCreateEventSigner(msg, sig, CONTRACT)).toBe(account.address);
  });

  // Domain terikat ke alamat kontrak. Tanda tangan untuk satu kontrak tidak
  // boleh berlaku di kontrak lain — tanpa ini, tanda tangan vouch bisa diputar
  // ulang ke AttendanceRegistry.
  it("tidak pulih ke penandatangan kalau verifyingContract berbeda", async () => {
    const sig = await account.signTypedData(createEventTypedData(msg, CONTRACT));
    const other = "0x00000000000000000000000000000000000dead0" as Address;
    expect(await recoverCreateEventSigner(msg, sig, other)).not.toBe(account.address);
  });

  it("tidak pulih ke penandatangan kalau waktu mulai diubah", async () => {
    const sig = await account.signTypedData(createEventTypedData(msg, CONTRACT));
    const tampered = { ...msg, startsAt: msg.startsAt + 1n };
    expect(await recoverCreateEventSigner(tampered, sig, CONTRACT)).not.toBe(account.address);
  });
});

describe("tanda tangan CheckInOffer", () => {
  const msg = { eventId: EVENT_ID, nonce: NONCE, expiresAt: EXPIRES };

  it("pulih ke penandatangan", async () => {
    const sig = await account.signTypedData(checkInOfferTypedData(msg, CONTRACT));
    expect(await recoverCheckInOfferSigner(msg, sig, CONTRACT)).toBe(account.address);
  });

  // Kalau eventId tidak ikut ditandatangani, QR check-in untuk event A bisa
  // dipakai ulang di event B milik host yang sama.
  it("tidak pulih kalau eventId ditukar", async () => {
    const sig = await account.signTypedData(checkInOfferTypedData(msg, CONTRACT));
    const other = { ...msg, eventId: NONCE };
    expect(await recoverCheckInOfferSigner(other, sig, CONTRACT)).not.toBe(account.address);
  });
});

describe("tanda tangan CheckInAccept", () => {
  const msg = {
    eventId: EVENT_ID, nonce: NONCE, attendee: account.address, expiresAt: EXPIRES,
  };

  it("pulih ke penandatangan", async () => {
    const sig = await account.signTypedData(checkInAcceptTypedData(msg, CONTRACT));
    expect(await recoverCheckInAcceptSigner(msg, sig, CONTRACT)).toBe(account.address);
  });

  it("tidak pulih kalau attendee ditukar", async () => {
    const sig = await account.signTypedData(checkInAcceptTypedData(msg, CONTRACT));
    const other = { ...msg, attendee: "0x000000000000000000000000000000000000beef" as Address };
    expect(await recoverCheckInAcceptSigner(other, sig, CONTRACT)).not.toBe(account.address);
  });
});

describe("tanda tangan Rsvp", () => {
  const msg = { eventId: EVENT_ID, who: account.address, expiresAt: EXPIRES };

  it("pulih ke penandatangan", async () => {
    const sig = await account.signTypedData(rsvpTypedData(msg, CONTRACT));
    expect(await recoverRsvpSigner(msg, sig, CONTRACT)).toBe(account.address);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
pnpm --filter @nearly/shared test event
```

Diharapkan: FAIL, `Failed to resolve import "../src/event"`.

- [ ] **Step 3: Tulis implementasi**

Buat `packages/shared/src/event.ts`:

```ts
import {
  bytesToHex, hexToString, pad, recoverTypedDataAddress, stringToHex,
  type Address, type Hex,
} from "viem";
import { NEARLY_CHAIN_ID } from "./handshake";

export type CreateEventMessage = {
  eventId: Hex;
  host: Address;
  startsAt: bigint;
  endsAt: bigint;
  centerCell: Hex;
  expiresAt: bigint;
};

export type CheckInOfferMessage = { eventId: Hex; nonce: Hex; expiresAt: bigint };

export type CheckInAcceptMessage = {
  eventId: Hex; nonce: Hex; attendee: Address; expiresAt: bigint;
};

/**
 * RSVP TIDAK PERNAH naik on-chain — karena itu `Rsvp` tidak punya pasangan
 * typehash di Solidity, dan test kunci di Task 3 sengaja tidak memeriksanya.
 * Tanda tangannya tetap ada supaya `who` tidak datang telanjang dari body
 * request; tanpa itu siapa pun bisa mengarang RSVP atas nama orang lain, dan
 * karena RSVP adalah syarat check-in, itu berarti mengarang syarat orang lain.
 */
export type RsvpMessage = { eventId: Hex; who: Address; expiresAt: bigint };

// TIGA yang pertama WAJIB identik kata-per-kata dengan typehash di
// packages/contracts/src/AttendanceRegistry.sol. Dijaga test kunci di Task 3.
const TYPES = {
  CreateEvent: [
    { name: "eventId", type: "bytes32" },
    { name: "host", type: "address" },
    { name: "startsAt", type: "uint64" },
    { name: "endsAt", type: "uint64" },
    { name: "centerCell", type: "bytes32" },
    { name: "expiresAt", type: "uint64" },
  ],
  CheckInOffer: [
    { name: "eventId", type: "bytes32" },
    { name: "nonce", type: "bytes32" },
    { name: "expiresAt", type: "uint64" },
  ],
  CheckInAccept: [
    { name: "eventId", type: "bytes32" },
    { name: "nonce", type: "bytes32" },
    { name: "attendee", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
  Rsvp: [
    { name: "eventId", type: "bytes32" },
    { name: "who", type: "address" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export const EVENT_TYPES = TYPES;

function domain(verifyingContract: Address) {
  return { name: "Nearly", version: "1", chainId: NEARLY_CHAIN_ID, verifyingContract } as const;
}

/**
 * Sel geohash7 dijejalkan ke satu bytes32 sebagai ASCII rata kiri.
 *
 * Disimpan apa adanya, bukan hash-nya: venue event memang informasi publik
 * (spec §7.1), jadi meng-hash tidak melindungi apa pun sementara kemampuan
 * orang luar mengaudit geofence hilang percuma.
 */
export function cellToBytes32(cell: string): Hex {
  return pad(stringToHex(cell), { size: 32, dir: "right" });
}

export function bytes32ToCell(b: Hex): string {
  return hexToString(b).replace(/\0+$/, "");
}

export function makeEventId(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToHex(bytes);
}

export function createEventTypedData(msg: CreateEventMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { CreateEvent: TYPES.CreateEvent },
    primaryType: "CreateEvent",
    message: msg,
  } as const;
}

export function checkInOfferTypedData(msg: CheckInOfferMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { CheckInOffer: TYPES.CheckInOffer },
    primaryType: "CheckInOffer",
    message: msg,
  } as const;
}

export function checkInAcceptTypedData(msg: CheckInAcceptMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { CheckInAccept: TYPES.CheckInAccept },
    primaryType: "CheckInAccept",
    message: msg,
  } as const;
}

export function rsvpTypedData(msg: RsvpMessage, verifyingContract: Address) {
  return {
    domain: domain(verifyingContract),
    types: { Rsvp: TYPES.Rsvp },
    primaryType: "Rsvp",
    message: msg,
  } as const;
}

export function recoverCreateEventSigner(
  msg: CreateEventMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...createEventTypedData(msg, verifyingContract), signature });
}

export function recoverCheckInOfferSigner(
  msg: CheckInOfferMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...checkInOfferTypedData(msg, verifyingContract), signature });
}

export function recoverCheckInAcceptSigner(
  msg: CheckInAcceptMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...checkInAcceptTypedData(msg, verifyingContract), signature });
}

export function recoverRsvpSigner(
  msg: RsvpMessage, signature: Hex, verifyingContract: Address,
): Promise<Address> {
  return recoverTypedDataAddress({ ...rsvpTypedData(msg, verifyingContract), signature });
}
```

- [ ] **Step 4: Ekspor dari index**

Tambahkan ke `packages/shared/src/index.ts`, setelah `export * from "./vouch";`:

```ts
export * from "./event";
```

- [ ] **Step 5: Jalankan test, pastikan lulus**

```bash
pnpm --filter @nearly/shared test event
```

Diharapkan: PASS, 12 test.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/event.ts packages/shared/test/event.test.ts packages/shared/src/index.ts
git commit -m "feat(shared): tipe EIP-712 CreateEvent, CheckInOffer, CheckInAccept, Rsvp"
```

---

## Task 3: Kontrak `AttendanceRegistry`

**Files:**
- Create: `packages/contracts/src/AttendanceRegistry.sol`
- Create: `packages/contracts/test/AttendanceRegistry.t.sol`
- Create: `packages/shared/test/event-typehash.test.ts`
- Modify: `packages/contracts/script/Deploy.s.sol`

**Interfaces:**
- Consumes: `EVENT_TYPES` dari Task 2 (dipakai test kunci).
- Produces: kontrak dengan fungsi `createEvent(bytes32,address,uint64,uint64,bytes32,uint64,bytes)`, `checkIn(bytes32,address,bytes32,uint64,bytes,bytes)`, getter publik `events(bytes32)`, `attendedAt(bytes32,address)`, `usedNonce(bytes32)`, `DOMAIN_SEPARATOR()`, `attestor()`.

- [ ] **Step 1: Tulis test kontrak yang gagal**

Buat `packages/contracts/test/AttendanceRegistry.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AttendanceRegistry} from "../src/AttendanceRegistry.sol";

contract AttendanceRegistryTest is Test {
    AttendanceRegistry reg;

    address attestor = address(0xA77E);
    uint256 pkHost = 0x8057;
    uint256 pkGuest = 0x6DE57;
    address host;
    address guest;

    bytes32 constant EVENT_ID = keccak256("event-1");
    bytes32 constant NONCE = keccak256("nonce-1");
    // Literal string rata-kiri, cocok dengan pad(dir:"right") di cellToBytes32.
    // bytes32(bytes("...")) TIDAK sah: bytes dinamis tidak bisa dikonversi ke bytes32.
    bytes32 constant CELL = "qqguv1r";

    uint64 startsAt;
    uint64 endsAt;
    uint64 expiresAt;

    function setUp() public {
        host = vm.addr(pkHost);
        guest = vm.addr(pkGuest);
        reg = new AttendanceRegistry(attestor);

        startsAt = uint64(block.timestamp);
        endsAt = uint64(block.timestamp + 3 hours);
        expiresAt = uint64(block.timestamp + 1 hours);
        _createEvent();
    }

    function _sign(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _eip712(bytes32 structHash) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", reg.DOMAIN_SEPARATOR(), structHash));
    }

    function _createDigest() internal view returns (bytes32) {
        return _eip712(keccak256(abi.encode(
            keccak256(
                "CreateEvent(bytes32 eventId,address host,uint64 startsAt,uint64 endsAt,bytes32 centerCell,uint64 expiresAt)"
            ),
            EVENT_ID, host, startsAt, endsAt, CELL, expiresAt
        )));
    }

    function _offerDigest(bytes32 nonce) internal view returns (bytes32) {
        return _eip712(keccak256(abi.encode(
            keccak256("CheckInOffer(bytes32 eventId,bytes32 nonce,uint64 expiresAt)"),
            EVENT_ID, nonce, expiresAt
        )));
    }

    function _acceptDigest(bytes32 nonce, address attendee) internal view returns (bytes32) {
        return _eip712(keccak256(abi.encode(
            keccak256("CheckInAccept(bytes32 eventId,bytes32 nonce,address attendee,uint64 expiresAt)"),
            EVENT_ID, nonce, attendee, expiresAt
        )));
    }

    function _createEvent() internal {
        vm.prank(attestor);
        reg.createEvent(
            EVENT_ID, host, startsAt, endsAt, CELL, expiresAt, _sign(pkHost, _createDigest())
        );
    }

    function _checkIn(bytes32 nonce) internal {
        vm.prank(attestor);
        reg.checkIn(
            EVENT_ID, guest, nonce, expiresAt,
            _sign(pkHost, _offerDigest(nonce)),
            _sign(pkGuest, _acceptDigest(nonce, guest))
        );
    }

    function test_eventTercatat() public view {
        (address h, uint64 s, uint64 e, bytes32 c) = reg.events(EVENT_ID);
        assertEq(h, host);
        assertEq(s, startsAt);
        assertEq(e, endsAt);
        assertEq(c, CELL);
    }

    function test_checkInMencatatWaktu() public {
        _checkIn(NONCE);
        assertEq(reg.attendedAt(EVENT_ID, guest), uint64(block.timestamp));
    }

    function test_bukanAttestorDitolak() public {
        vm.expectRevert(AttendanceRegistry.NotAttestor.selector);
        reg.checkIn(EVENT_ID, guest, NONCE, expiresAt, hex"00", hex"00");
    }

    function test_eventGandaDitolak() public {
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.EventExists.selector);
        reg.createEvent(
            EVENT_ID, host, startsAt, endsAt, CELL, expiresAt, _sign(pkHost, _createDigest())
        );
    }

    function test_jendelaTerbalikDitolak() public {
        bytes32 id = keccak256("event-2");
        bytes32 digest = _eip712(keccak256(abi.encode(
            keccak256(
                "CreateEvent(bytes32 eventId,address host,uint64 startsAt,uint64 endsAt,bytes32 centerCell,uint64 expiresAt)"
            ),
            id, host, endsAt, startsAt, CELL, expiresAt
        )));
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.BadWindow.selector);
        reg.createEvent(id, host, endsAt, startsAt, CELL, expiresAt, _sign(pkHost, digest));
    }

    function test_checkInKeEventTakDikenalDitolak() public {
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.EventUnknown.selector);
        reg.checkIn(
            keccak256("hantu"), guest, NONCE, expiresAt,
            _sign(pkHost, _offerDigest(NONCE)),
            _sign(pkGuest, _acceptDigest(NONCE, guest))
        );
    }

    function test_sebelumMulaiDitolak() public {
        // Event kedua yang baru mulai satu jam lagi.
        bytes32 id = keccak256("event-nanti");
        uint64 s = uint64(block.timestamp + 1 hours);
        uint64 e = uint64(block.timestamp + 2 hours);
        bytes32 createDigest = _eip712(keccak256(abi.encode(
            keccak256(
                "CreateEvent(bytes32 eventId,address host,uint64 startsAt,uint64 endsAt,bytes32 centerCell,uint64 expiresAt)"
            ),
            id, host, s, e, CELL, expiresAt
        )));
        vm.prank(attestor);
        reg.createEvent(id, host, s, e, CELL, expiresAt, _sign(pkHost, createDigest));

        bytes32 offerDigest = _eip712(keccak256(abi.encode(
            keccak256("CheckInOffer(bytes32 eventId,bytes32 nonce,uint64 expiresAt)"),
            id, NONCE, expiresAt
        )));
        bytes32 acceptDigest = _eip712(keccak256(abi.encode(
            keccak256("CheckInAccept(bytes32 eventId,bytes32 nonce,address attendee,uint64 expiresAt)"),
            id, NONCE, guest, expiresAt
        )));
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.NotLive.selector);
        reg.checkIn(
            id, guest, NONCE, expiresAt,
            _sign(pkHost, offerDigest), _sign(pkGuest, acceptDigest)
        );
    }

    function test_setelahSelesaiDitolak() public {
        vm.warp(endsAt + 1);
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.NotLive.selector);
        reg.checkIn(
            EVENT_ID, guest, NONCE, expiresAt,
            _sign(pkHost, _offerDigest(NONCE)),
            _sign(pkGuest, _acceptDigest(NONCE, guest))
        );
    }

    function test_tandaTanganHostPalsuDitolak() public {
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.BadSignature.selector);
        reg.checkIn(
            EVENT_ID, guest, NONCE, expiresAt,
            _sign(pkGuest, _offerDigest(NONCE)), // ditandatangani tamu, bukan host
            _sign(pkGuest, _acceptDigest(NONCE, guest))
        );
    }

    function test_tandaTanganTamuPalsuDitolak() public {
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.BadSignature.selector);
        reg.checkIn(
            EVENT_ID, guest, NONCE, expiresAt,
            _sign(pkHost, _offerDigest(NONCE)),
            _sign(pkHost, _acceptDigest(NONCE, guest)) // ditandatangani host, bukan tamu
        );
    }

    function test_nonceDipakaiUlangDitolak() public {
        _checkIn(NONCE);
        address other = vm.addr(0xFEED);
        bytes memory sigOther = _sign(0xFEED, _acceptDigest(NONCE, other));
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.NonceUsed.selector);
        reg.checkIn(
            EVENT_ID, other, NONCE, expiresAt, _sign(pkHost, _offerDigest(NONCE)), sigOther
        );
    }

    function test_checkInKeduaDitolak() public {
        _checkIn(NONCE);
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.AlreadyCheckedIn.selector);
        reg.checkIn(
            EVENT_ID, guest, keccak256("nonce-2"), expiresAt,
            _sign(pkHost, _offerDigest(keccak256("nonce-2"))),
            _sign(pkGuest, _acceptDigest(keccak256("nonce-2"), guest))
        );
    }

    function test_kedaluwarsaDitolak() public {
        vm.warp(expiresAt + 1);
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.Expired.selector);
        reg.checkIn(
            EVENT_ID, guest, NONCE, expiresAt,
            _sign(pkHost, _offerDigest(NONCE)),
            _sign(pkGuest, _acceptDigest(NONCE, guest))
        );
    }

    // Tiap tanda tangan sah punya pasangan malleable yang memulihkan alamat
    // sama. Kalau tidak ditolak, satu persetujuan punya dua bentuk byte — dan
    // penjagaan nonce bisa dilewati dengan bentuk yang kedua.
    function test_tandaTanganMalleableDitolak() public {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pkGuest, _acceptDigest(NONCE, guest));
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes32 sFlipped = bytes32(n - uint256(s));
        uint8 vFlipped = v == 27 ? 28 : 27;
        vm.prank(attestor);
        vm.expectRevert(AttendanceRegistry.BadSignature.selector);
        reg.checkIn(
            EVENT_ID, guest, NONCE, expiresAt,
            _sign(pkHost, _offerDigest(NONCE)),
            abi.encodePacked(r, sFlipped, vFlipped)
        );
    }

    function test_attestorNolDitolak() public {
        vm.expectRevert(AttendanceRegistry.ZeroAddress.selector);
        new AttendanceRegistry(address(0));
    }
}
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
cd packages/contracts && forge test --match-contract AttendanceRegistryTest
```

Diharapkan: FAIL saat kompilasi, `Source "src/AttendanceRegistry.sol" not found`.

- [ ] **Step 3: Tulis kontrak**

Buat `packages/contracts/src/AttendanceRegistry.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * Event dan kehadiran terverifikasi.
 *
 * Pola dua tanda tangan diambil dari ConnectionRegistry, dan alasannya sama:
 * kehadiran adalah pertemuan antara DUA pihak, jadi keduanya harus menyetujui.
 * `sigHost` membuktikan host membuka pintu; `sigAttendee` membuktikan tamu
 * melangkah masuk. Relayer hanya membayar gas — ia tidak bisa mengarang event
 * atas nama orang lain, dan tidak bisa mencetak kehadiran orang yang tidak
 * menandatanganinya.
 *
 * YANG DITEGAKKAN KONTRAK: event harus ada, waktu harus di dalam jendela,
 * kedua tanda tangan sah dan tidak malleable, nonce sekali pakai, satu
 * kehadiran per orang per event, selamanya.
 *
 * YANG TIDAK DITEGAKKAN KONTRAK: geofence. Kontrak tidak punya cara mengetahui
 * di mana perangkat berada, jadi di situ server yang menjadi saksi (spec §7.2).
 * Jangan mengklaim geofence terjamin on-chain.
 */
contract AttendanceRegistry {
    error NotAttestor();
    error ZeroAddress();
    error EventExists();
    error EventUnknown();
    error BadWindow();
    error Expired();
    error BadSignature();
    error NotLive();
    error NonceUsed();
    error AlreadyCheckedIn();

    // WAJIB identik dengan EVENT_TYPES di packages/shared/src/event.ts.
    // Dijaga test kunci di packages/shared/test/event-typehash.test.ts.
    bytes32 private constant CREATE_EVENT_TYPEHASH = keccak256(
        "CreateEvent(bytes32 eventId,address host,uint64 startsAt,uint64 endsAt,bytes32 centerCell,uint64 expiresAt)"
    );
    bytes32 private constant CHECKIN_OFFER_TYPEHASH =
        keccak256("CheckInOffer(bytes32 eventId,bytes32 nonce,uint64 expiresAt)");
    bytes32 private constant CHECKIN_ACCEPT_TYPEHASH = keccak256(
        "CheckInAccept(bytes32 eventId,bytes32 nonce,address attendee,uint64 expiresAt)"
    );
    bytes32 private constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );

    bytes32 public immutable DOMAIN_SEPARATOR;
    address public immutable attestor;

    struct EventRecord {
        address host;
        uint64 startsAt;
        uint64 endsAt;
        bytes32 centerCell;
    }

    mapping(bytes32 => EventRecord) public events;
    /// eventId => hadir => detik unix. Nol berarti belum pernah hadir.
    mapping(bytes32 => mapping(address => uint64)) public attendedAt;
    mapping(bytes32 => bool) public usedNonce;

    event EventCreated(
        bytes32 indexed eventId, address indexed host, uint64 startsAt, uint64 endsAt
    );
    event CheckedIn(bytes32 indexed eventId, address indexed attendee, uint64 at);

    constructor(address _attestor) {
        if (_attestor == address(0)) revert ZeroAddress();
        attestor = _attestor;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                DOMAIN_TYPEHASH, keccak256("Nearly"), keccak256("1"), block.chainid, address(this)
            )
        );
    }

    function createEvent(
        bytes32 eventId,
        address host,
        uint64 startsAt,
        uint64 endsAt,
        bytes32 centerCell,
        uint64 expiresAt,
        bytes calldata sigHost
    ) external {
        if (msg.sender != attestor) revert NotAttestor();
        if (host == address(0)) revert BadSignature();
        if (endsAt <= startsAt) revert BadWindow();
        if (block.timestamp > expiresAt) revert Expired();
        if (events[eventId].host != address(0)) revert EventExists();

        bytes32 digest = _digest(
            keccak256(
                abi.encode(
                    CREATE_EVENT_TYPEHASH, eventId, host, startsAt, endsAt, centerCell, expiresAt
                )
            )
        );
        if (_recover(digest, sigHost) != host) revert BadSignature();

        events[eventId] =
            EventRecord({host: host, startsAt: startsAt, endsAt: endsAt, centerCell: centerCell});
        emit EventCreated(eventId, host, startsAt, endsAt);
    }

    function checkIn(
        bytes32 eventId,
        address attendee,
        bytes32 nonce,
        uint64 expiresAt,
        bytes calldata sigHost,
        bytes calldata sigAttendee
    ) external {
        if (msg.sender != attestor) revert NotAttestor();
        if (attendee == address(0)) revert BadSignature();

        EventRecord memory e = events[eventId];
        if (e.host == address(0)) revert EventUnknown();
        if (block.timestamp < e.startsAt || block.timestamp > e.endsAt) revert NotLive();
        if (block.timestamp > expiresAt) revert Expired();
        if (usedNonce[nonce]) revert NonceUsed();
        if (attendedAt[eventId][attendee] != 0) revert AlreadyCheckedIn();

        bytes32 offerDigest =
            _digest(keccak256(abi.encode(CHECKIN_OFFER_TYPEHASH, eventId, nonce, expiresAt)));
        if (_recover(offerDigest, sigHost) != e.host) revert BadSignature();

        bytes32 acceptDigest = _digest(
            keccak256(abi.encode(CHECKIN_ACCEPT_TYPEHASH, eventId, nonce, attendee, expiresAt))
        );
        if (_recover(acceptDigest, sigAttendee) != attendee) revert BadSignature();

        usedNonce[nonce] = true;
        attendedAt[eventId][attendee] = uint64(block.timestamp);
        emit CheckedIn(eventId, attendee, uint64(block.timestamp));
    }

    function hasAttended(bytes32 eventId, address who) external view returns (bool) {
        return attendedAt[eventId][who] != 0;
    }

    function _digest(bytes32 structHash) private view returns (bytes32) {
        return keccak256(abi.encodePacked(hex"1901", DOMAIN_SEPARATOR, structHash));
    }

    /// Setengah orde kurva secp256k1. Di atas ini, tanda tangan malleable.
    uint256 private constant HALF_N =
        0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    function _recover(bytes32 digest, bytes calldata sig) private pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (v < 27) v += 27;
        if (uint256(s) > HALF_N) return address(0);
        return ecrecover(digest, v, r, s);
    }
}
```

- [ ] **Step 4: Jalankan test kontrak, pastikan lulus**

```bash
cd packages/contracts && forge test --match-contract AttendanceRegistryTest -vv
```

Diharapkan: PASS, 14 test.

- [ ] **Step 5: Tulis test kunci TS ↔ Solidity yang gagal**

Buat `packages/shared/test/event-typehash.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { keccak256, toHex } from "viem";
import { EVENT_TYPES } from "../src/index";

const SOL = fileURLToPath(
  new URL("../../contracts/src/AttendanceRegistry.sol", import.meta.url),
);

function encodeType(name: keyof typeof EVENT_TYPES): string {
  const fields = EVENT_TYPES[name].map((f) => `${f.type} ${f.name}`).join(",");
  return `${name}(${fields})`;
}

function typehashLiteral(source: string, constantName: string): string {
  const re = new RegExp(`${constantName}[^=]*=\\s*keccak256\\(\\s*"([^"]+)"`, "m");
  const m = source.match(re);
  if (!m) throw new Error(`typehash ${constantName} tidak ada di AttendanceRegistry.sol`);
  return m[1]!;
}

describe("kunci EIP-712 TS <-> Solidity untuk event", () => {
  const sol = readFileSync(SOL, "utf8");

  it("string tipe CreateEvent identik di kedua sisi", () => {
    expect(typehashLiteral(sol, "CREATE_EVENT_TYPEHASH")).toBe(encodeType("CreateEvent"));
  });

  it("string tipe CheckInOffer identik di kedua sisi", () => {
    expect(typehashLiteral(sol, "CHECKIN_OFFER_TYPEHASH")).toBe(encodeType("CheckInOffer"));
  });

  it("string tipe CheckInAccept identik di kedua sisi", () => {
    expect(typehashLiteral(sol, "CHECKIN_ACCEPT_TYPEHASH")).toBe(encodeType("CheckInAccept"));
  });

  it("hash CheckInAccept pun identik, bukan cuma stringnya", () => {
    expect(keccak256(toHex(typehashLiteral(sol, "CHECKIN_ACCEPT_TYPEHASH"))))
      .toBe(keccak256(toHex(encodeType("CheckInAccept"))));
  });

  it("domain di kontrak memakai nama dan versi yang sama dengan TypeScript", () => {
    expect(sol).toContain('keccak256("Nearly")');
    expect(sol).toContain('keccak256("1")');
  });

  // Rsvp SENGAJA tidak punya typehash Solidity: RSVP tidak pernah naik
  // on-chain. Test ini mengunci ketiadaan itu, supaya tidak ada yang
  // menambahkannya "demi konsistensi" lalu diam-diam mengubah cakupan fase.
  it("Rsvp tidak punya typehash di kontrak", () => {
    expect(sol).not.toContain("Rsvp(");
  });
});
```

- [ ] **Step 6: Jalankan test kunci, pastikan lulus**

```bash
pnpm --filter @nearly/shared test event-typehash
```

Diharapkan: PASS, 6 test. Kalau gagal, string tipe di `event.ts` dan `AttendanceRegistry.sol` berbeda — samakan, jangan longgarkan test-nya.

- [ ] **Step 7: Tambahkan ke skrip deploy**

Ubah `packages/contracts/script/Deploy.s.sol` — tambahkan import dan sebuah kontrak skrip baru di bawah `DeployPhase2` (jangan mengubah `DeployPhase2`, kontrak Fase 2 sudah ter-deploy):

```solidity
import {AttendanceRegistry} from "../src/AttendanceRegistry.sol";

/**
 * Fase 3a. Berdiri sendiri: AttendanceRegistry tidak bergantung pada kontrak
 * lain mana pun, jadi men-deploy-nya tidak menyentuh graf koneksi maupun vouch
 * yang sudah ada.
 */
contract DeployPhase3a is Script {
    function run() external returns (AttendanceRegistry attendance) {
        address attestor = vm.envAddress("ATTESTOR_ADDRESS");
        vm.startBroadcast();
        attendance = new AttendanceRegistry(attestor);
        vm.stopBroadcast();
    }
}
```

- [ ] **Step 8: Pastikan seluruh test kontrak masih hijau**

```bash
cd packages/contracts && forge test
```

Diharapkan: PASS, 49 test lama + 14 baru = 63.

- [ ] **Step 9: Commit**

```bash
git add packages/contracts/src/AttendanceRegistry.sol packages/contracts/test/AttendanceRegistry.t.sol packages/contracts/script/Deploy.s.sol packages/shared/test/event-typehash.test.ts
git commit -m "feat(contracts): AttendanceRegistry dengan dua tanda tangan dan jendela waktu on-chain"
```

---

## Task 4: Migrasi database & skema Zod

**Files:**
- Create: `supabase/migrations/0003_events.sql`
- Modify: `packages/shared/src/schema.ts`
- Create: `packages/shared/test/schema-event.test.ts`

**Interfaces:**
- Produces: `CreateEventRequestSchema`, `RsvpRequestSchema`, `CheckInOfferRequestSchema`, `CheckInRequestSchema`, dan tipe `CreateEventRequest`, `RsvpRequest`, `CheckInOfferRequest`, `CheckInRequest`.

- [ ] **Step 1: Tulis migrasi**

Buat `supabase/migrations/0003_events.sql`:

```sql
-- Nearly Fase 3a. Empat tabel event. RLS menyala tanpa policy publik, sama
-- seperti 0001 dan 0002: API mengaksesnya lewat service role key.

create table if not exists events (
  event_id    text primary key check (event_id ~ '^0x[0-9a-f]{64}$'),
  host        text not null references profiles(address) on delete cascade,
  title       text not null,
  -- Nama tempat yang ditulis host. TIDAK diverifikasi siapa pun (spec §13.3).
  venue_label text not null default '',
  -- Hanya sel pusat. Kedelapan tetangga DIHITUNG saat verifikasi, tidak
  -- disimpan: menyimpan turunan yang bisa dihitung ulang cuma menciptakan dua
  -- sumber kebenaran yang bisa berselisih.
  center_cell char(7) not null,
  starts_at   bigint not null,          -- unix DETIK, satuan yang sama dgn kontrak
  ends_at     bigint not null,          -- unix DETIK
  tx_hash     text not null,
  created_at  timestamptz not null default now(),
  constraint events_window check (ends_at > starts_at)
);

create index if not exists events_center_cell on events (center_cell);
create index if not exists events_ends_at on events (ends_at desc);

-- Keunikan pasangan inilah yang menegakkan satu RSVP per orang per event.
create table if not exists rsvps (
  event_id   text not null references events(event_id) on delete cascade,
  address    text not null check (address ~ '^0x[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  primary key (event_id, address)
);

-- Cermin handshake_offers dari Fase 1, dan alasannya sama: menahan pemutaran
-- ulang QR yang sudah dipakai.
create table if not exists checkin_offers (
  nonce       text primary key check (nonce ~ '^0x[0-9a-f]{64}$'),
  event_id    text not null references events(event_id) on delete cascade,
  host        text not null check (host ~ '^0x[0-9a-f]{40}$'),
  expires_at  bigint not null,          -- unix DETIK
  sig_host    text not null,
  cell        char(7) not null,         -- sel yang dikirim HOST sendiri
  at_ms       bigint not null,          -- MILIDETIK
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists checkin_offers_expiry on checkin_offers (expires_at);

-- Primary key (event_id, address) menegakkan "check-in sekali, selamanya" —
-- aturan yang sama ditegakkan lagi di kontrak. Dua lapis, sengaja.
create table if not exists checkins (
  event_id   text not null references events(event_id) on delete cascade,
  address    text not null check (address ~ '^0x[0-9a-f]{40}$'),
  nonce      text not null unique,
  cell       char(7) not null,
  at_ms      bigint not null,
  tx_hash    text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, address)
);

-- load-graph menanyakan check-in PER ORANG saat menetapkan occasion.
create index if not exists checkins_address on checkins (address);

alter table events enable row level security;
alter table rsvps enable row level security;
alter table checkin_offers enable row level security;
alter table checkins enable row level security;
```

- [ ] **Step 2: Terapkan migrasi**

```bash
supabase db push
```

Diharapkan: empat tabel dibuat. Kalau proyek dijalankan lewat dashboard, tempel isi berkas ke SQL editor.

- [ ] **Step 3: Tulis test skema yang gagal**

Buat `packages/shared/test/schema-event.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CheckInOfferRequestSchema, CheckInRequestSchema,
  CreateEventRequestSchema, RsvpRequestSchema,
} from "../src/schema";

const ADDR = "0x000000000000000000000000000000000000beef";
const B32 = `0x${"1".repeat(64)}`;
const SIG = `0x${"2".repeat(130)}`;

function createBody(over: Record<string, unknown> = {}) {
  return {
    eventId: B32, host: ADDR, title: "Meetup BNB",
    venueLabel: "Kalibata", cell: "qqguv1r",
    startsAt: "1700000000", endsAt: "1700003600",
    expiresAt: "1700000600", sigHost: SIG,
    ...over,
  };
}

describe("CreateEventRequestSchema", () => {
  it("menerima badan yang sah", () => {
    expect(CreateEventRequestSchema.safeParse(createBody()).success).toBe(true);
  });

  it("menolak judul kosong", () => {
    expect(CreateEventRequestSchema.safeParse(createBody({ title: "" })).success).toBe(false);
  });

  it("menolak sel yang bukan geohash7", () => {
    expect(CreateEventRequestSchema.safeParse(createBody({ cell: "qqg" })).success).toBe(false);
  });

  // Constraint yang sama ada di DB dan di kontrak. Menolaknya sedini mungkin
  // menghemat satu perjalanan bolak-balik dan satu transaksi yang pasti revert.
  it("menolak jendela waktu terbalik", () => {
    const body = createBody({ startsAt: "1700003600", endsAt: "1700000000" });
    expect(CreateEventRequestSchema.safeParse(body).success).toBe(false);
  });

  it("menolak waktu yang bukan angka", () => {
    expect(CreateEventRequestSchema.safeParse(createBody({ startsAt: "besok" })).success)
      .toBe(false);
  });
});

describe("RsvpRequestSchema", () => {
  it("menerima badan yang sah", () => {
    const body = { eventId: B32, who: ADDR, expiresAt: "1700000600", sig: SIG };
    expect(RsvpRequestSchema.safeParse(body).success).toBe(true);
  });

  it("menolak tanda tangan yang panjangnya salah", () => {
    const body = { eventId: B32, who: ADDR, expiresAt: "1700000600", sig: "0x00" };
    expect(RsvpRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe("CheckInOfferRequestSchema", () => {
  it("menerima badan yang sah", () => {
    const body = {
      eventId: B32, nonce: B32, host: ADDR, expiresAt: "1700000030",
      sigHost: SIG, cell: "qqguv1r", atMs: 1_700_000_000_000,
    };
    expect(CheckInOfferRequestSchema.safeParse(body).success).toBe(true);
  });
});

describe("CheckInRequestSchema", () => {
  it("menerima badan yang sah", () => {
    const body = {
      eventId: B32, nonce: B32, attendee: ADDR, expiresAt: "1700000030",
      sigAttendee: SIG, cell: "qqguv1r", atMs: 1_700_000_000_000,
    };
    expect(CheckInRequestSchema.safeParse(body).success).toBe(true);
  });

  it("menolak atMs negatif", () => {
    const body = {
      eventId: B32, nonce: B32, attendee: ADDR, expiresAt: "1700000030",
      sigAttendee: SIG, cell: "qqguv1r", atMs: -1,
    };
    expect(CheckInRequestSchema.safeParse(body).success).toBe(false);
  });
});
```

- [ ] **Step 4: Jalankan test, pastikan gagal**

```bash
pnpm --filter @nearly/shared test schema-event
```

Diharapkan: FAIL, `CreateEventRequestSchema is not exported`.

- [ ] **Step 5: Tambahkan skema**

Tambahkan di akhir `packages/shared/src/schema.ts` (konstanta `address`, `bytes32`, `signature`, `cell` sudah ada di bagian atas berkas — pakai ulang, jangan definisikan lagi):

```ts
const unixSeconds = z.string().regex(/^\d+$/);

export const CreateEventRequestSchema = z
  .object({
    eventId: bytes32,
    host: address,
    title: z.string().min(1).max(120),
    venueLabel: z.string().max(160).default(""),
    cell,
    startsAt: unixSeconds,
    endsAt: unixSeconds,
    expiresAt: unixSeconds,
    sigHost: signature,
  })
  .refine((v) => BigInt(v.endsAt) > BigInt(v.startsAt), {
    message: "waktu selesai harus setelah waktu mulai",
    path: ["endsAt"],
  });

export const RsvpRequestSchema = z.object({
  eventId: bytes32,
  who: address,
  expiresAt: unixSeconds,
  sig: signature,
});

export const CheckInOfferRequestSchema = z.object({
  eventId: bytes32,
  nonce: bytes32,
  host: address,
  expiresAt: unixSeconds,
  sigHost: signature,
  cell,
  atMs: z.number().int().positive(),
});

export const CheckInRequestSchema = z.object({
  eventId: bytes32,
  nonce: bytes32,
  attendee: address,
  expiresAt: unixSeconds,
  sigAttendee: signature,
  cell,
  atMs: z.number().int().positive(),
});

export type CreateEventRequest = z.infer<typeof CreateEventRequestSchema>;
export type RsvpRequest = z.infer<typeof RsvpRequestSchema>;
export type CheckInOfferRequest = z.infer<typeof CheckInOfferRequestSchema>;
export type CheckInRequest = z.infer<typeof CheckInRequestSchema>;
```

- [ ] **Step 6: Jalankan test, pastikan lulus**

```bash
pnpm --filter @nearly/shared test
```

Diharapkan: PASS, seluruh test shared (77 lama + baru dari Task 1, 2, 3, 4).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0003_events.sql packages/shared/src/schema.ts packages/shared/test/schema-event.test.ts
git commit -m "feat(db): empat tabel event + skema permintaan Zod"
```

---

## Task 5: Ports & gerbang buat-event dan RSVP

**Files:**
- Modify: `apps/api/src/ports.ts`
- Create: `apps/api/src/event-gate.ts`
- Create: `apps/api/test/event-gate-create.test.ts`

**Interfaces:**
- Consumes: `recoverCreateEventSigner`, `recoverRsvpSigner`, `cellToBytes32` dari Task 2.
- Produces:
  - Tipe di `ports.ts`: `EventRecord`, `PendingCheckInOffer`, `EventStore`, `AttendanceChainPort`, `EventDeps`
  - `createEvent(input: CreateEventInput, deps: EventDeps): Promise<EventResult<{ txHash: Hex }>>`
  - `rsvp(input: RsvpInput, deps: EventDeps): Promise<EventResult<void>>`
  - `EventFailure` (union kode penolakan), `EventResult<T>`

- [ ] **Step 1: Tambahkan tipe ke ports.ts**

Tambahkan di akhir `apps/api/src/ports.ts`:

```ts
export type EventRecord = {
  eventId: Hex;
  host: Address;
  title: string;
  venueLabel: string;
  centerCell: string;
  /** unix DETIK */
  startsAt: bigint;
  /** unix DETIK */
  endsAt: bigint;
  txHash: Hex;
};

export type PendingCheckInOffer = {
  nonce: Hex;
  eventId: Hex;
  host: Address;
  expiresAt: bigint;
  sigHost: Hex;
  /** Sel geohash7 yang dikirim HOST sendiri. */
  cell: string;
  /** MILIDETIK. */
  atMs: number;
  consumed: boolean;
};

/** Satu baris kartu di halaman discovery. */
export type DiscoveryRow = EventRecord & { hostScore: number; rsvpCount: number };

export type EventStore = {
  recordEvent(row: EventRecord): Promise<void>;
  getEvent(eventId: Hex): Promise<EventRecord | null>;
  /** Sudah tersaring dan terurut (spec §8). `nowSec` unix DETIK. */
  listDiscovery(nowSec: number, limit: number): Promise<DiscoveryRow[]>;
  hasRsvp(eventId: Hex, who: Address): Promise<boolean>;
  recordRsvp(eventId: Hex, who: Address): Promise<void>;
  putCheckInOffer(offer: Omit<PendingCheckInOffer, "consumed">): Promise<void>;
  getCheckInOffer(nonce: Hex): Promise<PendingCheckInOffer | null>;
  consumeCheckInOffer(nonce: Hex): Promise<void>;
  hasCheckIn(eventId: Hex, who: Address): Promise<boolean>;
  recordCheckIn(row: {
    eventId: Hex; who: Address; nonce: Hex; cell: string; atMs: number; txHash: Hex;
  }): Promise<void>;
  attendanceSummary(eventId: Hex): Promise<{
    rsvps: number; checkins: number; rsvpBelumHadir: number;
  }>;
};

export type AttendanceChainPort = {
  submitCreateEvent(a: {
    eventId: Hex; host: Address; startsAt: bigint; endsAt: bigint;
    centerCell: Hex; expiresAt: bigint; sigHost: Hex;
  }): Promise<Hex>;
  submitCheckIn(a: {
    eventId: Hex; attendee: Address; nonce: Hex; expiresAt: bigint;
    sigHost: Hex; sigAttendee: Hex;
  }): Promise<Hex>;
};

export type EventDeps = {
  events: EventStore;
  attendance: AttendanceChainPort;
  profiles: ProfileStore;
  /** Alamat AttendanceRegistry — domain EIP-712 terikat padanya. */
  attendanceContract: Address;
  nowMs: () => number;
};
```

- [ ] **Step 2: Tulis test yang gagal**

Buat `apps/api/test/event-gate-create.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { cellToBytes32, createEventTypedData, rsvpTypedData } from "@nearly/shared";
import { createEvent, rsvp } from "../src/event-gate";

const NOW = 1_700_000_000_000;
const NOW_SEC = BigInt(Math.floor(NOW / 1000));
const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const host = privateKeyToAccount(PK);
const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;
const EVENT_ID = `0x${"1".repeat(64)}` as Hex;
const CELL = "qqguv1r";

function deps(over: Record<string, unknown> = {}) {
  return {
    events: {
      recordEvent: vi.fn(async () => {}),
      getEvent: vi.fn(async () => null),
      hasRsvp: vi.fn(async () => false),
      recordRsvp: vi.fn(async () => {}),
    },
    attendance: {
      submitCreateEvent: vi.fn(async (): Promise<Hex> => "0xtx" as Hex),
    },
    profiles: {},
    attendanceContract: CONTRACT,
    nowMs: () => NOW,
    ...over,
  } as never;
}

async function createInput(over: Record<string, unknown> = {}) {
  const startsAt = NOW_SEC;
  const endsAt = NOW_SEC + 3600n;
  const expiresAt = NOW_SEC + 600n;
  const msg = {
    eventId: EVENT_ID, host: host.address, startsAt, endsAt,
    centerCell: cellToBytes32(CELL), expiresAt,
  };
  return {
    eventId: EVENT_ID,
    host: host.address,
    title: "Meetup BNB",
    venueLabel: "Kalibata",
    cell: CELL,
    startsAt,
    endsAt,
    expiresAt,
    sigHost: await host.signTypedData(createEventTypedData(msg, CONTRACT)),
    ...over,
  } as never;
}

describe("createEvent", () => {
  it("event yang sah diteruskan ke chain dan dicatat", async () => {
    const d = deps();
    const r = await createEvent(await createInput(), d);
    expect(r).toMatchObject({ ok: true, value: { txHash: "0xtx" } });
  });

  it("menolak tanda tangan yang bukan milik host", async () => {
    const other = "0x000000000000000000000000000000000000beef" as Address;
    const r = await createEvent(await createInput({ host: other }), deps());
    expect(r).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
  });

  it("menolak permintaan yang sudah kedaluwarsa", async () => {
    const r = await createEvent(await createInput({ expiresAt: NOW_SEC - 1n }), deps());
    expect(r).toMatchObject({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("menolak eventId yang sudah dipakai", async () => {
    const d = deps({
      events: {
        recordEvent: vi.fn(async () => {}),
        getEvent: vi.fn(async () => ({ eventId: EVENT_ID })),
        hasRsvp: vi.fn(async () => false),
        recordRsvp: vi.fn(async () => {}),
      },
    });
    const r = await createEvent(await createInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "event_exists", httpStatus: 409 } });
  });

  // Transaksi yang gagal TIDAK boleh meninggalkan baris event di database:
  // event yang ada di Postgres tapi tidak ada on-chain akan membuat SETIAP
  // check-in ke event itu revert dengan EventUnknown, dan penyebabnya tidak
  // terlihat dari sisi pengguna.
  it("tidak mencatat event kalau transaksi gagal", async () => {
    const recordEvent = vi.fn(async () => {});
    const d = deps({
      events: {
        recordEvent,
        getEvent: vi.fn(async () => null),
        hasRsvp: vi.fn(async () => false),
        recordRsvp: vi.fn(async () => {}),
      },
      attendance: {
        submitCreateEvent: vi.fn(async () => {
          throw new Error("rpc mati");
        }),
      },
    });
    const r = await createEvent(await createInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "chain_error", httpStatus: 502 } });
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

describe("rsvp", () => {
  async function rsvpInput(over: Record<string, unknown> = {}) {
    const expiresAt = NOW_SEC + 600n;
    const msg = { eventId: EVENT_ID, who: host.address, expiresAt };
    return {
      eventId: EVENT_ID,
      who: host.address,
      expiresAt,
      sig: await host.signTypedData(rsvpTypedData(msg, CONTRACT)),
      ...over,
    } as never;
  }

  function rsvpDeps(over: Record<string, unknown> = {}) {
    return deps({
      events: {
        recordEvent: vi.fn(async () => {}),
        getEvent: vi.fn(async () => ({
          eventId: EVENT_ID, host: host.address, centerCell: CELL,
          startsAt: NOW_SEC, endsAt: NOW_SEC + 3600n,
        })),
        hasRsvp: vi.fn(async () => false),
        recordRsvp: vi.fn(async () => {}),
      },
      ...over,
    });
  }

  it("RSVP yang sah dicatat", async () => {
    const r = await rsvp(await rsvpInput(), rsvpDeps());
    expect(r).toMatchObject({ ok: true });
  });

  it("menolak RSVP ke event yang tidak ada", async () => {
    const d = deps({
      events: {
        recordEvent: vi.fn(async () => {}),
        getEvent: vi.fn(async () => null),
        hasRsvp: vi.fn(async () => false),
        recordRsvp: vi.fn(async () => {}),
      },
    });
    const r = await rsvp(await rsvpInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "event_not_found", httpStatus: 404 } });
  });

  // Tanpa penjagaan ini, `who` datang telanjang dari body dan siapa pun bisa
  // mengarang RSVP atas nama orang lain — dan karena RSVP adalah SYARAT
  // check-in, itu berarti mengarang syarat orang lain.
  it("menolak RSVP yang ditandatangani orang lain", async () => {
    const other = "0x000000000000000000000000000000000000beef" as Address;
    const r = await rsvp(await rsvpInput({ who: other }), rsvpDeps());
    expect(r).toMatchObject({ ok: false, failure: { code: "bad_signature" } });
  });

  it("RSVP kedua ditolak", async () => {
    const d = rsvpDeps({
      events: {
        recordEvent: vi.fn(async () => {}),
        getEvent: vi.fn(async () => ({
          eventId: EVENT_ID, host: host.address, centerCell: CELL,
          startsAt: NOW_SEC, endsAt: NOW_SEC + 3600n,
        })),
        hasRsvp: vi.fn(async () => true),
        recordRsvp: vi.fn(async () => {}),
      },
    });
    const r = await rsvp(await rsvpInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "already_rsvped", httpStatus: 409 } });
  });

  it("menolak RSVP setelah acara selesai", async () => {
    const d = rsvpDeps({
      events: {
        recordEvent: vi.fn(async () => {}),
        getEvent: vi.fn(async () => ({
          eventId: EVENT_ID, host: host.address, centerCell: CELL,
          startsAt: NOW_SEC - 7200n, endsAt: NOW_SEC - 3600n,
        })),
        hasRsvp: vi.fn(async () => false),
        recordRsvp: vi.fn(async () => {}),
      },
    });
    const r = await rsvp(await rsvpInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "event_over", httpStatus: 410 } });
  });
});
```

- [ ] **Step 3: Jalankan test, pastikan gagal**

```bash
pnpm --filter @nearly/api test event-gate-create
```

Diharapkan: FAIL, `Failed to resolve import "../src/event-gate"`.

- [ ] **Step 4: Tulis `event-gate.ts` bagian pertama**

Buat `apps/api/src/event-gate.ts`:

```ts
import type { Address, Hex } from "viem";
import {
  cellToBytes32, recoverCreateEventSigner, recoverRsvpSigner,
} from "@nearly/shared";
import type { EventDeps } from "./ports";

export type EventFailure =
  | { code: "expired"; httpStatus: 410 }
  | { code: "bad_signature"; httpStatus: 401 }
  | { code: "event_exists"; httpStatus: 409 }
  | { code: "event_not_found"; httpStatus: 404 }
  | { code: "event_over"; httpStatus: 410 }
  | { code: "already_rsvped"; httpStatus: 409 }
  | { code: "not_rsvped"; httpStatus: 403 }
  | { code: "already_checked_in"; httpStatus: 409 }
  | { code: "event_not_live"; httpStatus: 422 }
  | { code: "outside_geofence"; httpStatus: 422 }
  | { code: "not_colocated"; reason: "cell_too_far" | "time_too_far"; httpStatus: 422 }
  | { code: "offer_not_found"; httpStatus: 404 }
  | { code: "offer_consumed"; httpStatus: 409 }
  | { code: "nonce_used"; httpStatus: 409 }
  | { code: "not_host"; httpStatus: 403 }
  | { code: "chain_error"; httpStatus: 502 };

export type EventResult<T> = { ok: true; value: T } | { ok: false; failure: EventFailure };

const fail = (failure: EventFailure): { ok: false; failure: EventFailure } =>
  ({ ok: false, failure });

export type CreateEventInput = {
  eventId: Hex; host: Address; title: string; venueLabel: string; cell: string;
  startsAt: bigint; endsAt: bigint; expiresAt: bigint; sigHost: Hex;
};

export async function createEvent(
  input: CreateEventInput, deps: EventDeps,
): Promise<EventResult<{ txHash: Hex }>> {
  if (deps.nowMs() > Number(input.expiresAt) * 1000) {
    return fail({ code: "expired", httpStatus: 410 });
  }
  if (await deps.events.getEvent(input.eventId)) {
    return fail({ code: "event_exists", httpStatus: 409 });
  }

  const centerCell = cellToBytes32(input.cell);
  const signer = await recoverCreateEventSigner(
    {
      eventId: input.eventId, host: input.host, startsAt: input.startsAt,
      endsAt: input.endsAt, centerCell, expiresAt: input.expiresAt,
    },
    input.sigHost,
    deps.attendanceContract,
  );
  if (signer.toLowerCase() !== input.host.toLowerCase()) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  let txHash: Hex;
  try {
    txHash = await deps.attendance.submitCreateEvent({
      eventId: input.eventId, host: input.host, startsAt: input.startsAt,
      endsAt: input.endsAt, centerCell, expiresAt: input.expiresAt, sigHost: input.sigHost,
    });
  } catch {
    // Baris event TIDAK ditulis. Event yang ada di Postgres tapi tidak ada
    // on-chain membuat setiap check-in ke event itu revert EventUnknown, dan
    // penyebabnya tidak terlihat dari sisi pengguna.
    return fail({ code: "chain_error", httpStatus: 502 });
  }

  await deps.events.recordEvent({
    eventId: input.eventId, host: input.host, title: input.title,
    venueLabel: input.venueLabel, centerCell: input.cell,
    startsAt: input.startsAt, endsAt: input.endsAt, txHash,
  });
  return { ok: true, value: { txHash } };
}

export type RsvpInput = { eventId: Hex; who: Address; expiresAt: bigint; sig: Hex };

/**
 * RSVP murni off-chain (spec §4.2) — ia niat, bukan bukti. Yang naik on-chain
 * hanya kehadiran.
 */
export async function rsvp(input: RsvpInput, deps: EventDeps): Promise<EventResult<void>> {
  if (deps.nowMs() > Number(input.expiresAt) * 1000) {
    return fail({ code: "expired", httpStatus: 410 });
  }

  const ev = await deps.events.getEvent(input.eventId);
  if (!ev) return fail({ code: "event_not_found", httpStatus: 404 });

  if (deps.nowMs() > Number(ev.endsAt) * 1000) {
    return fail({ code: "event_over", httpStatus: 410 });
  }

  const signer = await recoverRsvpSigner(
    { eventId: input.eventId, who: input.who, expiresAt: input.expiresAt },
    input.sig,
    deps.attendanceContract,
  );
  if (signer.toLowerCase() !== input.who.toLowerCase()) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  if (await deps.events.hasRsvp(input.eventId, input.who)) {
    return fail({ code: "already_rsvped", httpStatus: 409 });
  }

  await deps.events.recordRsvp(input.eventId, input.who);
  return { ok: true, value: undefined };
}
```

- [ ] **Step 5: Jalankan test, pastikan lulus**

```bash
pnpm --filter @nearly/api test event-gate-create
```

Diharapkan: PASS, 10 test.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/ports.ts apps/api/src/event-gate.ts apps/api/test/event-gate-create.test.ts
git commit -m "feat(api): gerbang buat-event dan RSVP"
```

---

## Task 6: Gerbang check-in

**Files:**
- Modify: `apps/api/src/event-gate.ts`
- Create: `apps/api/test/event-gate-checkin.test.ts`

**Interfaces:**
- Consumes: `EventDeps`, `EventFailure`, `EventResult`, `fail` dari Task 5; `isInsideGeofence`, `isEventLive` dari Task 1; `recoverCheckInOfferSigner`, `recoverCheckInAcceptSigner` dari Task 2; `verifyColocation` dari `@nearly/shared`.
- Produces: `submitCheckInOffer(input: CheckInOfferInput, deps: EventDeps): Promise<EventResult<void>>`, `acceptCheckIn(input: CheckInInput, deps: EventDeps): Promise<EventResult<{ txHash: Hex }>>`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `apps/api/test/event-gate-checkin.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { checkInAcceptTypedData, checkInOfferTypedData, neighborCells } from "@nearly/shared";
import { acceptCheckIn, submitCheckInOffer } from "../src/event-gate";

const NOW = 1_700_000_000_000;
const NOW_SEC = BigInt(Math.floor(NOW / 1000));
const host = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex,
);
const guest = privateKeyToAccount(
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex,
);
const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;
const EVENT_ID = `0x${"1".repeat(64)}` as Hex;
const NONCE = `0x${"2".repeat(64)}` as Hex;
const CELL = "qqguv1r";

const eventRecord = {
  eventId: EVENT_ID, host: host.address, title: "Meetup BNB", venueLabel: "Kalibata",
  centerCell: CELL, startsAt: NOW_SEC - 600n, endsAt: NOW_SEC + 3600n, txHash: "0xtx" as Hex,
};

const pendingOffer = {
  nonce: NONCE, eventId: EVENT_ID, host: host.address, expiresAt: NOW_SEC + 30n,
  sigHost: "0x00" as Hex, cell: CELL, atMs: NOW, consumed: false,
};

function eventsStore(over: Record<string, unknown> = {}) {
  return {
    recordEvent: vi.fn(async () => {}),
    getEvent: vi.fn(async () => eventRecord),
    hasRsvp: vi.fn(async () => true),
    recordRsvp: vi.fn(async () => {}),
    putCheckInOffer: vi.fn(async () => {}),
    getCheckInOffer: vi.fn(async () => pendingOffer),
    consumeCheckInOffer: vi.fn(async () => {}),
    hasCheckIn: vi.fn(async () => false),
    recordCheckIn: vi.fn(async () => {}),
    ...over,
  };
}

function deps(over: Record<string, unknown> = {}) {
  return {
    events: eventsStore(),
    attendance: { submitCheckIn: vi.fn(async (): Promise<Hex> => "0xtxcheckin" as Hex) },
    profiles: {},
    attendanceContract: CONTRACT,
    nowMs: () => NOW,
    ...over,
  } as never;
}

async function offerInput(over: Record<string, unknown> = {}) {
  const expiresAt = NOW_SEC + 30n;
  const msg = { eventId: EVENT_ID, nonce: NONCE, expiresAt };
  return {
    eventId: EVENT_ID, nonce: NONCE, host: host.address, expiresAt,
    sigHost: await host.signTypedData(checkInOfferTypedData(msg, CONTRACT)),
    cell: CELL, atMs: NOW,
    ...over,
  } as never;
}

async function checkInInput(over: Record<string, unknown> = {}) {
  const expiresAt = NOW_SEC + 30n;
  const msg = { eventId: EVENT_ID, nonce: NONCE, attendee: guest.address, expiresAt };
  return {
    eventId: EVENT_ID, nonce: NONCE, attendee: guest.address, expiresAt,
    sigAttendee: await guest.signTypedData(checkInAcceptTypedData(msg, CONTRACT)),
    cell: CELL, atMs: NOW,
    ...over,
  } as never;
}

describe("submitCheckInOffer", () => {
  it("tawaran dari host yang sah disimpan", async () => {
    const d = deps({ events: eventsStore({ getCheckInOffer: vi.fn(async () => null) }) });
    const r = await submitCheckInOffer(await offerInput(), d);
    expect(r).toMatchObject({ ok: true });
  });

  // Hanya host yang boleh membuka pintu check-in. Kalau siapa pun boleh, QR
  // check-in bisa dibuat dari rumah dan seluruh premis fase ini runtuh.
  it("menolak tawaran dari orang yang bukan host event", async () => {
    const d = deps({ events: eventsStore({ getCheckInOffer: vi.fn(async () => null) }) });
    const r = await submitCheckInOffer(await offerInput({ host: guest.address }), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "not_host", httpStatus: 403 } });
  });

  it("menolak nonce yang sudah pernah dipakai", async () => {
    const r = await submitCheckInOffer(await offerInput(), deps());
    expect(r).toMatchObject({ ok: false, failure: { code: "nonce_used", httpStatus: 409 } });
  });

  it("menolak tawaran ke event yang tidak ada", async () => {
    const d = deps({
      events: eventsStore({
        getEvent: vi.fn(async () => null),
        getCheckInOffer: vi.fn(async () => null),
      }),
    });
    const r = await submitCheckInOffer(await offerInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "event_not_found" } });
  });
});

describe("acceptCheckIn", () => {
  it("check-in yang sah diteruskan ke chain dan dicatat", async () => {
    const d = deps();
    const r = await acceptCheckIn(await checkInInput(), d);
    expect(r).toMatchObject({ ok: true, value: { txHash: "0xtxcheckin" } });
  });

  it("menolak kalau tamu belum RSVP", async () => {
    const d = deps({ events: eventsStore({ hasRsvp: vi.fn(async () => false) }) });
    const r = await acceptCheckIn(await checkInInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "not_rsvped", httpStatus: 403 } });
  });

  it("menolak check-in kedua", async () => {
    const d = deps({ events: eventsStore({ hasCheckIn: vi.fn(async () => true) }) });
    const r = await acceptCheckIn(await checkInInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "already_checked_in" } });
  });

  it("menolak tawaran yang sudah dipakai", async () => {
    const d = deps({
      events: eventsStore({
        getCheckInOffer: vi.fn(async () => ({ ...pendingOffer, consumed: true })),
      }),
    });
    const r = await acceptCheckIn(await checkInInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "offer_consumed" } });
  });

  it("menolak tawaran yang tidak dikenal", async () => {
    const d = deps({ events: eventsStore({ getCheckInOffer: vi.fn(async () => null) }) });
    const r = await acceptCheckIn(await checkInInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "offer_not_found" } });
  });

  it("menolak check-in sebelum acara mulai", async () => {
    const d = deps({
      events: eventsStore({
        getEvent: vi.fn(async () => ({
          ...eventRecord, startsAt: NOW_SEC + 600n, endsAt: NOW_SEC + 4200n,
        })),
      }),
    });
    const r = await acceptCheckIn(await checkInInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "event_not_live", httpStatus: 422 } });
  });

  it("menolak check-in setelah acara selesai", async () => {
    const d = deps({
      events: eventsStore({
        getEvent: vi.fn(async () => ({
          ...eventRecord, startsAt: NOW_SEC - 7200n, endsAt: NOW_SEC - 3600n,
        })),
      }),
    });
    const r = await acceptCheckIn(await checkInInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "event_not_live" } });
  });

  it("menolak tamu yang selnya di luar geofence", async () => {
    const r = await acceptCheckIn(await checkInInput({ cell: "w1xyz00" }), deps());
    expect(r).toMatchObject({ ok: false, failure: { code: "outside_geofence", httpStatus: 422 } });
  });

  it("menerima tamu di sel tetangga sel pusat", async () => {
    const neighbour = neighborCells(CELL)[0]!;
    const r = await acceptCheckIn(await checkInInput({ cell: neighbour }), deps());
    expect(r).toMatchObject({ ok: true });
  });

  // Geofence menjawab "di venue?"; ko-lokasi menjawab "di depan host?".
  // Keduanya perlu: QR yang difoto lalu dipakai tiga jam kemudian gagal di sini.
  it("menolak kalau waktu tamu jauh dari waktu host", async () => {
    const r = await acceptCheckIn(await checkInInput({ atMs: NOW + 600_000 }), deps());
    expect(r).toMatchObject({
      ok: false, failure: { code: "not_colocated", reason: "time_too_far" },
    });
  });

  it("menolak tanda tangan tamu yang bukan miliknya", async () => {
    const r = await acceptCheckIn(await checkInInput({ attendee: host.address }), deps());
    expect(r).toMatchObject({ ok: false, failure: { code: "bad_signature" } });
  });

  // Tawaran TIDAK ditandai terpakai kalau transaksi gagal, supaya tamu bisa
  // mencoba lagi dengan QR yang sama alih-alih menunggu rotasi berikutnya.
  it("tidak menandai tawaran terpakai kalau transaksi gagal", async () => {
    const events = eventsStore();
    const d = deps({
      events,
      attendance: {
        submitCheckIn: vi.fn(async () => {
          throw new Error("rpc mati");
        }),
      },
    });
    const r = await acceptCheckIn(await checkInInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "chain_error", httpStatus: 502 } });
    expect(events.consumeCheckInOffer).not.toHaveBeenCalled();
    expect(events.recordCheckIn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
pnpm --filter @nearly/api test event-gate-checkin
```

Diharapkan: FAIL, `submitCheckInOffer is not exported`.

- [ ] **Step 3: Tambahkan dua fungsi ke `event-gate.ts`**

Tambahkan import di bagian atas berkas — gabungkan ke pernyataan import `@nearly/shared` yang sudah ada:

```ts
import {
  cellToBytes32, isEventLive, isInsideGeofence, recoverCheckInAcceptSigner,
  recoverCheckInOfferSigner, recoverCreateEventSigner, recoverRsvpSigner, verifyColocation,
} from "@nearly/shared";
```

Lalu tambahkan di akhir berkas:

```ts
export type CheckInOfferInput = {
  eventId: Hex; nonce: Hex; host: Address; expiresAt: bigint;
  sigHost: Hex; cell: string; atMs: number;
};

/**
 * Host membuka pintu. Cermin submitOffer di handshake-gate.ts — bedanya cuma
 * satu penjagaan tambahan: penandatangan harus host EVENT INI, bukan sembarang
 * orang. Tanpa itu, QR check-in bisa dibuat siapa saja dari mana saja.
 */
export async function submitCheckInOffer(
  input: CheckInOfferInput, deps: EventDeps,
): Promise<EventResult<void>> {
  if (deps.nowMs() > Number(input.expiresAt) * 1000) {
    return fail({ code: "expired", httpStatus: 410 });
  }

  const ev = await deps.events.getEvent(input.eventId);
  if (!ev) return fail({ code: "event_not_found", httpStatus: 404 });

  if (ev.host.toLowerCase() !== input.host.toLowerCase()) {
    return fail({ code: "not_host", httpStatus: 403 });
  }

  if (await deps.events.getCheckInOffer(input.nonce)) {
    return fail({ code: "nonce_used", httpStatus: 409 });
  }

  const signer = await recoverCheckInOfferSigner(
    { eventId: input.eventId, nonce: input.nonce, expiresAt: input.expiresAt },
    input.sigHost,
    deps.attendanceContract,
  );
  if (signer.toLowerCase() !== input.host.toLowerCase()) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  await deps.events.putCheckInOffer({
    nonce: input.nonce, eventId: input.eventId, host: input.host,
    expiresAt: input.expiresAt, sigHost: input.sigHost, cell: input.cell, atMs: input.atMs,
  });
  return { ok: true, value: undefined };
}

export type CheckInInput = {
  eventId: Hex; nonce: Hex; attendee: Address; expiresAt: bigint;
  sigAttendee: Hex; cell: string; atMs: number;
};

/**
 * Tamu melangkah masuk. Sembilan penjagaan, urutannya sengaja: yang termurah
 * dan paling sering gagal lebih dulu, pemanggilan chain paling akhir.
 *
 * Dua pemeriksaan lokasi menjawab pertanyaan yang BERBEDA dan dua-duanya perlu:
 * geofence menjawab "apakah dia di venue yang diumumkan", ko-lokasi menjawab
 * "apakah dia benar-benar berdiri di depan host saat itu".
 */
export async function acceptCheckIn(
  input: CheckInInput, deps: EventDeps,
): Promise<EventResult<{ txHash: Hex }>> {
  const offer = await deps.events.getCheckInOffer(input.nonce);
  if (!offer) return fail({ code: "offer_not_found", httpStatus: 404 });
  if (offer.consumed) return fail({ code: "offer_consumed", httpStatus: 409 });
  if (offer.eventId.toLowerCase() !== input.eventId.toLowerCase()) {
    return fail({ code: "offer_not_found", httpStatus: 404 });
  }
  if (deps.nowMs() > Number(offer.expiresAt) * 1000) {
    return fail({ code: "expired", httpStatus: 410 });
  }

  const ev = await deps.events.getEvent(input.eventId);
  if (!ev) return fail({ code: "event_not_found", httpStatus: 404 });

  if (!isEventLive(ev.startsAt, ev.endsAt, deps.nowMs())) {
    return fail({ code: "event_not_live", httpStatus: 422 });
  }

  // Keputusan pemilik project (spec §2.2): RSVP adalah SYARAT, bukan anjuran.
  if (!(await deps.events.hasRsvp(input.eventId, input.attendee))) {
    return fail({ code: "not_rsvped", httpStatus: 403 });
  }

  if (await deps.events.hasCheckIn(input.eventId, input.attendee)) {
    return fail({ code: "already_checked_in", httpStatus: 409 });
  }

  if (!isInsideGeofence(ev.centerCell, input.cell)) {
    return fail({ code: "outside_geofence", httpStatus: 422 });
  }

  const colo = verifyColocation(
    { cell: offer.cell, at: offer.atMs },
    { cell: input.cell, at: input.atMs },
  );
  if (!colo.ok) return fail({ code: "not_colocated", reason: colo.reason, httpStatus: 422 });

  const signer = await recoverCheckInAcceptSigner(
    {
      eventId: input.eventId, nonce: input.nonce,
      attendee: input.attendee, expiresAt: offer.expiresAt,
    },
    input.sigAttendee,
    deps.attendanceContract,
  );
  if (signer.toLowerCase() !== input.attendee.toLowerCase()) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  let txHash: Hex;
  try {
    txHash = await deps.attendance.submitCheckIn({
      eventId: input.eventId, attendee: input.attendee, nonce: input.nonce,
      expiresAt: offer.expiresAt, sigHost: offer.sigHost, sigAttendee: input.sigAttendee,
    });
  } catch {
    // Tawaran TIDAK ditandai terpakai, supaya tamu bisa mencoba lagi dengan QR
    // yang sama alih-alih menunggu rotasi berikutnya.
    return fail({ code: "chain_error", httpStatus: 502 });
  }

  await deps.events.consumeCheckInOffer(input.nonce);
  await deps.events.recordCheckIn({
    eventId: input.eventId, who: input.attendee, nonce: input.nonce,
    cell: input.cell, atMs: input.atMs, txHash,
  });
  return { ok: true, value: { txHash } };
}
```

**Catatan penting untuk pelaksana:** tanda tangan tamu diverifikasi memakai `offer.expiresAt`, **bukan** `input.expiresAt`. Kalau memakai nilai dari badan permintaan, tamu bisa mengirim `expiresAt` karangannya sendiri dan tanda tangannya tetap cocok — sementara kontrak akan menolaknya. Sumber kebenarannya adalah tawaran yang sudah tersimpan.

- [ ] **Step 4: Jalankan test, pastikan lulus**

```bash
pnpm --filter @nearly/api test event-gate-checkin
```

Diharapkan: PASS, 17 test.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/event-gate.ts apps/api/test/event-gate-checkin.test.ts
git commit -m "feat(api): gerbang check-in dengan QR host, geofence, dan ko-lokasi"
```

---

## Task 7: Penyaring & pengurutan discovery

**Files:**
- Create: `apps/api/src/discovery.ts`
- Create: `apps/api/test/discovery.test.ts`

**Interfaces:**
- Consumes: `EventRecord`, `DiscoveryRow` dari `ports.ts` (Task 5).
- Produces: `DiscoveryCandidate` (= `DiscoveryRow & { hostConnections: number; hostSlashed: boolean }`), `rankDiscovery(candidates: DiscoveryCandidate[], nowSec: number): DiscoveryRow[]`.

- [ ] **Step 1: Tulis test yang gagal**

Buat `apps/api/test/discovery.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { rankDiscovery, type DiscoveryCandidate } from "../src/discovery";

const NOW_SEC = 1_700_000_000;

function candidate(over: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
  return {
    eventId: `0x${"1".repeat(64)}` as Hex,
    host: "0x000000000000000000000000000000000000aaaa",
    title: "Meetup", venueLabel: "Jakarta", centerCell: "qqguv1r",
    startsAt: BigInt(NOW_SEC + 3600), endsAt: BigInt(NOW_SEC + 7200),
    txHash: "0xtx" as Hex,
    hostScore: 0.1, rsvpCount: 0, hostConnections: 3, hostSlashed: false,
    ...over,
  } as DiscoveryCandidate;
}

describe("rankDiscovery", () => {
  it("menyembunyikan event dari host yang ter-slash", () => {
    const rows = rankDiscovery([candidate({ hostSlashed: true })], NOW_SEC);
    expect(rows).toHaveLength(0);
  });

  // Bot bisa menekan tombol, tapi bot tidak bisa membangun graf. Nol koneksi
  // berarti belum pernah bertemu siapa pun.
  it("menyembunyikan event dari host tanpa satu pun koneksi", () => {
    const rows = rankDiscovery([candidate({ hostConnections: 0 })], NOW_SEC);
    expect(rows).toHaveLength(0);
  });

  it("menyembunyikan event yang sudah selesai", () => {
    const rows = rankDiscovery([candidate({ endsAt: BigInt(NOW_SEC - 1) })], NOW_SEC);
    expect(rows).toHaveLength(0);
  });

  it("event yang sedang berlangsung tetap tampil", () => {
    const rows = rankDiscovery(
      [candidate({ startsAt: BigInt(NOW_SEC - 600), endsAt: BigInt(NOW_SEC + 600) })],
      NOW_SEC,
    );
    expect(rows).toHaveLength(1);
  });

  // Inti keputusan spec §8: host bertier Baru TIDAK disembunyikan, hanya
  // diletakkan di bawah. Kalau test ini berubah jadi "disembunyikan", halaman
  // discovery akan kosong di graf kecil.
  it("host ber-skor nol tetap tampil, hanya di bawah", () => {
    const kuat = candidate({ eventId: `0x${"a".repeat(64)}` as Hex, hostScore: 0.9 });
    const baru = candidate({ eventId: `0x${"b".repeat(64)}` as Hex, hostScore: 0 });
    const rows = rankDiscovery([baru, kuat], NOW_SEC);
    expect(rows.map((r) => r.eventId)).toEqual([kuat.eventId, baru.eventId]);
  });

  it("skor sama diurutkan yang paling dekat waktunya lebih dulu", () => {
    const nanti = candidate({
      eventId: `0x${"c".repeat(64)}` as Hex, startsAt: BigInt(NOW_SEC + 7200),
      endsAt: BigInt(NOW_SEC + 10800),
    });
    const segera = candidate({
      eventId: `0x${"d".repeat(64)}` as Hex, startsAt: BigInt(NOW_SEC + 60),
      endsAt: BigInt(NOW_SEC + 3600),
    });
    const rows = rankDiscovery([nanti, segera], NOW_SEC);
    expect(rows.map((r) => r.eventId)).toEqual([segera.eventId, nanti.eventId]);
  });

  it("tidak membocorkan kolom penyaring ke hasil", () => {
    const rows = rankDiscovery([candidate()], NOW_SEC);
    expect(rows[0]).not.toHaveProperty("hostSlashed");
    expect(rows[0]).not.toHaveProperty("hostConnections");
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
pnpm --filter @nearly/api test discovery
```

Diharapkan: FAIL, `Failed to resolve import "../src/discovery"`.

- [ ] **Step 3: Tulis implementasi**

Buat `apps/api/src/discovery.ts`:

```ts
import type { DiscoveryRow } from "./ports";

export type DiscoveryCandidate = DiscoveryRow & {
  hostConnections: number;
  hostSlashed: boolean;
};

/**
 * Spec §8, dan ini bagian yang paling gampang salah dibaca.
 *
 * Spec induk §7.7 melarang membatasi SIAPA yang boleh mengadakan event, karena
 * skor tidak boleh dipakai mengunci akses. Yang boleh diperoleh adalah
 * perhatian. Karena itu penyaringnya hanya dua, dan keduanya bukan soal
 * populer atau tidak:
 *
 * 1. Host ter-slash — sudah melewati peninjauan manusia atas laporan penipuan.
 * 2. Host tanpa koneksi — belum pernah bertemu siapa pun. Bot bisa menekan
 *    tombol; bot tidak bisa membangun graf.
 *
 * Sisanya DIURUTKAN, tidak disembunyikan. Menyembunyikan tier Baru akan
 * mengosongkan halaman ini di graf kecil dan menghukum host tulus yang baru.
 *
 * Murni, supaya keputusan ini bisa diuji tanpa Supabase.
 */
export function rankDiscovery(
  candidates: DiscoveryCandidate[], nowSec: number,
): DiscoveryRow[] {
  return candidates
    .filter((c) => !c.hostSlashed && c.hostConnections > 0 && Number(c.endsAt) >= nowSec)
    .sort((a, b) => {
      if (b.hostScore !== a.hostScore) return b.hostScore - a.hostScore;
      return Number(a.startsAt) - Number(b.startsAt);
    })
    .map(({ hostConnections: _c, hostSlashed: _s, ...row }) => row);
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

```bash
pnpm --filter @nearly/api test discovery
```

Diharapkan: PASS, 7 test.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/discovery.ts apps/api/test/discovery.test.ts
git commit -m "feat(api): penyaring dan pengurutan discovery event"
```

---

## Task 8: `EventStore` di atas Supabase

**Files:**
- Create: `apps/api/src/event-store.ts`
- Create: `apps/api/test/event-store-mapping.test.ts`

**Interfaces:**
- Consumes: `EventStore`, `EventRecord`, `PendingCheckInOffer`, `DiscoveryRow` (Task 5); `rankDiscovery`, `DiscoveryCandidate` (Task 7).
- Produces: `createEventStore(db: SupabaseClient): EventStore`, dan dua fungsi murni yang diuji langsung: `rowToEvent(row: EventDbRow): EventRecord`, `rowToCheckInOffer(row: OfferDbRow): PendingCheckInOffer`.

Berkas ini dibuat terpisah dari `db.ts` dengan sengaja: `db.ts` sudah memuat store handshake dan profil, dan menambah empat tabel lagi ke sana akan membuatnya terlalu besar untuk dibaca sekali duduk.

- [ ] **Step 1: Tulis test pemetaan baris yang gagal**

Buat `apps/api/test/event-store-mapping.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { rowToCheckInOffer, rowToEvent } from "../src/event-store";

describe("rowToEvent", () => {
  const row = {
    event_id: `0x${"1".repeat(64)}`,
    host: "0x000000000000000000000000000000000000aaaa",
    title: "Meetup BNB",
    venue_label: "Kalibata",
    center_cell: "qqguv1r",
    starts_at: "1700000000",
    ends_at: "1700003600",
    tx_hash: "0xtx",
  };

  // Postgres bigint datang sebagai STRING lewat PostgREST. Number() akan
  // kehilangan presisi pada nilai besar dan diam-diam menggeser jendela event.
  it("bigint yang datang sebagai string tetap bigint", () => {
    const e = rowToEvent(row);
    expect(e.startsAt).toBe(1_700_000_000n);
    expect(e.endsAt).toBe(1_700_003_600n);
  });

  it("bigint yang datang sebagai number juga diterima", () => {
    const e = rowToEvent({ ...row, starts_at: 1_700_000_000, ends_at: 1_700_003_600 });
    expect(e.startsAt).toBe(1_700_000_000n);
  });

  it("membawa sel pusat apa adanya", () => {
    expect(rowToEvent(row).centerCell).toBe("qqguv1r");
  });
});

describe("rowToCheckInOffer", () => {
  const row = {
    nonce: `0x${"2".repeat(64)}`,
    event_id: `0x${"1".repeat(64)}`,
    host: "0x000000000000000000000000000000000000aaaa",
    expires_at: "1700000030",
    sig_host: `0x${"3".repeat(130)}`,
    cell: "qqguv1r",
    at_ms: "1700000000000",
    consumed_at: null,
  };

  it("consumed_at null berarti belum terpakai", () => {
    expect(rowToCheckInOffer(row).consumed).toBe(false);
  });

  it("consumed_at terisi berarti sudah terpakai", () => {
    expect(rowToCheckInOffer({ ...row, consumed_at: "2026-09-05T00:00:00Z" }).consumed).toBe(true);
  });

  it("atMs kembali sebagai number milidetik", () => {
    expect(rowToCheckInOffer(row).atMs).toBe(1_700_000_000_000);
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
pnpm --filter @nearly/api test event-store-mapping
```

Diharapkan: FAIL, `Failed to resolve import "../src/event-store"`.

- [ ] **Step 3: Tulis implementasi**

Buat `apps/api/src/event-store.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hex } from "viem";
import { rankDiscovery, type DiscoveryCandidate } from "./discovery";
import type { EventRecord, EventStore, PendingCheckInOffer } from "./ports";

export type EventDbRow = {
  event_id: string; host: string; title: string; venue_label: string;
  center_cell: string; starts_at: string | number; ends_at: string | number; tx_hash: string;
};

export type OfferDbRow = {
  nonce: string; event_id: string; host: string; expires_at: string | number;
  sig_host: string; cell: string; at_ms: string | number; consumed_at: string | null;
};

export function rowToEvent(row: EventDbRow): EventRecord {
  return {
    eventId: row.event_id as Hex,
    host: row.host as Address,
    title: row.title,
    venueLabel: row.venue_label,
    centerCell: row.center_cell,
    startsAt: BigInt(row.starts_at),
    endsAt: BigInt(row.ends_at),
    txHash: row.tx_hash as Hex,
  };
}

export function rowToCheckInOffer(row: OfferDbRow): PendingCheckInOffer {
  return {
    nonce: row.nonce as Hex,
    eventId: row.event_id as Hex,
    host: row.host as Address,
    expiresAt: BigInt(row.expires_at),
    sigHost: row.sig_host as Hex,
    cell: row.cell,
    atMs: Number(row.at_ms),
    consumed: row.consumed_at !== null,
  };
}

export function createEventStore(db: SupabaseClient): EventStore {
  return {
    async recordEvent(row) {
      const { error } = await db.from("events").insert({
        event_id: row.eventId.toLowerCase(),
        host: row.host.toLowerCase(),
        title: row.title,
        venue_label: row.venueLabel,
        center_cell: row.centerCell,
        starts_at: row.startsAt.toString(),
        ends_at: row.endsAt.toString(),
        tx_hash: row.txHash,
      });
      if (error) throw new Error(`insert event gagal: ${error.message}`);
    },

    async getEvent(eventId) {
      const { data, error } = await db
        .from("events")
        .select("event_id, host, title, venue_label, center_cell, starts_at, ends_at, tx_hash")
        .eq("event_id", eventId.toLowerCase())
        .maybeSingle();
      if (error) throw new Error(`baca event gagal: ${error.message}`);
      return data ? rowToEvent(data as EventDbRow) : null;
    },

    async listDiscovery(nowSec, limit) {
      // Penyaring "host ter-slash" dan "host tanpa koneksi" dikerjakan di
      // TypeScript, bukan SQL: keduanya butuh dua tabel lain, dan PostgREST
      // tidak bisa menyatakan join semacam itu tanpa view. Jumlah event yang
      // belum berakhir selalu kecil, jadi mengambilnya lalu menyaring di sini
      // sepenuhnya wajar — dan membuat keputusannya bisa diuji tanpa database.
      const { data, error } = await db
        .from("events")
        .select("event_id, host, title, venue_label, center_cell, starts_at, ends_at, tx_hash")
        .gte("ends_at", nowSec.toString())
        .order("starts_at", { ascending: true })
        .limit(limit * 4);
      if (error) throw new Error(`baca discovery gagal: ${error.message}`);

      const events = (data ?? []).map((r) => rowToEvent(r as EventDbRow));
      if (events.length === 0) return [];

      const hosts = [...new Set(events.map((e) => e.host.toLowerCase()))];

      const [snapshots, slashes, rsvpRows] = await Promise.all([
        db.from("trust_snapshots").select("address, score").in("address", hosts),
        db.from("slashes").select("subject").in("subject", hosts),
        db.from("rsvps").select("event_id").in("event_id", events.map((e) => e.eventId)),
      ]);
      if (snapshots.error) throw new Error(`baca skor host gagal: ${snapshots.error.message}`);
      if (slashes.error) throw new Error(`baca slash gagal: ${slashes.error.message}`);
      if (rsvpRows.error) throw new Error(`baca rsvp gagal: ${rsvpRows.error.message}`);

      const scoreOf = new Map(
        (snapshots.data ?? []).map((r) => [String(r.address).toLowerCase(), Number(r.score)]),
      );
      const slashed = new Set(
        (slashes.data ?? []).map((r) => String(r.subject).toLowerCase()),
      );
      const rsvpCount = new Map<string, number>();
      for (const r of rsvpRows.data ?? []) {
        const id = String(r.event_id);
        rsvpCount.set(id, (rsvpCount.get(id) ?? 0) + 1);
      }

      const connCounts = await Promise.all(
        hosts.map(async (h) => {
          const { count, error } = await db
            .from("connections")
            .select("id", { count: "exact", head: true })
            .or(`addr_a.eq.${h},addr_b.eq.${h}`);
          if (error) throw new Error(`hitung koneksi host gagal: ${error.message}`);
          return [h, count ?? 0] as const;
        }),
      );
      const connectionsOf = new Map(connCounts);

      const candidates: DiscoveryCandidate[] = events.map((e) => ({
        ...e,
        hostScore: scoreOf.get(e.host.toLowerCase()) ?? 0,
        rsvpCount: rsvpCount.get(e.eventId) ?? 0,
        hostConnections: connectionsOf.get(e.host.toLowerCase()) ?? 0,
        hostSlashed: slashed.has(e.host.toLowerCase()),
      }));

      return rankDiscovery(candidates, nowSec).slice(0, limit);
    },

    async hasRsvp(eventId, who) {
      const { count, error } = await db
        .from("rsvps")
        .select("event_id", { count: "exact", head: true })
        .eq("event_id", eventId.toLowerCase())
        .eq("address", who.toLowerCase());
      if (error) throw new Error(`cek rsvp gagal: ${error.message}`);
      return (count ?? 0) > 0;
    },

    async recordRsvp(eventId, who) {
      const { error } = await db
        .from("rsvps")
        .insert({ event_id: eventId.toLowerCase(), address: who.toLowerCase() });
      if (error) throw new Error(`insert rsvp gagal: ${error.message}`);
    },

    async putCheckInOffer(offer) {
      const { error } = await db.from("checkin_offers").insert({
        nonce: offer.nonce.toLowerCase(),
        event_id: offer.eventId.toLowerCase(),
        host: offer.host.toLowerCase(),
        expires_at: offer.expiresAt.toString(),
        sig_host: offer.sigHost,
        cell: offer.cell,
        at_ms: offer.atMs,
      });
      if (error) throw new Error(`insert tawaran check-in gagal: ${error.message}`);
    },

    async getCheckInOffer(nonce) {
      const { data, error } = await db
        .from("checkin_offers")
        .select("nonce, event_id, host, expires_at, sig_host, cell, at_ms, consumed_at")
        .eq("nonce", nonce.toLowerCase())
        .maybeSingle();
      if (error) throw new Error(`baca tawaran check-in gagal: ${error.message}`);
      return data ? rowToCheckInOffer(data as OfferDbRow) : null;
    },

    async consumeCheckInOffer(nonce) {
      const { error } = await db
        .from("checkin_offers")
        .update({ consumed_at: new Date().toISOString() })
        .eq("nonce", nonce.toLowerCase())
        .is("consumed_at", null);
      if (error) throw new Error(`tandai tawaran terpakai gagal: ${error.message}`);
    },

    async hasCheckIn(eventId, who) {
      const { count, error } = await db
        .from("checkins")
        .select("event_id", { count: "exact", head: true })
        .eq("event_id", eventId.toLowerCase())
        .eq("address", who.toLowerCase());
      if (error) throw new Error(`cek check-in gagal: ${error.message}`);
      return (count ?? 0) > 0;
    },

    async recordCheckIn(row) {
      const { error } = await db.from("checkins").insert({
        event_id: row.eventId.toLowerCase(),
        address: row.who.toLowerCase(),
        nonce: row.nonce.toLowerCase(),
        cell: row.cell,
        at_ms: row.atMs,
        tx_hash: row.txHash,
      });
      if (error) throw new Error(`insert check-in gagal: ${error.message}`);
    },

    async attendanceSummary(eventId) {
      const id = eventId.toLowerCase();
      const [rsvps, checkins] = await Promise.all([
        db.from("rsvps").select("address").eq("event_id", id),
        db.from("checkins").select("address").eq("event_id", id),
      ]);
      if (rsvps.error) throw new Error(`hitung rsvp gagal: ${rsvps.error.message}`);
      if (checkins.error) throw new Error(`hitung check-in gagal: ${checkins.error.message}`);

      const hadir = new Set((checkins.data ?? []).map((r) => String(r.address)));
      const daftar = (rsvps.data ?? []).map((r) => String(r.address));
      return {
        rsvps: daftar.length,
        checkins: hadir.size,
        rsvpBelumHadir: daftar.filter((a) => !hadir.has(a)).length,
      };
    },
  };
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

```bash
pnpm --filter @nearly/api test event-store-mapping
```

Diharapkan: PASS, 6 test.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/event-store.ts apps/api/test/event-store-mapping.test.ts
git commit -m "feat(api): EventStore di atas Supabase"
```

---

## Task 9: Relayer & ABI

**Files:**
- Modify: `apps/api/src/abi.ts`
- Create: `apps/api/src/attendance-relayer.ts`

**Interfaces:**
- Consumes: `AttendanceChainPort` (Task 5).
- Produces: `ATTENDANCE_REGISTRY_ABI`, `createAttendanceRelayer(cfg: { rpcUrl: string; privateKey: Hex; registry: Address }): AttendanceChainPort`.

- [ ] **Step 1: Tambahkan ABI**

Tambahkan di akhir `apps/api/src/abi.ts`:

```ts
export const ATTENDANCE_REGISTRY_ABI = [
  {
    type: "function",
    name: "createEvent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "bytes32" },
      { name: "host", type: "address" },
      { name: "startsAt", type: "uint64" },
      { name: "endsAt", type: "uint64" },
      { name: "centerCell", type: "bytes32" },
      { name: "expiresAt", type: "uint64" },
      { name: "sigHost", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "checkIn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "bytes32" },
      { name: "attendee", type: "address" },
      { name: "nonce", type: "bytes32" },
      { name: "expiresAt", type: "uint64" },
      { name: "sigHost", type: "bytes" },
      { name: "sigAttendee", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "hasAttended",
    stateMutability: "view",
    inputs: [{ name: "eventId", type: "bytes32" }, { name: "who", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "DOMAIN_SEPARATOR",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes32" }],
  },
] as const;
```

- [ ] **Step 2: Tulis relayer**

Buat `apps/api/src/attendance-relayer.ts`:

```ts
import { createWalletClient, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";
import { ATTENDANCE_REGISTRY_ABI } from "./abi";
import type { AttendanceChainPort } from "./ports";

/**
 * Cermin vouch-relayer.ts. Memakai RELAYER_PRIVATE_KEY yang SAMA dengan
 * connect, vouch, dan setScore — lihat catatan serialisasi di app.ts: dua
 * transaksi bersamaan dari akun yang sama akan mengambil nonce pending yang
 * sama, dan salah satunya tergantikan diam-diam.
 */
export function createAttendanceRelayer(cfg: {
  rpcUrl: string; privateKey: Hex; registry: Address;
}): AttendanceChainPort {
  const client = createWalletClient({
    account: privateKeyToAccount(cfg.privateKey),
    chain: bscTestnet,
    transport: http(cfg.rpcUrl),
  });
  const base = { address: cfg.registry, abi: ATTENDANCE_REGISTRY_ABI } as const;

  return {
    submitCreateEvent: (a) =>
      client.writeContract({
        ...base,
        functionName: "createEvent",
        args: [a.eventId, a.host, a.startsAt, a.endsAt, a.centerCell, a.expiresAt, a.sigHost],
      }),
    submitCheckIn: (a) =>
      client.writeContract({
        ...base,
        functionName: "checkIn",
        args: [a.eventId, a.attendee, a.nonce, a.expiresAt, a.sigHost, a.sigAttendee],
      }),
  };
}
```

- [ ] **Step 3: Pastikan typecheck lulus**

```bash
pnpm --filter @nearly/api typecheck
```

Diharapkan: tanpa error.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/abi.ts apps/api/src/attendance-relayer.ts
git commit -m "feat(api): ABI dan relayer AttendanceRegistry"
```

---

## Task 10: Rute event & perangkaian

**Files:**
- Create: `apps/api/src/routes/events.ts`
- Create: `apps/api/test/events.route.test.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/src/index.ts`

**Interfaces:**
- Consumes: seluruh fungsi `event-gate.ts` (Task 5 & 6), skema Zod (Task 4), `EventDeps` (Task 5).
- Produces: `eventRoutes(deps: EventDeps & { onChanged: () => Promise<void> }): Hono`.

- [ ] **Step 1: Tulis test rute yang gagal**

Buat `apps/api/test/events.route.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { cellToBytes32, createEventTypedData } from "@nearly/shared";
import { eventRoutes } from "../src/routes/events";

const NOW = 1_700_000_000_000;
const NOW_SEC = BigInt(Math.floor(NOW / 1000));
const host = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex,
);
const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;
const EVENT_ID = `0x${"1".repeat(64)}` as Hex;

function app(over: Record<string, unknown> = {}) {
  return eventRoutes({
    events: {
      recordEvent: vi.fn(async () => {}),
      getEvent: vi.fn(async () => null),
      listDiscovery: vi.fn(async () => []),
      hasRsvp: vi.fn(async () => false),
      recordRsvp: vi.fn(async () => {}),
      putCheckInOffer: vi.fn(async () => {}),
      getCheckInOffer: vi.fn(async () => null),
      consumeCheckInOffer: vi.fn(async () => {}),
      hasCheckIn: vi.fn(async () => false),
      recordCheckIn: vi.fn(async () => {}),
      attendanceSummary: vi.fn(async () => ({ rsvps: 3, checkins: 2, rsvpBelumHadir: 1 })),
    },
    attendance: {
      submitCreateEvent: vi.fn(async (): Promise<Hex> => "0xtx" as Hex),
      submitCheckIn: vi.fn(async (): Promise<Hex> => "0xtx2" as Hex),
    },
    profiles: {},
    attendanceContract: CONTRACT,
    nowMs: () => NOW,
    onChanged: vi.fn(async () => {}),
    ...over,
  } as never);
}

async function createBody() {
  const startsAt = NOW_SEC;
  const endsAt = NOW_SEC + 3600n;
  const expiresAt = NOW_SEC + 600n;
  const msg = {
    eventId: EVENT_ID, host: host.address, startsAt, endsAt,
    centerCell: cellToBytes32("qqguv1r"), expiresAt,
  };
  return {
    eventId: EVENT_ID, host: host.address, title: "Meetup BNB", venueLabel: "Kalibata",
    cell: "qqguv1r", startsAt: startsAt.toString(), endsAt: endsAt.toString(),
    expiresAt: expiresAt.toString(),
    sigHost: await host.signTypedData(createEventTypedData(msg, CONTRACT)),
  };
}

function post(a: ReturnType<typeof app>, path: string, body: unknown) {
  return a.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /events", () => {
  it("membuat event dan mengembalikan txHash", async () => {
    const res = await post(app(), "/events", await createBody());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ txHash: "0xtx" });
  });

  it("menolak badan yang tidak sesuai skema dengan 400", async () => {
    const res = await post(app(), "/events", { title: "cuma judul" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_body" });
  });

  // Tanda tangan BERBENTUK SAH dari kunci lain, bukan heksa karangan: viem
  // melempar untuk byte v yang tidak sah, dan itu akan menghasilkan 500 —
  // menguji hal yang bukan maksud test ini. Yang diuji di sini adalah kode
  // kegagalan gerbang diteruskan beserta status HTTP-nya.
  it("meneruskan kode kegagalan gerbang beserta status HTTP-nya", async () => {
    const orangLain = privateKeyToAccount(
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex,
    );
    const startsAt = NOW_SEC;
    const endsAt = NOW_SEC + 3600n;
    const expiresAt = NOW_SEC + 600n;
    const sigHost = await orangLain.signTypedData(
      createEventTypedData(
        {
          eventId: EVENT_ID, host: host.address, startsAt, endsAt,
          centerCell: cellToBytes32("qqguv1r"), expiresAt,
        },
        CONTRACT,
      ),
    );
    const res = await post(app(), "/events", { ...(await createBody()), sigHost });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "bad_signature" });
  });
});

describe("GET /events/:id", () => {
  it("mengembalikan 404 untuk event yang tidak ada", async () => {
    const res = await app().request("/events/" + EVENT_ID);
    expect(res.status).toBe(404);
  });

  // Spec §8: detail SELALU bisa dibuka, tanpa penyaring apa pun. Ini yang
  // membuat "tetap bisa dibagikan lewat link" benar.
  it("mengembalikan event apa adanya tanpa menyaring host", async () => {
    const a = app({
      events: {
        getEvent: vi.fn(async () => ({
          eventId: EVENT_ID, host: host.address, title: "Meetup BNB",
          venueLabel: "Kalibata", centerCell: "qqguv1r",
          startsAt: NOW_SEC, endsAt: NOW_SEC + 3600n, txHash: "0xtx" as Hex,
        })),
        attendanceSummary: vi.fn(async () => ({ rsvps: 0, checkins: 0, rsvpBelumHadir: 0 })),
      },
    });
    const res = await a.request("/events/" + EVENT_ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ title: "Meetup BNB", startsAt: NOW_SEC.toString() });
  });
});

describe("GET /events", () => {
  it("mengembalikan daftar discovery", async () => {
    const res = await app().request("/events");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ events: [] });
  });
});

describe("GET /events/:id/attendance", () => {
  it("mengembalikan tiga angka", async () => {
    const res = await app().request(`/events/${EVENT_ID}/attendance`);
    expect(await res.json()).toMatchObject({ rsvps: 3, checkins: 2, rsvpBelumHadir: 1 });
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
pnpm --filter @nearly/api test events.route
```

Diharapkan: FAIL, `Failed to resolve import "../src/routes/events"`.

- [ ] **Step 3: Tulis rute**

Buat `apps/api/src/routes/events.ts`:

```ts
import { Hono } from "hono";
import type { Address, Hex } from "viem";
import {
  CheckInOfferRequestSchema, CheckInRequestSchema,
  CreateEventRequestSchema, RsvpRequestSchema,
} from "@nearly/shared";
import { acceptCheckIn, createEvent, rsvp, submitCheckInOffer } from "../event-gate";
import type { EventDeps, EventRecord } from "../ports";

const DISCOVERY_LIMIT = 50;

/** bigint tidak bisa di-JSON. Waktu keluar sebagai string, seperti expiresAt. */
function eventToJson(e: EventRecord) {
  return {
    eventId: e.eventId,
    host: e.host,
    title: e.title,
    venueLabel: e.venueLabel,
    centerCell: e.centerCell,
    startsAt: e.startsAt.toString(),
    endsAt: e.endsAt.toString(),
    txHash: e.txHash,
  };
}

export function eventRoutes(deps: EventDeps & { onChanged: () => Promise<void> }) {
  const r = new Hono();

  r.post("/events", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = CreateEventRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);

    const b = parsed.data;
    const result = await createEvent(
      {
        eventId: b.eventId as Hex,
        host: b.host as Address,
        title: b.title,
        venueLabel: b.venueLabel,
        cell: b.cell,
        startsAt: BigInt(b.startsAt),
        endsAt: BigInt(b.endsAt),
        expiresAt: BigInt(b.expiresAt),
        sigHost: b.sigHost as Hex,
      },
      deps,
    );
    if (!result.ok) return c.json(result.failure, result.failure.httpStatus);
    return c.json({ txHash: result.value.txHash });
  });

  r.get("/events", async (c) => {
    const nowSec = Math.floor(deps.nowMs() / 1000);
    const rows = await deps.events.listDiscovery(nowSec, DISCOVERY_LIMIT);
    return c.json({
      events: rows.map((e) => ({ ...eventToJson(e), hostScore: e.hostScore, rsvpCount: e.rsvpCount })),
    });
  });

  // TANPA penyaring apa pun, dengan sengaja (spec §8): inilah yang membuat
  // event host ber-trust rendah "tetap bisa dibagikan lewat link".
  r.get("/events/:id", async (c) => {
    const ev = await deps.events.getEvent(c.req.param("id") as Hex);
    if (!ev) return c.json({ code: "event_not_found" }, 404);
    const summary = await deps.events.attendanceSummary(ev.eventId);
    return c.json({ ...eventToJson(ev), ...summary });
  });

  r.get("/events/:id/attendance", async (c) => {
    const summary = await deps.events.attendanceSummary(c.req.param("id") as Hex);
    return c.json(summary);
  });

  r.post("/events/:id/rsvp", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = RsvpRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);

    const b = parsed.data;
    const result = await rsvp(
      {
        eventId: b.eventId as Hex,
        who: b.who as Address,
        expiresAt: BigInt(b.expiresAt),
        sig: b.sig as Hex,
      },
      deps,
    );
    if (!result.ok) return c.json(result.failure, result.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.post("/events/:id/checkin-offer", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = CheckInOfferRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);

    const b = parsed.data;
    const result = await submitCheckInOffer(
      {
        eventId: b.eventId as Hex,
        nonce: b.nonce as Hex,
        host: b.host as Address,
        expiresAt: BigInt(b.expiresAt),
        sigHost: b.sigHost as Hex,
        cell: b.cell,
        atMs: b.atMs,
      },
      deps,
    );
    if (!result.ok) return c.json(result.failure, result.failure.httpStatus);
    return c.json({ ok: true });
  });

  r.post("/events/:id/checkin", async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = CheckInRequestSchema.safeParse(raw);
    if (!parsed.success) return c.json({ code: "invalid_body" }, 400);

    const b = parsed.data;
    const result = await acceptCheckIn(
      {
        eventId: b.eventId as Hex,
        nonce: b.nonce as Hex,
        attendee: b.attendee as Address,
        expiresAt: BigInt(b.expiresAt),
        sigAttendee: b.sigAttendee as Hex,
        cell: b.cell,
        atMs: b.atMs,
      },
      deps,
    );
    if (!result.ok) return c.json(result.failure, result.failure.httpStatus);

    // Kehadiran baru mengubah penetapan occasion, yang mengubah diversitas,
    // yang mengubah skor. Sama seperti handshake dan vouch.
    await deps.onChanged();
    return c.json({ txHash: result.value.txHash });
  });

  return r;
}
```

- [ ] **Step 4: Pasang di app.ts**

Di `apps/api/src/app.ts`: tambahkan import

```ts
import { eventRoutes } from "./routes/events";
```

Tambahkan ke tipe `TrustDeps`:

```ts
  events: EventStore;
  attendance: AttendanceChainPort;
  attendanceContract: Address;
```

(dan tambahkan `EventStore, AttendanceChainPort` ke daftar import tipe dari `./ports`).

Lalu daftarkan rutenya, setelah `app.route("/", reportRoutes(deps));`:

```ts
  app.route("/", eventRoutes({ ...deps, onChanged }));
```

- [ ] **Step 5: Rangkai di index.ts**

Di `apps/api/src/index.ts`: tambahkan import

```ts
import { createEventStore } from "./event-store";
import { createAttendanceRelayer } from "./attendance-relayer";
```

Tambahkan pembacaan env di dekat pembacaan alamat kontrak lain:

```ts
const attendanceRegistry = required("ATTENDANCE_REGISTRY_ADDRESS") as Address;
```

Tambahkan tiga baris ke objek `createApp({ ... })`:

```ts
  events: createEventStore(supabase),
  attendance: createAttendanceRelayer({
    rpcUrl: required("RPC_URL"),
    privateKey: required("RELAYER_PRIVATE_KEY") as Hex,
    registry: attendanceRegistry,
  }),
  attendanceContract: attendanceRegistry,
```

- [ ] **Step 6: Jalankan seluruh test API**

```bash
pnpm --filter @nearly/api test && pnpm --filter @nearly/api typecheck
```

Diharapkan: PASS, 96 test lama + baru dari Task 5–10.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/events.ts apps/api/test/events.route.test.ts apps/api/src/app.ts apps/api/src/index.ts
git commit -m "feat(api): tujuh endpoint event dan perangkaiannya"
```

---

## Task 11: `occasionId` dari check-in terverifikasi

**Files:**
- Modify: `apps/api/src/trust/load-graph.ts`
- Modify: `apps/api/src/trust/store.ts`
- Modify: `apps/api/test/load-graph.test.ts`

**Interfaces:**
- Consumes: tabel `checkins` dan `events` dari Task 4.
- Produces: `eventOccasionIdOf(centerCell: string, eventId: string): string`; `GraphRows` bertambah dua bidang wajib `checkins: CheckInRow[]` dan `events: EventWindowRow[]`; tipe `CheckInRow = { event_id: string; address: string }`, `EventWindowRow = { event_id: string; center_cell: string; starts_at: string | number; ends_at: string | number }`.

**PERINGATAN PALING PENTING DI SELURUH RENCANA INI.** `regionOf()` di `packages/trust/src/diversity.ts:18` menghitung wilayah dengan `occasionId.split(":")[0].slice(0, 4)`. Format `occasionId` **tidak bebas** — bagian sebelum titik dua yang pertama WAJIB berupa sel geohash. Kalau occasion event diberi nama `evt:<eventId>`, `regionOf` akan mengembalikan `"evt"` untuk semua event, seluruh wilayah runtuh jadi satu, dan orang yang hadir di banyak acara di banyak kota justru kehilangan diversitasnya. Karena itu formatnya `${centerCell}:e:${eventId}`.

- [ ] **Step 1: Tulis test yang gagal**

Tambahkan ke `apps/api/test/load-graph.test.ts`. Pertama, **ubah helper yang sudah ada** supaya dua bidang baru punya nilai bawaan:

```ts
function rows(over: Partial<GraphRows> = {}): GraphRows {
  return { connections: [], vouches: [], seeds: [], slashes: [], checkins: [], events: [], ...over };
}
```

Lalu tambahkan blok test baru di akhir berkas:

```ts
import { eventOccasionIdOf } from "../src/trust/load-graph";
import { regionOf } from "@nearly/trust";

const EVENT_A = `0x${"a".repeat(64)}`;
const CELL = "qqguv1r";

function eventRow(over: Record<string, unknown> = {}) {
  return {
    event_id: EVENT_A,
    center_cell: CELL,
    starts_at: String(Math.floor(NOW / 1000) - 600),
    ends_at: String(Math.floor(NOW / 1000) + 3600),
    ...over,
  };
}

describe("occasion dari check-in terverifikasi", () => {
  it("koneksi dicap ke event kalau KEDUA pihak check-in di situ", () => {
    const g = rowsToGraph(
      rows({
        connections: [
          { addr_a: "0x0a", addr_b: "0x0b", cell: CELL, created_at: new Date(NOW).toISOString() },
        ],
        checkins: [
          { event_id: EVENT_A, address: "0x0a" },
          { event_id: EVENT_A, address: "0x0b" },
        ],
        events: [eventRow()],
      }),
      NOW,
    );
    expect(g.edges[0]!.occasionId).toBe(eventOccasionIdOf(CELL, EVENT_A));
  });

  it("kalau hanya satu pihak check-in, jatuh ke tebakan geohash", () => {
    const g = rowsToGraph(
      rows({
        connections: [
          { addr_a: "0x0a", addr_b: "0x0b", cell: CELL, created_at: new Date(NOW).toISOString() },
        ],
        checkins: [{ event_id: EVENT_A, address: "0x0a" }],
        events: [eventRow()],
      }),
      NOW,
    );
    expect(g.edges[0]!.occasionId).toBe(occasionIdOf(CELL, NOW));
  });

  it("salaman di luar jendela event jatuh ke tebakan geohash", () => {
    const g = rowsToGraph(
      rows({
        connections: [
          { addr_a: "0x0a", addr_b: "0x0b", cell: CELL, created_at: new Date(NOW).toISOString() },
        ],
        checkins: [
          { event_id: EVENT_A, address: "0x0a" },
          { event_id: EVENT_A, address: "0x0b" },
        ],
        events: [eventRow({
          starts_at: String(Math.floor(NOW / 1000) + 7200),
          ends_at: String(Math.floor(NOW / 1000) + 10800),
        })],
      }),
      NOW,
    );
    expect(g.edges[0]!.occasionId).toBe(occasionIdOf(CELL, NOW));
  });

  // INI test yang menahan bug paling mahal di fase ini. Kalau occasionId event
  // tidak diawali sel geohash, regionOf mengembalikan hal yang sama untuk SEMUA
  // event dan seluruh wilayah runtuh jadi satu.
  it("wilayah tetap terbaca dari occasion event, bukan runtuh jadi satu", () => {
    const jakarta = eventOccasionIdOf("qqguv1r", EVENT_A);
    const bandung = eventOccasionIdOf("qqgw2xy", `0x${"b".repeat(64)}`);
    expect(regionOf(jakarta)).toBe("qqgu");
    expect(regionOf(bandung)).toBe("qqgw");
    expect(regionOf(jakarta)).not.toBe(regionOf(bandung));
  });

  it("dua event tumpang tindih menghasilkan pilihan yang sama tiap kali", () => {
    const EVENT_B = `0x${"b".repeat(64)}`;
    const build = () =>
      rowsToGraph(
        rows({
          connections: [
            { addr_a: "0x0a", addr_b: "0x0b", cell: CELL, created_at: new Date(NOW).toISOString() },
          ],
          checkins: [
            { event_id: EVENT_B, address: "0x0a" },
            { event_id: EVENT_B, address: "0x0b" },
            { event_id: EVENT_A, address: "0x0a" },
            { event_id: EVENT_A, address: "0x0b" },
          ],
          events: [eventRow(), eventRow({ event_id: EVENT_B })],
        }),
        NOW,
      );
    expect(build().edges[0]!.occasionId).toBe(build().edges[0]!.occasionId);
    expect(build().edges[0]!.occasionId).toBe(eventOccasionIdOf(CELL, EVENT_A));
  });

  it("koneksi Fase 1 tanpa sel tetap seperti sebelumnya", () => {
    const g = rowsToGraph(
      rows({
        connections: [
          { addr_a: "0x0a", addr_b: "0x0b", cell: null, created_at: new Date(NOW).toISOString() },
        ],
        checkins: [
          { event_id: EVENT_A, address: "0x0a" },
          { event_id: EVENT_A, address: "0x0b" },
        ],
        events: [eventRow()],
      }),
      NOW,
    );
    // Check-in ADA, jadi event menang. Sel tidak dibutuhkan untuk itu — yang
    // dipakai adalah center_cell milik event.
    expect(g.edges[0]!.occasionId).toBe(eventOccasionIdOf(CELL, EVENT_A));
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
pnpm --filter @nearly/api test load-graph
```

Diharapkan: FAIL, `eventOccasionIdOf is not exported`.

- [ ] **Step 3: Ubah `load-graph.ts`**

Ganti komentar di atas `OCCASION_WINDOW_MS` dan tambahkan fungsi serta tipe baru:

```ts
/**
 * Jendela 3 jam. CADANGAN, bukan lagi jalur utama: sejak Fase 3a, koneksi yang
 * kedua pihaknya check-in di sebuah event memakai id event itu (spec §9).
 * Tebakan ini hanya dipakai kalau tidak ada event yang memenuhi.
 */
export const OCCASION_WINDOW_MS = 10_800_000;

export function occasionIdOf(cell: string, atMs: number): string {
  return `${cell}:${Math.floor(atMs / OCCASION_WINDOW_MS)}`;
}

/**
 * Occasion sebuah event. FORMATNYA TIDAK BEBAS.
 *
 * regionOf() di packages/trust/src/diversity.ts membaca wilayah dengan
 * occasionId.split(":")[0].slice(0, 4). Kalau bagian pertama bukan sel
 * geohash — misalnya "evt" — maka SETIAP event menghasilkan wilayah yang sama,
 * seluruh entropi wilayah runtuh, dan orang yang hadir di banyak acara di
 * banyak kota justru kehilangan diversitasnya. Persis kebalikan dari maksud
 * faktor ini. Dikunci sebuah test di load-graph.test.ts.
 */
export function eventOccasionIdOf(centerCell: string, eventId: string): string {
  return `${centerCell}:e:${eventId}`;
}

export type CheckInRow = { event_id: string; address: string };

export type EventWindowRow = {
  event_id: string;
  center_cell: string;
  /** unix DETIK */
  starts_at: string | number;
  /** unix DETIK */
  ends_at: string | number;
};
```

Tambahkan dua bidang ke `GraphRows`:

```ts
export type GraphRows = {
  connections: ConnRow[];
  vouches: VouchRow[];
  seeds: SeedRow[];
  slashes: SlashRow[];
  checkins: CheckInRow[];
  events: EventWindowRow[];
};
```

Tambahkan penyelesai occasion di atas `rowsToGraph`:

```ts
type EventWindow = { centerCell: string; startMs: number; endMs: number };

/**
 * Satuan waktu: starts_at/ends_at DETIK, atMs MILIDETIK. Dikalikan 1000 di
 * sini, sekali, supaya tidak ada pembanding di bawah yang perlu memikirkannya.
 */
function indexEvents(rows: EventWindowRow[]): Map<string, EventWindow> {
  const m = new Map<string, EventWindow>();
  for (const e of rows) {
    m.set(e.event_id.toLowerCase(), {
      centerCell: e.center_cell,
      startMs: Number(e.starts_at) * 1000,
      endMs: Number(e.ends_at) * 1000,
    });
  }
  return m;
}

function indexCheckins(rows: CheckInRow[]): Map<string, Set<string>> {
  const m = new Map<string, Set<string>>();
  for (const c of rows) {
    const addr = c.address.toLowerCase();
    let s = m.get(addr);
    if (!s) {
      s = new Set();
      m.set(addr, s);
    }
    s.add(c.event_id.toLowerCase());
  }
  return m;
}

/**
 * Spec §9: sebuah koneksi milik event E kalau — dan hanya kalau — KEDUA
 * pihaknya punya check-in terverifikasi di E, dan salamannya jatuh di jendela
 * waktu E.
 *
 * Kalau ada lebih dari satu E yang memenuhi (dua acara tumpang tindih yang
 * dihadiri keduanya), ambil event_id terkecil secara leksikografis. Aturan ini
 * sewenang-wenang tapi DETERMINISTIK, dan determinisme yang penting: skor
 * harus sama tiap kali dihitung ulang.
 */
function eventOccasionFor(
  a: string, b: string, atMs: number,
  checkins: Map<string, Set<string>>,
  events: Map<string, EventWindow>,
): string | null {
  const ea = checkins.get(a.toLowerCase());
  const eb = checkins.get(b.toLowerCase());
  if (!ea || !eb) return null;

  const cocok: string[] = [];
  for (const id of ea) {
    if (!eb.has(id)) continue;
    const w = events.get(id);
    if (!w) continue;
    if (atMs < w.startMs || atMs > w.endMs) continue;
    cocok.push(id);
  }
  if (cocok.length === 0) return null;

  cocok.sort();
  const pilihan = cocok[0]!;
  return eventOccasionIdOf(events.get(pilihan)!.centerCell, pilihan);
}
```

Ubah bagian `edges` di dalam `rowsToGraph`:

```ts
export function rowsToGraph(rows: GraphRows, nowMs: number): TrustGraph {
  const events = indexEvents(rows.events);
  const checkins = indexCheckins(rows.checkins);

  const edges: TrustEdge[] = rows.connections.map((r, i) => {
    const atMs = new Date(r.created_at).getTime();
    const fromEvent = eventOccasionFor(r.addr_a, r.addr_b, atMs, checkins, events);
    return {
      a: r.addr_a.toLowerCase() as Address,
      b: r.addr_b.toLowerCase() as Address,
      // Event terverifikasi menang. Kalau tidak ada, tebakan geohash Fase 2.
      // Koneksi Fase 1 tercatat sebelum kolom cell ada — jangan buang, tapi
      // juga jangan satukan jadi satu occasion raksasa.
      occasionId:
        fromEvent ?? (r.cell ? occasionIdOf(r.cell, atMs) : `tanpa-sel-${i}:0`),
      atMs,
      blocked: false,
    };
  });

  // ... sisanya tidak berubah
```

- [ ] **Step 4: Ubah `store.ts` supaya ikut membaca dua tabel baru**

Di `apps/api/src/trust/store.ts`, tambahkan dua pengambilan ke `Promise.all` di dalam `loadGraph`, dan sertakan hasilnya saat memanggil `rowsToGraph`:

```ts
        fetchAllPages<CheckInRow>(
          (f, t) =>
            db.from("checkins").select("event_id, address")
              .order("event_id", { ascending: true }).order("address", { ascending: true })
              .range(f, t) as never,
          "baca check-in",
        ),
        fetchAllPages<EventWindowRow>(
          (f, t) =>
            db.from("events").select("event_id, center_cell, starts_at, ends_at")
              .order("event_id", { ascending: true }).range(f, t) as never,
          "baca event",
        ),
```

Sesuaikan destructuring array-nya menjadi `const [connections, vouches, seeds, slashes, checkins, events] = await Promise.all([...])`, dan tambahkan `checkins, events` ke objek yang diteruskan ke `rowsToGraph`. Impor `CheckInRow` dan `EventWindowRow` dari `./load-graph`.

- [ ] **Step 5: Jalankan test, pastikan lulus**

```bash
pnpm --filter @nearly/api test && pnpm --filter @nearly/api typecheck
```

Diharapkan: PASS. Kalau test lama `rowsToGraph` gagal dengan galat tipe, helper `rows()` di Step 1 belum diperbarui.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/trust/load-graph.ts apps/api/src/trust/store.ts apps/api/test/load-graph.test.ts
git commit -m "feat(api): occasionId diambil dari check-in terverifikasi, bukan tebakan geohash"
```

---

## Task 12: Klien API & layar discovery + buat event

**Files:**
- Create: `apps/mobile/src/events-api.ts`
- Create: `apps/mobile/app/events/index.tsx`
- Create: `apps/mobile/app/events/new.tsx`
- Modify: `apps/mobile/src/config.ts`
- Modify: `apps/mobile/src/messages.ts`
- Create: `apps/mobile/test/event-messages.test.ts`

**Interfaces:**
- Consumes: `CONFIG`, `createDevSigner`, `getCurrentCell`, `ApiError` yang sudah ada.
- Produces: `getDiscovery()`, `getEvent(id)`, `postCreateEvent(b)`, `postRsvp(id, b)`, `postCheckInOffer(id, b)`, `postCheckIn(id, b)`, `eventErrorMessage(code, reason?)`, tipe `EventSummary`.

- [ ] **Step 1: Tambahkan alamat kontrak ke config**

Di `apps/mobile/src/config.ts`, tambahkan ke objek `CONFIG`:

```ts
  attendanceRegistry: required(
    "EXPO_PUBLIC_ATTENDANCE_REGISTRY",
    process.env.EXPO_PUBLIC_ATTENDANCE_REGISTRY,
  ) as Address,
```

- [ ] **Step 2: Tulis test pesan yang gagal**

Buat `apps/mobile/test/event-messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { eventErrorMessage } from "../src/messages";

describe("eventErrorMessage", () => {
  it("menjelaskan syarat RSVP tanpa menyalahkan pengguna", () => {
    expect(eventErrorMessage("not_rsvped")).toContain("RSVP");
  });

  it("menjelaskan geofence dalam bahasa manusia", () => {
    const m = eventErrorMessage("outside_geofence");
    expect(m).toMatch(/venue|lokasi/i);
    expect(m).not.toContain("geofence");
  });

  it("membedakan sel terlalu jauh dari waktu terlalu jauh", () => {
    expect(eventErrorMessage("not_colocated", "cell_too_far"))
      .not.toBe(eventErrorMessage("not_colocated", "time_too_far"));
  });

  it("kode yang tidak dikenal tetap menghasilkan kalimat, bukan undefined", () => {
    expect(typeof eventErrorMessage("entah_apa")).toBe("string");
    expect(eventErrorMessage("entah_apa").length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Jalankan test, pastikan gagal**

```bash
pnpm --filter @nearly/mobile test event-messages
```

Diharapkan: FAIL, `eventErrorMessage is not exported`.

- [ ] **Step 4: Tambahkan pesan**

Tambahkan di akhir `apps/mobile/src/messages.ts`:

```ts
const EVENT_MESSAGES: Record<string, string> = {
  not_rsvped: "RSVP dulu untuk bisa check-in di acara ini.",
  already_checked_in: "Kamu sudah check-in di acara ini.",
  already_rsvped: "Kamu sudah RSVP di acara ini.",
  event_not_live: "Check-in hanya bisa saat acara sedang berlangsung.",
  event_over: "Acara ini sudah selesai.",
  event_not_found: "Acara ini tidak ditemukan.",
  event_exists: "Acara dengan id itu sudah ada.",
  outside_geofence: "Kamu berada di luar lokasi acara. Check-in hanya bisa di venue.",
  offer_not_found: "QR check-in ini tidak dikenali. Minta host menampilkannya lagi.",
  offer_consumed: "QR check-in ini sudah terpakai. Minta host menampilkannya lagi.",
  nonce_used: "QR check-in ini sudah pernah dipakai.",
  not_host: "Hanya host acara yang bisa membuka check-in.",
  expired: "QR-nya sudah kedaluwarsa. Minta host menampilkannya lagi.",
  bad_signature: "Tanda tangan tidak cocok.",
  chain_error: "Jaringan sedang bermasalah. Coba lagi sebentar lagi.",
  invalid_body: "Ada isian yang belum benar.",
};

export function eventErrorMessage(code: string, reason?: string): string {
  if (code === "not_colocated") {
    return reason === "time_too_far"
      ? "Terlalu lama sejak QR ditampilkan. Minta host menampilkannya lagi."
      : "Kamu terlalu jauh dari host. Dekati orang yang menampilkan QR.";
  }
  return EVENT_MESSAGES[code] ?? "Gagal. Coba lagi.";
}
```

- [ ] **Step 5: Tulis klien API**

Buat `apps/mobile/src/events-api.ts`:

```ts
import type { Hex } from "viem";
import { CONFIG } from "./config";
import { ApiError } from "./api";

export type EventSummary = {
  eventId: Hex;
  host: string;
  title: string;
  venueLabel: string;
  centerCell: string;
  /** unix DETIK, sebagai string — bigint tidak bisa lewat JSON. */
  startsAt: string;
  endsAt: string;
  txHash: string;
  hostScore?: number;
  rsvpCount?: number;
  rsvps?: number;
  checkins?: number;
  rsvpBelumHadir?: number;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
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

const postJson = (path: string, body: unknown) =>
  req<Record<string, unknown>>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

export const getDiscovery = () => req<{ events: EventSummary[] }>("/events");
export const getEvent = (id: string) => req<EventSummary>(`/events/${id}`);

export const postCreateEvent = (b: Record<string, unknown>) =>
  postJson("/events", b) as Promise<{ txHash: Hex }>;

export const postRsvp = (id: string, b: Record<string, unknown>) =>
  postJson(`/events/${id}/rsvp`, b) as Promise<{ ok: true }>;

export const postCheckInOffer = (id: string, b: Record<string, unknown>) =>
  postJson(`/events/${id}/checkin-offer`, b) as Promise<{ ok: true }>;

export const postCheckIn = (id: string, b: Record<string, unknown>) =>
  postJson(`/events/${id}/checkin`, b) as Promise<{ txHash: Hex }>;
```

- [ ] **Step 6: Tulis layar discovery**

Buat `apps/mobile/app/events/index.tsx`:

```tsx
import { useCallback, useState } from "react";
import { Link, useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { getDiscovery, type EventSummary } from "../../src/events-api";

function waktuSingkat(unixSec: string): string {
  return new Date(Number(unixSec) * 1000).toLocaleString("id-ID", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function EventsScreen() {
  const [events, setEvents] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const { events: rows } = await getDiscovery();
      setEvents(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat acara.");
    }
  }, []);

  // useFocusEffect, bukan useEffect: daftar harus segar setiap kali layar ini
  // kembali terlihat — mis. sesudah membuat acara lalu menekan kembali.
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  if (error) return <View style={s.root}><Text style={s.p}>{error}</Text></View>;
  if (!events) return <View style={s.root}><ActivityIndicator /></View>;

  return (
    <View style={s.root}>
      <Link href="/events/new" style={s.buat}>Buat acara</Link>
      <FlatList
        data={events}
        keyExtractor={(e) => e.eventId}
        ListEmptyComponent={
          <Text style={s.p}>Belum ada acara yang akan datang. Kamu bisa membuat yang pertama.</Text>
        }
        renderItem={({ item }) => (
          // asChild WAJIB: Link merender Text, dan View di dalam Text tidak sah
          // di React Native. asChild membuat Pressable yang menjadi tautannya.
          <Link href={`/events/${item.eventId}`} asChild>
            <Pressable style={s.kartu}>
              <Text style={s.judul}>{item.title}</Text>
              <Text style={s.meta}>
                {waktuSingkat(item.startsAt)}
                {item.venueLabel ? ` · ${item.venueLabel}` : ""}
              </Text>
              <Text style={s.meta}>{item.rsvpCount ?? 0} RSVP</Text>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  buat: { fontSize: 16, fontWeight: "600", paddingVertical: 8 },
  kartu: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  judul: { fontSize: 16, fontWeight: "600" },
  meta: { fontSize: 13, opacity: 0.7, marginTop: 2 },
  p: { fontSize: 15, lineHeight: 22, opacity: 0.8 },
});
```

- [ ] **Step 7: Tulis layar buat event**

Buat `apps/mobile/app/events/new.tsx`:

```tsx
import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";
import { cellToBytes32, createEventTypedData, makeEventId, GEOFENCE_SPAN_M } from "@nearly/shared";
import { CONFIG } from "../../src/config";
import { createDevSigner } from "../../src/signer";
import { getCurrentCell } from "../../src/location";
import { ApiError } from "../../src/api";
import { postCreateEvent } from "../../src/events-api";
import { eventErrorMessage } from "../../src/messages";

/** Acara berdurasi tiga jam mulai sekarang. Fase ini tidak punya pemilih tanggal. */
const DURASI_DETIK = 3 * 3600;

export default function NewEventScreen() {
  const router = useRouter();
  // WAJIB useMemo — signer di badan komponen lahir baru tiap render.
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.attendanceRegistry),
    [],
  );

  const [title, setTitle] = useState("");
  const [venue, setVenue] = useState("");
  const [busy, setBusy] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  async function buat() {
    if (busy || title.trim().length === 0) return;
    setBusy(true);
    try {
      const { cell } = await getCurrentCell();
      const eventId = makeEventId();
      const startsAt = BigInt(Math.floor(Date.now() / 1000));
      const endsAt = startsAt + BigInt(DURASI_DETIK);
      const expiresAt = startsAt + 600n;

      const sigHost = await signer.signTypedData(
        createEventTypedData(
          {
            eventId, host: signer.address, startsAt, endsAt,
            centerCell: cellToBytes32(cell), expiresAt,
          },
          CONFIG.attendanceRegistry,
        ),
      );

      await postCreateEvent({
        eventId, host: signer.address, title: title.trim(), venueLabel: venue.trim(),
        cell, startsAt: startsAt.toString(), endsAt: endsAt.toString(),
        expiresAt: expiresAt.toString(), sigHost,
      });
      router.replace(`/events/${eventId}`);
    } catch (e) {
      setPesan(
        e instanceof ApiError
          ? eventErrorMessage(e.code, e.reason)
          : e instanceof Error ? e.message : "Gagal membuat acara.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.root}>
      <TextInput
        style={s.input} placeholder="Nama acara" value={title} onChangeText={setTitle}
      />
      <TextInput
        style={s.input} placeholder="Nama tempat (opsional)" value={venue} onChangeText={setVenue}
      />
      <Text style={s.catatan}>
        Lokasi kamu saat menekan tombol ini menjadi pusat area acara
        (sekitar {GEOFENCE_SPAN_M} meter). Berdirilah di venue.
      </Text>
      <Button title={busy ? "Membuat…" : "Buat acara"} onPress={() => void buat()} disabled={busy} />
      {pesan && <Text style={s.p}>{pesan}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 12 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12, fontSize: 16 },
  catatan: { fontSize: 13, opacity: 0.7, lineHeight: 19 },
  p: { fontSize: 15, lineHeight: 22 },
});
```

- [ ] **Step 8: Jalankan test dan typecheck**

```bash
pnpm --filter @nearly/mobile test && pnpm --filter @nearly/mobile typecheck
```

Diharapkan: PASS, 31 test lama + 4 baru.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile/src/events-api.ts apps/mobile/src/config.ts apps/mobile/src/messages.ts apps/mobile/test/event-messages.test.ts apps/mobile/app/events/index.tsx apps/mobile/app/events/new.tsx
git commit -m "feat(mobile): klien API event, layar discovery, dan layar buat acara"
```

---

## Task 13: Layar detail, QR host, dan pemindai check-in

**Files:**
- Modify: `packages/shared/src/event.ts`
- Create: `packages/shared/test/checkin-qr.test.ts`
- Create: `apps/mobile/src/events/useCheckInQr.ts`
- Create: `apps/mobile/app/events/[id].tsx`
- Create: `apps/mobile/app/events/[id]/host-qr.tsx`
- Modify: `apps/mobile/app/scan.tsx`

**Interfaces:**
- Consumes: `postRsvp`, `postCheckInOffer`, `postCheckIn`, `getEvent` (Task 12); `checkInOfferTypedData`, `checkInAcceptTypedData`, `makeNonce`, `qrExpiresAt`, `QR_TTL_MS`.
- Produces: `CheckInQrPayload`, `encodeCheckInQr(p)`, `decodeCheckInQr(s)`, `useCheckInQr(signer, eventId)`.

- [ ] **Step 1: Tulis test kodek QR yang gagal**

Buat `packages/shared/test/checkin-qr.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { decodeCheckInQr, encodeCheckInQr } from "../src/event";
import { decodeQr } from "../src/qr";

const payload = {
  v: 1 as const,
  k: "checkin" as const,
  eventId: `0x${"1".repeat(64)}` as Hex,
  nonce: `0x${"2".repeat(64)}` as Hex,
  expiresAt: 1_700_000_030n,
  sigHost: `0x${"3".repeat(130)}` as Hex,
};

describe("QR check-in", () => {
  it("bolak-balik menghasilkan payload yang sama", () => {
    expect(decodeCheckInQr(encodeCheckInQr(payload))).toEqual(payload);
  });

  it("mengembalikan null untuk teks yang bukan JSON", () => {
    expect(decodeCheckInQr("bukan json")).toBeNull();
  });

  it("mengembalikan null untuk JSON tanpa penanda checkin", () => {
    expect(decodeCheckInQr(JSON.stringify({ v: 1, e: "x" }))).toBeNull();
  });

  it("mengembalikan null untuk tanda tangan yang panjangnya salah", () => {
    const rusak = JSON.parse(encodeCheckInQr(payload));
    rusak.s = "0x00";
    expect(decodeCheckInQr(JSON.stringify(rusak))).toBeNull();
  });

  // Dua jenis QR hidup berdampingan di satu pemindai. Kalau salah satu bisa
  // dibaca sebagai yang lain, pemindai akan menjalankan alur yang salah.
  it("QR check-in tidak terbaca sebagai QR handshake", () => {
    expect(decodeQr(encodeCheckInQr(payload))).toBeNull();
  });
});
```

- [ ] **Step 2: Jalankan test, pastikan gagal**

```bash
pnpm --filter @nearly/shared test checkin-qr
```

Diharapkan: FAIL, `encodeCheckInQr is not exported`.

- [ ] **Step 3: Tambahkan kodek QR ke `event.ts`**

Tambahkan di akhir `packages/shared/src/event.ts`:

```ts
/**
 * Payload QR yang ditampilkan HOST di layar check-in.
 *
 * `k: "checkin"` adalah penandanya. Dua jenis QR hidup berdampingan di satu
 * pemindai, dan kalau salah satunya bisa dibaca sebagai yang lain, pemindai
 * akan menjalankan alur yang salah — koneksi baru, misalnya, alih-alih
 * kehadiran. Dikunci sebuah test.
 */
export type CheckInQrPayload = {
  v: 1;
  k: "checkin";
  eventId: Hex;
  nonce: Hex;
  expiresAt: bigint;
  sigHost: Hex;
};

const BYTES32_RE = /^0x[0-9a-fA-F]{64}$/;
const SIG_RE = /^0x[0-9a-fA-F]{130}$/;

export function encodeCheckInQr(p: CheckInQrPayload): string {
  return JSON.stringify({
    v: p.v, k: p.k, ev: p.eventId, n: p.nonce, e: p.expiresAt.toString(), s: p.sigHost,
  });
}

/** Mengembalikan null untuk apa pun yang tidak sah. QR bisa berisi apa saja. */
export function decodeCheckInQr(s: string): CheckInQrPayload | null {
  let raw: unknown;
  try {
    raw = JSON.parse(s);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;

  const o = raw as Record<string, unknown>;
  if (o.v !== 1 || o.k !== "checkin") return null;
  if (typeof o.ev !== "string" || !BYTES32_RE.test(o.ev)) return null;
  if (typeof o.n !== "string" || !BYTES32_RE.test(o.n)) return null;
  if (typeof o.s !== "string" || !SIG_RE.test(o.s)) return null;
  if (typeof o.e !== "string" || !/^\d+$/.test(o.e)) return null;

  return {
    v: 1,
    k: "checkin",
    eventId: o.ev as Hex,
    nonce: o.n as Hex,
    expiresAt: BigInt(o.e),
    sigHost: o.s as Hex,
  };
}
```

- [ ] **Step 4: Jalankan test, pastikan lulus**

```bash
pnpm --filter @nearly/shared test checkin-qr
```

Diharapkan: PASS, 5 test.

- [ ] **Step 5: Tulis hook rotasi QR host**

Buat `apps/mobile/src/events/useCheckInQr.ts`:

```ts
import { useCallback, useEffect, useState } from "react";
import type { Hex } from "viem";
import {
  checkInOfferTypedData, encodeCheckInQr, makeNonce, qrExpiresAt, QR_TTL_MS,
} from "@nearly/shared";
import { CONFIG } from "../config";
import type { NearlySigner } from "../signer";
import { getCurrentCell } from "../location";
import { postCheckInOffer } from "../events-api";

/**
 * Cermin useRotatingQr Fase 1: tiap 30 detik ambil lokasi SENDIRI, tanda
 * tangani tawaran, kirim ke server beserta lokasi sendiri, lalu tampilkan.
 * Lokasi host tidak pernah dititipkan lewat tamu.
 */
export function useCheckInQr(signer: NearlySigner, eventId: Hex) {
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(QR_TTL_MS / 1000);

  const refresh = useCallback(async () => {
    try {
      const { cell, atMs } = await getCurrentCell();
      const nonce = makeNonce();
      const expiresAt = qrExpiresAt(Date.now());
      const sigHost = await signer.signTypedData(
        checkInOfferTypedData({ eventId, nonce, expiresAt }, CONFIG.attendanceRegistry),
      );

      await postCheckInOffer(eventId, {
        eventId, nonce, host: signer.address,
        expiresAt: expiresAt.toString(), sigHost, cell, atMs,
      });

      setValue(encodeCheckInQr({ v: 1, k: "checkin", eventId, nonce, expiresAt, sigHost }));
      setSecondsLeft(QR_TTL_MS / 1000);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyiapkan QR check-in");
    }
  }, [signer, eventId]);

  useEffect(() => {
    void refresh();
    const rotate = setInterval(() => void refresh(), QR_TTL_MS);
    const tick = setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => {
      clearInterval(rotate);
      clearInterval(tick);
    };
  }, [refresh]);

  return { value, secondsLeft, error, refresh };
}
```

- [ ] **Step 6: Tulis layar QR host**

Buat `apps/mobile/app/events/[id]/host-qr.tsx`:

```tsx
import { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import type { Hex } from "viem";
import { CONFIG } from "../../../src/config";
import { createDevSigner } from "../../../src/signer";
import { useCheckInQr } from "../../../src/events/useCheckInQr";

export default function HostQrScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.attendanceRegistry),
    [],
  );
  const { value, secondsLeft, error } = useCheckInQr(signer, id as Hex);

  if (error) return <View style={s.root}><Text style={s.err}>{error}</Text></View>;
  if (!value) return <View style={s.root}><ActivityIndicator /></View>;

  return (
    <View style={s.root}>
      <QRCode value={value} size={260} />
      <Text style={s.hint}>
        Minta tamu memindai ini untuk check-in. Berganti dalam {secondsLeft} detik.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, padding: 24 },
  hint: { fontSize: 15, opacity: 0.7, textAlign: "center" },
  err: { fontSize: 15, textAlign: "center" },
});
```

- [ ] **Step 7: Tulis layar detail event**

Buat `apps/mobile/app/events/[id].tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";
import type { Hex } from "viem";
import { isEventLive, rsvpTypedData } from "@nearly/shared";
import { CONFIG } from "../../src/config";
import { createDevSigner } from "../../src/signer";
import { ApiError } from "../../src/api";
import { getEvent, postRsvp, type EventSummary } from "../../src/events-api";
import { eventErrorMessage } from "../../src/messages";

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const signer = useMemo(
    () => createDevSigner(CONFIG.devPrivateKey!, CONFIG.attendanceRegistry),
    [],
  );

  const [ev, setEv] = useState<EventSummary | null>(null);
  const [sudahRsvp, setSudahRsvp] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setEv(await getEvent(id));
    } catch (e) {
      setPesan(e instanceof ApiError ? eventErrorMessage(e.code) : "Gagal memuat acara.");
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function rsvp() {
    if (busy || !ev) return;
    setBusy(true);
    try {
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 600);
      const sig = await signer.signTypedData(
        rsvpTypedData(
          { eventId: ev.eventId, who: signer.address, expiresAt },
          CONFIG.attendanceRegistry,
        ),
      );
      await postRsvp(ev.eventId, {
        eventId: ev.eventId, who: signer.address, expiresAt: expiresAt.toString(), sig,
      });
      setSudahRsvp(true);
      setPesan("RSVP tercatat. Check-in di venue dengan memindai QR host.");
      await load();
    } catch (e) {
      if (e instanceof ApiError && e.code === "already_rsvped") setSudahRsvp(true);
      setPesan(e instanceof ApiError ? eventErrorMessage(e.code, e.reason) : "RSVP gagal.");
    } finally {
      setBusy(false);
    }
  }

  if (!ev) return <View style={s.root}><ActivityIndicator /></View>;

  const berlangsung = isEventLive(BigInt(ev.startsAt), BigInt(ev.endsAt), Date.now());
  const akuHost = ev.host.toLowerCase() === signer.address.toLowerCase();

  // Tombol check-in TIDAK PERNAH gagal diam-diam (spec §2.2): syaratnya
  // terbaca sebelum orang berdiri di depan host, bukan sesudah.
  const alasanTakBisaCheckIn = !sudahRsvp
    ? "RSVP dulu untuk bisa check-in."
    : !berlangsung
      ? "Check-in terbuka saat acara berlangsung."
      : null;

  return (
    <View style={s.root}>
      <Text style={s.judul}>{ev.title}</Text>
      {ev.venueLabel ? <Text style={s.meta}>{ev.venueLabel}</Text> : null}
      <Text style={s.meta}>
        {new Date(Number(ev.startsAt) * 1000).toLocaleString("id-ID")}
      </Text>
      <Text style={s.meta}>
        {ev.rsvps ?? 0} RSVP · {ev.checkins ?? 0} hadir · {ev.rsvpBelumHadir ?? 0} belum hadir
      </Text>

      {!sudahRsvp && (
        <Button title={busy ? "Mengirim…" : "RSVP"} onPress={() => void rsvp()} disabled={busy} />
      )}

      {alasanTakBisaCheckIn
        ? <Text style={s.nonaktif}>{alasanTakBisaCheckIn}</Text>
        : <Link href="/scan" style={s.aksi}>Pindai QR host untuk check-in</Link>}

      {akuHost && (
        <Link href={`/events/${ev.eventId}/host-qr`} style={s.aksi}>
          Buka QR check-in (kamu host)
        </Link>
      )}

      {pesan && <Text style={s.p}>{pesan}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, padding: 16, gap: 10 },
  judul: { fontSize: 22, fontWeight: "700" },
  meta: { fontSize: 14, opacity: 0.75 },
  aksi: { fontSize: 16, fontWeight: "600", paddingVertical: 10 },
  nonaktif: { fontSize: 15, opacity: 0.45, paddingVertical: 10 },
  p: { fontSize: 15, lineHeight: 22 },
});
```

- [ ] **Step 8: Ajari pemindai mengenali QR check-in**

Di `apps/mobile/app/scan.tsx`, **ubah** baris import `@nearly/shared` yang sudah ada menjadi:

```ts
import { checkInAcceptTypedData, decodeCheckInQr, decodeQr, isQrExpired } from "@nearly/shared";
```

**ubah** baris import `messages` yang sudah ada menjadi:

```ts
import { eventErrorMessage, handshakeErrorMessage } from "../src/messages";
```

dan tambahkan satu import baru:

```ts
import { postCheckIn } from "../src/events-api";
```

Lalu di awal `onScan`, **sebelum** `const payload = decodeQr(data);`, sisipkan cabang check-in.
Cabang ini memakai try/catch-nya SENDIRI: kesalahan check-in memakai kosakata event, dan
mencampurnya ke catch handshake di bawah akan memaksa penebakan kode berdasarkan kalimat
cadangan — cara yang rapuh dan pasti rusak begitu salah satu kalimat diubah.

```ts
      // QR check-in dicoba LEBIH DULU. Keduanya JSON, dan hanya yang ini
      // membawa penanda k:"checkin" — jadi urutannya tidak ambigu, tapi
      // menaruhnya belakangan akan membuat alur yang salah berjalan duluan.
      const checkin = decodeCheckInQr(data);
      if (checkin) {
        try {
          if (Date.now() > Number(checkin.expiresAt) * 1000) {
            setResult(eventErrorMessage("expired"));
            return;
          }
          const signer = createDevSigner(CONFIG.devPrivateKey!, CONFIG.attendanceRegistry);
          const { cell, atMs } = await getCurrentCell();
          const sigAttendee = await signer.signTypedData(
            checkInAcceptTypedData(
              {
                eventId: checkin.eventId, nonce: checkin.nonce,
                attendee: signer.address, expiresAt: checkin.expiresAt,
              },
              CONFIG.attendanceRegistry,
            ),
          );
          const { txHash } = await postCheckIn(checkin.eventId, {
            eventId: checkin.eventId, nonce: checkin.nonce, attendee: signer.address,
            expiresAt: checkin.expiresAt.toString(), sigAttendee, cell, atMs,
          });
          setResult(`Check-in berhasil. ${txHash.slice(0, 10)}…`);
        } catch (e) {
          setResult(
            e instanceof ApiError
              ? eventErrorMessage(e.code, e.reason)
              : e instanceof Error ? e.message : "Check-in gagal.",
          );
        }
        return;
      }
```

Blok `catch` yang sudah ada di bawahnya **tidak diubah sama sekali** — ia tetap menangani
handshake saja, dan kalimat cadangannya tetap `"Handshake gagal. Coba lagi."`.

- [ ] **Step 9: Jalankan seluruh test dan typecheck**

```bash
pnpm --filter @nearly/shared test && pnpm --filter @nearly/mobile test && pnpm --filter @nearly/mobile typecheck
```

Diharapkan: PASS di ketiganya.

- [ ] **Step 10: Commit**

```bash
git add packages/shared/src/event.ts packages/shared/test/checkin-qr.test.ts apps/mobile/src/events/useCheckInQr.ts apps/mobile/app/events apps/mobile/app/scan.tsx
git commit -m "feat(mobile): layar detail event, QR check-in host, dan pemindai check-in"
```

---

## Task 14: Deploy & verifikasi lapangan

**Files:**
- Modify: `.env` API (tidak di-commit), `apps/mobile/.env` (tidak di-commit)
- Modify: `docs/superpowers/specs/2026-09-05-nearly-fase-3a-event-design.md` (catat alamat kontrak)

**Interfaces:**
- Consumes: `DeployPhase3a` (Task 3), seluruh perangkaian Task 10.

- [ ] **Step 1: Jalankan seluruh test satu repo**

```bash
pnpm -r test && cd packages/contracts && forge test
```

Diharapkan: seluruh paket hijau. Jangan lanjut kalau ada satu pun yang merah.

- [ ] **Step 2: Deploy `AttendanceRegistry` ke BSC testnet**

```bash
cd packages/contracts && forge script script/Deploy.s.sol:DeployPhase3a --rpc-url "$RPC_URL" --broadcast --private-key "$RELAYER_PRIVATE_KEY"
```

`ATTESTOR_ADDRESS` harus sudah ada di environment dan **wajib sama** dengan alamat relayer `0xD4f3eb5724ECcAd969331144385C08a14325284E`. Kalau berbeda, setiap panggilan akan revert `NotAttestor`.

Catat alamat kontrak dari keluaran.

- [ ] **Step 3: Isi environment**

Di `.env` API:

```
ATTENDANCE_REGISTRY_ADDRESS=0x...
```

Di `apps/mobile/.env`:

```
EXPO_PUBLIC_ATTENDANCE_REGISTRY=0x...
```

Nilainya **harus alamat yang sama**. Domain EIP-712 terikat ke `verifyingContract`; kalau kedua sisi berbeda, setiap tanda tangan ditolak dengan `bad_signature` dan pesannya tidak menunjukkan penyebabnya.

- [ ] **Step 4: Verifikasi alur lengkap dengan dua perangkat**

Jalankan API, lalu di dua perangkat (atau satu perangkat + satu simulator dengan dompet berbeda):

1. Perangkat A membuat acara sambil berdiri di venue → cek `events` di Supabase dan transaksi `EventCreated` di explorer.
2. Perangkat B membuka discovery → acara itu muncul.
3. Perangkat B menekan check-in **sebelum** RSVP → tombolnya nonaktif dengan keterangan "RSVP dulu untuk bisa check-in."
4. Perangkat B RSVP → baris muncul di `rsvps`.
5. Perangkat A membuka QR check-in; perangkat B memindainya → `CheckedIn` muncul di explorer, baris muncul di `checkins`.
6. Perangkat B memindai QR yang sama lagi → ditolak `offer_consumed`.
7. Bawa perangkat B keluar dari area (lebih dari ~250 m), minta QR baru, pindai → ditolak `outside_geofence`.

- [ ] **Step 5: Verifikasi sambungan trust**

Setelah kedua perangkat check-in di acara yang sama, lakukan handshake di antara keduanya, lalu:

```bash
curl -s localhost:8787/trust/<alamat-A> | jq
```

Diharapkan: `occasions` bertambah, dan skor terhitung ulang tanpa error di log API.

- [ ] **Step 6: Catat alamat kontrak di spec**

Tambahkan satu baris di §7.3 spec Fase 3a:

```markdown
**Alamat ter-deploy:** `AttendanceRegistry` `0x...` (BSC testnet, chainId 97).
```

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/specs/2026-09-05-nearly-fase-3a-event-design.md
git commit -m "docs: catat alamat AttendanceRegistry yang ter-deploy"
```

---

## Catatan Tinjauan Mandiri

Diperiksa terhadap spec setelah rencana selesai ditulis.

**Cakupan spec.** Setiap bab spec punya task: §5 geofence → Task 1; §7 kontrak → Task 3; §4 data → Task 4; §6 alur check-in → Task 6; §8 discovery → Task 7; §9 sambungan trust → Task 11; §10 endpoint → Task 10; §11 mobile → Task 12 & 13; §12 verifikasi → tersebar di seluruh task plus Task 14.

**Tiga hal yang ditemukan dan diperbaiki saat menulis rencana:**

1. **Format `occasionId` tidak bebas.** `regionOf()` membaca wilayah dari bagian sebelum titik dua. Occasion event karena itu berbentuk `${centerCell}:e:${eventId}`, bukan `evt:${eventId}`, dan Task 11 mengunci ini dengan test tersendiri.
2. **Tanda tangan tamu diverifikasi memakai `offer.expiresAt`, bukan nilai dari badan permintaan** — kalau tidak, tamu bisa mengarang `expiresAt` sendiri dan server meneruskan transaksi yang pasti ditolak kontrak.
3. **Baris event tidak ditulis sebelum transaksi berhasil.** Event yang ada di Postgres tapi tidak ada on-chain membuat setiap check-in ke event itu revert `EventUnknown` tanpa penyebab yang terlihat.

**Yang sengaja tidak ada** (spec §14): tiket berbayar, waitlist, alur persetujuan, event berulang, co-host, kalender & email, pembatalan RSVP, penyuntingan/pembatalan event, badge ERC-721, "ingin bertemu" (Fase 3b), Radar (Fase 4).
