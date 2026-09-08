import type { Address, Hex } from "viem";
import {
  cellToBytes32, isEventLive, isInsideGeofence, recoverCheckInAcceptSigner,
  recoverCheckInOfferSigner, recoverCreateEventSigner, recoverRsvpSigner, verifyColocation,
} from "@nearly/shared";
import type { EventDeps } from "./ports";
import { pulihkanTandaTangan } from "./pulihkan-tanda-tangan";

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
  const signer = await pulihkanTandaTangan(() => recoverCreateEventSigner(
      {
        eventId: input.eventId, host: input.host, startsAt: input.startsAt,
        endsAt: input.endsAt, centerCell, expiresAt: input.expiresAt,
      },
      input.sigHost,
      deps.attendanceContract,
  ));
  if (signer === null || signer.toLowerCase() !== input.host.toLowerCase()) {
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

  const signer = await pulihkanTandaTangan(() => recoverRsvpSigner(
      { eventId: input.eventId, who: input.who, expiresAt: input.expiresAt },
      input.sig,
      deps.attendanceContract,
  ));
  if (signer === null || signer.toLowerCase() !== input.who.toLowerCase()) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  if (await deps.events.hasRsvp(input.eventId, input.who)) {
    return fail({ code: "already_rsvped", httpStatus: 409 });
  }

  await deps.events.recordRsvp(input.eventId, input.who);
  return { ok: true, value: undefined };
}

export type CheckInOfferInput = {
  eventId: Hex; nonce: Hex; host: Address; expiresAt: bigint;
  sigHost: Hex; cell: string; atMs: number;
};

/**
 * Host membuka pintu. Cermin submitOffer di handshake-gate.ts — bedanya cuma
 * satu penjagaan tambahan: penandatangan harus host EVENT INI, bukan sembarang
 * orang. Tanpa itu, QR check-in bisa dibuat siapa saja dari mana saja.
 */
export async function submitCheckInOffer(
  input: CheckInOfferInput, deps: EventDeps,
): Promise<EventResult<void>> {
  if (deps.nowMs() > Number(input.expiresAt) * 1000) {
    return fail({ code: "expired", httpStatus: 410 });
  }

  const ev = await deps.events.getEvent(input.eventId);
  if (!ev) return fail({ code: "event_not_found", httpStatus: 404 });

  if (ev.host.toLowerCase() !== input.host.toLowerCase()) {
    return fail({ code: "not_host", httpStatus: 403 });
  }

  if (await deps.events.getCheckInOffer(input.nonce)) {
    return fail({ code: "nonce_used", httpStatus: 409 });
  }

  const signer = await pulihkanTandaTangan(() => recoverCheckInOfferSigner(
      { eventId: input.eventId, nonce: input.nonce, expiresAt: input.expiresAt },
      input.sigHost,
      deps.attendanceContract,
  ));
  if (signer === null || signer.toLowerCase() !== input.host.toLowerCase()) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  await deps.events.putCheckInOffer({
    nonce: input.nonce, eventId: input.eventId, host: input.host,
    expiresAt: input.expiresAt, sigHost: input.sigHost, cell: input.cell, atMs: input.atMs,
  });
  return { ok: true, value: undefined };
}

export type CheckInInput = {
  eventId: Hex; nonce: Hex; attendee: Address; expiresAt: bigint;
  sigAttendee: Hex; cell: string; atMs: number;
};

/**
 * Tamu melangkah masuk. Sembilan penjagaan, urutannya sengaja: tawaran diperiksa
 * dulu (ditemukan, belum terpakai, cocok eventId, belum kedaluwarsa), lalu event
 * (ada, sedang berlangsung), lalu status tamu (RSVP, belum check-in), lalu dua
 * pemeriksaan lokasi — tapi ini bukan urutan murah-ke-mahal yang ketat: dua
 * pemeriksaan status tamu adalah round-trip ke store, sedangkan dua pemeriksaan
 * lokasi murni komputasi di memori. Yang justru dijaga ketat adalah bagian akhir:
 * verifikasi tanda tangan dan pemanggilan chain SELALU paling terakhir, setelah
 * semua penjagaan murah dan gratis (dari sisi chain) lolos.
 *
 * Dua pemeriksaan lokasi menjawab pertanyaan yang BERBEDA dan dua-duanya perlu:
 * geofence menjawab "apakah dia di venue yang diumumkan", ko-lokasi menjawab
 * "apakah dia benar-benar berdiri di depan host saat itu".
 */
export async function acceptCheckIn(
  input: CheckInInput, deps: EventDeps,
): Promise<EventResult<{ txHash: Hex }>> {
  const offer = await deps.events.getCheckInOffer(input.nonce);
  if (!offer) return fail({ code: "offer_not_found", httpStatus: 404 });
  if (offer.consumed) return fail({ code: "offer_consumed", httpStatus: 409 });
  if (offer.eventId.toLowerCase() !== input.eventId.toLowerCase()) {
    return fail({ code: "offer_not_found", httpStatus: 404 });
  }
  if (deps.nowMs() > Number(offer.expiresAt) * 1000) {
    return fail({ code: "expired", httpStatus: 410 });
  }

  const ev = await deps.events.getEvent(input.eventId);
  if (!ev) return fail({ code: "event_not_found", httpStatus: 404 });

  if (!isEventLive(ev.startsAt, ev.endsAt, deps.nowMs())) {
    return fail({ code: "event_not_live", httpStatus: 422 });
  }

  // Keputusan pemilik project (spec §2.2): RSVP adalah SYARAT, bukan anjuran.
  if (!(await deps.events.hasRsvp(input.eventId, input.attendee))) {
    return fail({ code: "not_rsvped", httpStatus: 403 });
  }

  if (await deps.events.hasCheckIn(input.eventId, input.attendee)) {
    return fail({ code: "already_checked_in", httpStatus: 409 });
  }

  if (!isInsideGeofence(ev.centerCell, input.cell)) {
    return fail({ code: "outside_geofence", httpStatus: 422 });
  }

  const colo = verifyColocation(
    { cell: offer.cell, at: offer.atMs },
    { cell: input.cell, at: input.atMs },
  );
  if (!colo.ok) return fail({ code: "not_colocated", reason: colo.reason, httpStatus: 422 });

  const signer = await pulihkanTandaTangan(() => recoverCheckInAcceptSigner(
      {
        eventId: input.eventId, nonce: input.nonce,
        attendee: input.attendee, expiresAt: offer.expiresAt,
      },
      input.sigAttendee,
      deps.attendanceContract,
  ));
  if (signer === null || signer.toLowerCase() !== input.attendee.toLowerCase()) {
    return fail({ code: "bad_signature", httpStatus: 401 });
  }

  let txHash: Hex;
  try {
    txHash = await deps.attendance.submitCheckIn({
      eventId: input.eventId, attendee: input.attendee, nonce: input.nonce,
      expiresAt: offer.expiresAt, sigHost: offer.sigHost, sigAttendee: input.sigAttendee,
    });
  } catch {
    // Tawaran TIDAK ditandai terpakai, supaya tamu bisa mencoba lagi dengan QR
    // yang sama alih-alih menunggu rotasi berikutnya.
    return fail({ code: "chain_error", httpStatus: 502 });
  }

  await deps.events.consumeCheckInOffer(input.nonce);
  await deps.events.recordCheckIn({
    eventId: input.eventId, who: input.attendee, nonce: input.nonce,
    cell: input.cell, atMs: input.atMs, txHash,
  });
  return { ok: true, value: { txHash } };
}
