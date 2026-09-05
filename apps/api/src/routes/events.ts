import { Hono } from "hono";
import { isAddress, type Address, type Hex } from "viem";
import {
  CheckInOfferRequestSchema, CheckInRequestSchema,
  CreateEventRequestSchema, recoverRsvpSigner, RsvpRequestSchema,
} from "@nearly/shared";
import { acceptCheckIn, createEvent, rsvp, submitCheckInOffer } from "../event-gate";
import type { EventDeps, EventRecord } from "../ports";

const DISCOVERY_LIMIT = 50;

/**
 * `:id` di path harus sama dengan `eventId` di badan permintaan — kalau
 * tidak, path segment itu diam-diam diabaikan (bug klien yang menyakitkan
 * untuk dilacak). Dibandingkan case-insensitive karena id memang heksa
 * lowercase, tapi klien bisa saja mengirim campuran huruf besar/kecil.
 */
function sameId(pathId: string, bodyId: string) {
  return pathId.toLowerCase() === bodyId.toLowerCase();
}

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

/**
 * Mengembalikan alamat pemanggil HANYA kalau `who`, `expiresAt`, dan `sig`
 * lengkap, belum kedaluwarsa, dan tanda tangan Rsvp-nya memang milik `who`.
 * Selain itu null — termasuk kalau tidak ada satu pun parameter yang dikirim.
 *
 * Tipe Rsvp dipakai ulang apa adanya: bentuknya sudah persis {eventId, who,
 * expiresAt}, dan menandatanganinya untuk membaca status RSVP sendiri tidak
 * menimbulkan efek samping apa pun.
 */
async function pemanggilTerbukti(
  q: Record<string, string>, eventId: Hex, deps: EventDeps,
): Promise<Address | null> {
  const { who, expiresAt, sig } = q;
  if (!who || !expiresAt || !sig) return null;
  if (!isAddress(who)) return null;
  if (!/^\d+$/.test(expiresAt)) return null;
  if (deps.nowMs() > Number(expiresAt) * 1000) return null;

  try {
    const signer = await recoverRsvpSigner(
      { eventId, who: who as Address, expiresAt: BigInt(expiresAt) },
      sig as Hex,
      deps.attendanceContract,
    );
    if (signer.toLowerCase() !== who.toLowerCase()) return null;
    return who.toLowerCase() as Address;
  } catch {
    // Tanda tangan cacat bentuknya membuat viem melempar. Itu tetap "tidak
    // terbukti", bukan 500.
    return null;
  }
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
  // event host ber-trust rendah "tetap bisa dibagikan lewat link". `who`
  // OPSIONAL: tautan yang dibagikan ke orang lain tidak pernah membawanya,
  // dan itu harus tetap menghasilkan respons yang sama seperti sebelum
  // parameter ini ada — bukan galat.
  //
  // Dua bendera pribadi hanya keluar kalau pemanggil MEMBUKTIKAN dirinya
  // `who` lewat tanda tangan Rsvp. Tanpa bukti itu, `?who=` jadi oracle
  // tanpa autentikasi: siapa pun bisa menanyakan satu alamat dan tahu orang
  // itu berniat berada di tempat dan waktu tertentu. Justru sinyal yang
  // dilindungi spec induk §10.2 — "tidak ada peta dengan pin orang".
  // `sudahCheckIn` sendiri sudah publik on-chain, tapi ia ikut dijaga supaya
  // hanya ada satu aturan, bukan dua.
  //
  // Tanda tangan yang salah BUKAN galat: rute ini tidak boleh gagal untuk
  // orang asing yang membuka link. Yang terjadi hanya bendera tidak keluar.
  r.get("/events/:id", async (c) => {
    const ev = await deps.events.getEvent(c.req.param("id") as Hex);
    if (!ev) return c.json({ code: "event_not_found" }, 404);
    const summary = await deps.events.attendanceSummary(ev.eventId);

    const addr = await pemanggilTerbukti(c.req.query(), ev.eventId, deps);
    if (addr) {
      const [sudahRsvp, sudahCheckIn] = await Promise.all([
        deps.events.hasRsvp(ev.eventId, addr),
        deps.events.hasCheckIn(ev.eventId, addr),
      ]);
      return c.json({ ...eventToJson(ev), ...summary, sudahRsvp, sudahCheckIn });
    }

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
    if (!sameId(c.req.param("id"), parsed.data.eventId)) {
      return c.json({ code: "invalid_body" }, 400);
    }

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
    if (!sameId(c.req.param("id"), parsed.data.eventId)) {
      return c.json({ code: "invalid_body" }, 400);
    }

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
    if (!sameId(c.req.param("id"), parsed.data.eventId)) {
      return c.json({ code: "invalid_body" }, 400);
    }

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
