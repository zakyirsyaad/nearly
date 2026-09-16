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
  sig_host: string;
  /** null setelah `sapuLokasi` mengosongkannya (migrasi 0008, spec 4b+5 §4.4). */
  cell: string | null;
  at_ms: string | number; consumed_at: string | null;
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
    // Sel yang sudah disapu menjadi string kosong (lihat rowToOffer di db.ts).
    cell: row.cell ?? "",
    atMs: Number(row.at_ms),
    consumed: row.consumed_at !== null,
  };
}

export function createEventStore(db: SupabaseClient): EventStore {
  async function ensureProfile(address: Address): Promise<void> {
    const { error } = await db
      .from("profiles")
      .upsert({ address: address.toLowerCase() }, { onConflict: "address", ignoreDuplicates: true });
    if (error) throw new Error(`upsert profile gagal: ${error.message}`);
  }

  return {
    async recordEvent(row) {
      // events.host adalah foreign key ke profiles(address). Host yang belum
      // pernah handshake (belum tersentuh putOffer/recordConnection) belum
      // punya baris profiles, jadi pastikan dulu supaya insert tidak gagal
      // dengan pelanggaran foreign key mentah dari Postgres.
      await ensureProfile(row.host);
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

    async rsvpAddresses(eventId) {
      const { data, error } = await db
        .from("rsvps").select("address").eq("event_id", eventId.toLowerCase());
      if (error) throw new Error(`baca rsvp gagal: ${error.message}`);
      return (data ?? []).map((r) => String(r.address).toLowerCase() as Address);
    },
  };
}
