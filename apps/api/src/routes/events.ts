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
