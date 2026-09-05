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
