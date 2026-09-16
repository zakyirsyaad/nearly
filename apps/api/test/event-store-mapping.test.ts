import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hex } from "viem";
import { createEventStore, rowToCheckInOffer, rowToEvent } from "../src/event-store";

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

  it("cell null dipetakan ke string kosong (hasil sapuan lokasi)", () => {
    expect(rowToCheckInOffer({ ...row, cell: null }).cell).toBe("");
  });
});

describe("recordEvent memastikan profil host", () => {
  // events.host adalah foreign key ke profiles(address). Fake ini sengaja
  // dangkal: hanya meniru `.from(table).insert(payload)` dan
  // `.from(table).upsert(payload, options)`, cukup untuk membuktikan urutan
  // dan tujuan panggilan tanpa mensimulasikan Postgres sungguhan.
  function fakeSupabase() {
    const panggilan: Array<{ table: string; method: "upsert" | "insert"; payload: unknown; options?: unknown }> = [];
    const db = {
      from(table: string) {
        return {
          upsert(payload: unknown, options?: unknown) {
            panggilan.push({ table, method: "upsert", payload, options });
            return Promise.resolve({ error: null });
          },
          insert(payload: unknown) {
            panggilan.push({ table, method: "insert", payload });
            return Promise.resolve({ error: null });
          },
        };
      },
    } as unknown as SupabaseClient;
    return { db, panggilan };
  }

  const HOST = "0x000000000000000000000000000000000000AAAA" as Address;

  it("upsert ke profiles terjadi sebelum insert ke events", async () => {
    const { db, panggilan } = fakeSupabase();
    const store = createEventStore(db);

    await store.recordEvent({
      eventId: `0x${"1".repeat(64)}` as Hex,
      host: HOST,
      title: "Meetup BNB",
      venueLabel: "Kalibata",
      centerCell: "qqguv1r",
      startsAt: 1_700_000_000n,
      endsAt: 1_700_003_600n,
      txHash: "0xtx" as Hex,
    });

    expect(panggilan).toHaveLength(2);
    expect(panggilan[0]).toMatchObject({
      table: "profiles",
      method: "upsert",
      payload: { address: HOST.toLowerCase() },
      options: { onConflict: "address", ignoreDuplicates: true },
    });
    expect(panggilan[1]).toMatchObject({ table: "events", method: "insert" });
  });
});
