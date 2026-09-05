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
