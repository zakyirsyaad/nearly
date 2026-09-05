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
