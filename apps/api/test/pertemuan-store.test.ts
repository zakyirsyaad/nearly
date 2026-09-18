import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import { createPertemuanStore } from "../src/pertemuan-store";
import { supabaseMemori } from "./support/supabase-memori";

const a = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;
const ev = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex;
const barisAcara = (n: number) => ({
  event_id: ev(n), host: a(0xdead), title: `Acara ${n}`, venue_label: "Kalibata", center_cell: "qqguv1r",
  starts_at: 1_700_000_000 + n, ends_at: 1_700_003_600 + n, tx_hash: "0xtx",
});

// Pemetaan store riwayat pertemuan (spec desain UI §8.1, §8.2, §10.2).
describe("createPertemuanStore", () => {
  it("koneksiPasangan membaca satu baris kanonik untuk kedua urutan argumen", async () => {
    const { db } = supabaseMemori({
      connections: [{
        id: 1, addr_a: a(1), addr_b: a(2), nonce: "0x1", tx_hash: "0xtx",
        created_at: "2023-11-14T22:13:20.000Z", cell: "qqguv1r",
      }],
    });
    const store = createPertemuanStore(db);
    const harapan = { atMs: 1_700_000_000_000, cell: "qqguv1r" };
    expect(await store.koneksiPasangan(a(1), a(2))).toEqual(harapan);
    expect(await store.koneksiPasangan(a(2), a(1))).toEqual(harapan);
  });

  it("koneksiPasangan: tanpa baris → null; koneksi lama tanpa sel → cell null", async () => {
    const { db } = supabaseMemori({
      connections: [{ id: 1, addr_a: a(1), addr_b: a(2), created_at: "2023-11-14T22:13:20.000Z", cell: null }],
    });
    const store = createPertemuanStore(db);
    expect(await store.koneksiPasangan(a(1), a(3))).toBeNull();
    expect(await store.koneksiPasangan(a(2), a(1))).toEqual({ atMs: 1_700_000_000_000, cell: null });
  });

  it("acaraCheckInBersama melewati batas halaman 1000 dan hanya memuat acara yang keduanya check-in", async () => {
    const N = 1001;
    const events = Array.from({ length: N + 2 }, (_, i) => barisAcara(i + 1));
    const checkins = [
      ...Array.from({ length: N }, (_, i) => [
        { event_id: ev(i + 1), address: a(1) },
        { event_id: ev(i + 1), address: a(2) },
      ]).flat(),
      { event_id: ev(N + 1), address: a(1) },
      { event_id: ev(N + 2), address: a(2) },
    ];
    const { db } = supabaseMemori({ events, checkins });
    const hasil = await createPertemuanStore(db).acaraCheckInBersama(a(1), a(2));
    expect(hasil).toHaveLength(N);
    const id = new Set(hasil.map((h) => h.eventId));
    expect(id.has(ev(N + 1))).toBe(false);
    expect(id.has(ev(N + 2))).toBe(false);
    expect(hasil.find((h) => h.eventId === ev(7))).toEqual({
      eventId: ev(7), title: "Acara 7", venueLabel: "Kalibata", centerCell: "qqguv1r",
      startsAt: 1_700_000_007, endsAt: 1_700_003_607,
    });
  });

  it("penjaminAktif hanya vouch yang belum dicabut, huruf kecil", async () => {
    const { db } = supabaseMemori({
      vouches: [
        { from_addr: a(3), to_addr: a(2), revoked_at: null },
        { from_addr: a(4), to_addr: a(2), revoked_at: "2023-11-14T22:13:20.000Z" },
        { from_addr: a(5), to_addr: a(6), revoked_at: null },
      ],
    });
    expect(await createPertemuanStore(db).penjaminAktif(a(2))).toEqual([a(3)]);
  });
});
