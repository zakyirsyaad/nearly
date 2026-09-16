import { describe, expect, it } from "vitest";
import { createRadarStore, RETENSI_LOKASI_MS } from "../src/radar-store";
import { supabaseMemori } from "./support/supabase-memori";

/**
 * TES PRIVASI RETENSI (spec induk §13, spec 4b+5 §4.5, §11).
 *
 * Jam palsu: `nowMs` diberikan langsung ke `sapuLokasi`. Yang diperiksa adalah
 * ISI tabel sesudah sapuan — bukan bentuk kueri — supaya sapuan yang salah
 * sasaran (menghapus baris offer, menyentuh `connections`) benar-benar merah.
 */
const NOW = Date.parse("2026-09-14T12:00:00.000Z");
const NOW_DETIK = Math.floor(NOW / 1000);
const JAM = 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();
const A = `0x${"a".repeat(40)}`;
const B = `0x${"b".repeat(40)}`;
const E = `0x${"e".repeat(64)}`;

function dunia() {
  return supabaseMemori({
    kehadiran: [
      { event_id: E, address: A, cell: "qqguv1r", seen_at: iso(NOW - 25 * JAM) },
      { event_id: E, address: B, cell: "qqguv1r", seen_at: iso(NOW - 23 * JAM) },
      { event_id: `0x${"f".repeat(64)}`, address: A, cell: "qqguv1r", seen_at: iso(NOW - RETENSI_LOKASI_MS) },
    ],
    notif_kedekatan: [
      { event_id: E, penerima: A, subjek: B, sent_at: iso(NOW - 25 * JAM) },
      { event_id: E, penerima: B, subjek: A, sent_at: iso(NOW - 1 * JAM) },
    ],
    handshake_offers: [
      { nonce: "0x01", initiator: A, expires_at: String(NOW_DETIK - 86_400 - 1), cell: "qqguv1r", consumed_at: "2026-09-13T00:00:00Z" },
      { nonce: "0x02", initiator: A, expires_at: String(NOW_DETIK - 3_600), cell: "qqguv1r", consumed_at: null },
      { nonce: "0x03", initiator: B, expires_at: String(NOW_DETIK - 90_000), cell: null, consumed_at: null },
    ],
    checkin_offers: [
      { nonce: "0x11", event_id: E, host: A, expires_at: String(NOW_DETIK - 86_400 - 60), cell: "qqguv1r", consumed_at: null },
      { nonce: "0x12", event_id: E, host: A, expires_at: String(NOW_DETIK - 86_400), cell: "qqguv1r", consumed_at: null },
    ],
    connections: [
      { id: 1, addr_a: A, addr_b: B, nonce: "0x01", cell: "qqguv1r", created_at: iso(NOW - 30 * 24 * JAM) },
    ],
    checkins: [
      { event_id: E, address: B, nonce: "0x11", cell: "qqguv1r", at_ms: NOW - 30 * 24 * JAM, created_at: iso(NOW - 30 * 24 * JAM) },
    ],
  });
}

describe("sapuLokasi — privasi retensi", () => {
  it("menghapus kehadiran yang lebih tua dari 24 jam, menyisakan yang lebih baru atau tepat 24 jam", async () => {
    const m = dunia();
    await createRadarStore(m.db).sapuLokasi(NOW);
    expect(m.tabel.kehadiran!.map((r) => [r.address, r.seen_at])).toEqual([
      [B, iso(NOW - 23 * JAM)],
      [A, iso(NOW - RETENSI_LOKASI_MS)],
    ]);
  });

  it("menghapus notifikasi kedekatan yang lebih tua dari 24 jam", async () => {
    const m = dunia();
    await createRadarStore(m.db).sapuLokasi(NOW);
    expect(m.tabel.notif_kedekatan!.map((r) => r.penerima)).toEqual([B]);
  });

  it("mengosongkan sel QR salaman yang kedaluwarsa lebih dari 24 jam, TANPA menghapus barisnya", async () => {
    const m = dunia();
    await createRadarStore(m.db).sapuLokasi(NOW);
    expect(m.tabel.handshake_offers!.map((r) => [r.nonce, r.cell])).toEqual([
      ["0x01", null], ["0x02", "qqguv1r"], ["0x03", null],
    ]);
    // Baris yang tersisa adalah yang menolak nonce dipakai ulang.
    expect(m.tabel.handshake_offers!.find((r) => r.nonce === "0x01")!.consumed_at).toBe("2026-09-13T00:00:00Z");
  });

  it("mengosongkan sel QR check-in yang kedaluwarsa lebih dari 24 jam, TANPA menghapus barisnya", async () => {
    const m = dunia();
    await createRadarStore(m.db).sapuLokasi(NOW);
    expect(m.tabel.checkin_offers!.map((r) => [r.nonce, r.cell])).toEqual([
      ["0x11", null], ["0x12", "qqguv1r"],
    ]);
  });

  // Pengecualian keputusan #5 dan §10.7: sel keduanya dipakai sidik jari trust.
  it("TIDAK menyentuh connections dan checkins sama sekali", async () => {
    const m = dunia();
    const sebelum = structuredClone({ connections: m.tabel.connections, checkins: m.tabel.checkins });
    await createRadarStore(m.db).sapuLokasi(NOW);
    expect({ connections: m.tabel.connections, checkins: m.tabel.checkins }).toEqual(sebelum);
    expect(m.tabelDisentuh.map((t) => t.tabel)).not.toContain("connections");
    expect(m.tabelDisentuh.map((t) => t.tabel)).not.toContain("checkins");
  });

  it("pernyataannya persis spec §4.5, dan tidak satu pun menghapus baris offer", async () => {
    const m = dunia();
    await createRadarStore(m.db).sapuLokasi(NOW);
    expect(m.tabelDisentuh).toEqual([
      { tabel: "kehadiran", op: "delete" },
      { tabel: "notif_kedekatan", op: "delete" },
      { tabel: "handshake_offers", op: "update" },
      { tabel: "checkin_offers", op: "update" },
    ]);
  });

  it("mengembalikan jumlah baris yang tersentuh", async () => {
    const m = dunia();
    expect(await createRadarStore(m.db).sapuLokasi(NOW)).toEqual({
      kehadiran: 1, notifKedekatan: 1, offerSalaman: 1, offerCheckIn: 1,
    });
  });

  it("sapuan kedua pada jam yang sama tidak mengubah apa pun", async () => {
    const m = dunia();
    const store = createRadarStore(m.db);
    await store.sapuLokasi(NOW);
    const setelahPertama = structuredClone(m.tabel);
    expect(await store.sapuLokasi(NOW)).toEqual({ kehadiran: 0, notifKedekatan: 0, offerSalaman: 0, offerCheckIn: 0 });
    expect(m.tabel).toEqual(setelahPertama);
  });
});
