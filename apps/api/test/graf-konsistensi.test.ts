import { describe, expect, it } from "vitest";
import { eventOccasionIdOf, rowsToGraph } from "../src/trust/load-graph";
import { alamat, duniaGraf, idAcara, iso, muatSemua, NOW_GRAF, type DataDunia } from "./support/dunia-graf";

/**
 * Aturan "salaman di acara ini" di layar proyektor WAJIB identik dengan aturan
 * trust (spec 6 §4.3). Tes ini tidak menulis ulang aturannya: ia menjalankan
 * `rowsToGraph` yang SUNGGUHAN pada baris yang sama persis dengan yang dibaca
 * rute graf, lalu membandingkan himpunan id.
 */

const JAM = 3_600;
const T0 = 1_789_000_000; // unix DETIK

const A = alamat(0xa);
const B = alamat(0xb);
const C = alamat(0xc);
const D = alamat(0xd);
const E = alamat(0xe);
const F = alamat(0xf);
const G = alamat(0x10);

// E1 dan E2 tumpang tindih di [T0+2j, T0+4j]. E3 hari lain.
const E1 = idAcara("11");
const E2 = idAcara("22");
const E3 = idAcara("33");

function koneksi(id: number, a: string, b: string, detik: number) {
  const [x, y] = a < b ? [a, b] : [b, a];
  return {
    id, addr_a: x, addr_b: y, created_at: iso(detik * 1000),
    tx_hash: `0x${String(id).padStart(64, "0")}`, cell: "qqguv1r", nonce: `0x${String(id).padStart(64, "9")}`,
  };
}

function checkin(eventId: string, address: string) {
  return { event_id: eventId, address, cell: "qqguv1r", nonce: `0x${address.slice(2)}${eventId.slice(2, 26)}` };
}

const DATA: Partial<DataDunia> = {
  events: [
    { event_id: E1, host: A, title: "Satu", center_cell: "qqguv1r", starts_at: T0, ends_at: T0 + 4 * JAM },
    { event_id: E2, host: B, title: "Dua", center_cell: "qqguv1x", starts_at: T0 + 2 * JAM, ends_at: T0 + 6 * JAM },
    { event_id: E3, host: C, title: "Tiga", center_cell: "w1xyz00", starts_at: T0 + 48 * JAM, ends_at: T0 + 52 * JAM },
  ],
  checkins: [
    checkin(E1, A), checkin(E1, B), checkin(E1, C), checkin(E1, D),
    checkin(E2, A), checkin(E2, B), checkin(E2, E),
    checkin(E3, D), checkin(E3, G),
  ],
  connections: [
    // Di jendela E1, keduanya check-in di E1 → MASUK E1.
    koneksi(1, C, D, T0 + 1 * JAM),
    // Dua acara tumpang tindih: A dan B check-in di E1 DAN E2, salaman di
    // irisan jendela → trust memilih event_id terkecil (E1). TIDAK masuk E2.
    koneksi(2, A, B, T0 + 3 * JAM),
    // Keduanya check-in di E1 tetapi DI LUAR jendela E1 → tidak masuk E1.
    koneksi(3, B, C, T0 + 5 * JAM),
    // Satu pihak (F) belum check-in di mana pun → tidak masuk.
    koneksi(4, A, F, T0 + 1 * JAM),
    // Di jendela E2, keduanya check-in di E2 → MASUK E2.
    koneksi(5, A, E, T0 + 5 * JAM),
    // Di irisan waktu, tapi E hanya check-in di E2 → MASUK E2.
    koneksi(6, B, E, T0 + 3 * JAM),
    // Tepat di detik ends_at E1 → jendela inklusif, MASUK E1.
    koneksi(7, A, D, T0 + 4 * JAM),
    // Keduanya check-in di E3 tapi salaman dua hari sebelum E3 → tidak masuk.
    koneksi(8, D, G, T0 + 1 * JAM),
  ],
  blocks: [{ blocker: A, blocked: B }, { blocker: B, blocked: A }],
};

function idsMenurutTrust(eventId: string): number[] {
  const d = duniaGraf(DATA);
  const g = rowsToGraph(d.barisTrust(), NOW_GRAF);
  const ev = d.data.events.find((e) => e.event_id === eventId)!;
  const occ = eventOccasionIdOf(ev.center_cell, eventId);
  return d.data.connections
    .filter((_, i) => g.edges[i]!.occasionId === occ)
    .map((c) => c.id)
    .sort((x, y) => x - y);
}

async function idsMenurutGraf(eventId: string): Promise<number[]> {
  const d = duniaGraf(DATA);
  const { ids } = await muatSemua(d.app, `/graf/acara/${eventId}`);
  return [...ids].sort((x, y) => x - y);
}

describe("konsistensi aturan acara dengan rowsToGraph", () => {
  it("acara pertama: di jendela & keduanya check-in masuk; luar jendela, satu pihak belum check-in, dan seri tumpang tindih ke acara ini", async () => {
    expect(idsMenurutTrust(E1)).toEqual([1, 2, 7]);
    expect(await idsMenurutGraf(E1)).toEqual(idsMenurutTrust(E1));
  });

  it("acara kedua yang tumpang tindih: salaman yang trust berikan ke acara pertama tidak ikut tampil", async () => {
    expect(idsMenurutTrust(E2)).toEqual([5, 6]);
    expect(await idsMenurutGraf(E2)).toEqual(idsMenurutTrust(E2));
  });

  it("acara tanpa salaman di jendelanya: kosong di kedua sisi", async () => {
    expect(idsMenurutTrust(E3)).toEqual([]);
    expect(await idsMenurutGraf(E3)).toEqual([]);
  });

  it("hitungan salaman sama dengan jumlah sisi menurut trust, hadir sama dengan check-in", async () => {
    const d = duniaGraf(DATA);
    const res = await d.app.request(`/graf/acara/${E1}`);
    const body = await res.json() as { hitungan: { hadir: number; salaman: number } };
    expect(body.hitungan).toEqual({ hadir: 4, salaman: idsMenurutTrust(E1).length });
  });
});
