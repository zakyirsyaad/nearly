import type { Hex } from "viem";
import { CONFIG } from "./config";
import { ApiError } from "./api";

export type EventSummary = {
  eventId: Hex;
  host: string;
  title: string;
  venueLabel: string;
  centerCell: string;
  /** unix DETIK, sebagai string — bigint tidak bisa lewat JSON. */
  startsAt: string;
  endsAt: string;
  txHash: string;
  hostScore?: number;
  rsvpCount?: number;
  rsvps?: number;
  checkins?: number;
  rsvpBelumHadir?: number;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CONFIG.apiUrl}${path}`, init);
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(
      typeof json.code === "string" ? json.code : "unknown",
      res.status,
      typeof json.reason === "string" ? json.reason : undefined,
    );
  }
  return json as T;
}

const postJson = (path: string, body: unknown) =>
  req<Record<string, unknown>>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

export const getDiscovery = () => req<{ events: EventSummary[] }>("/events");
export const getEvent = (id: string) => req<EventSummary>(`/events/${id}`);

export const postCreateEvent = (b: Record<string, unknown>) =>
  postJson("/events", b) as Promise<{ txHash: Hex }>;

export const postRsvp = (id: string, b: Record<string, unknown>) =>
  postJson(`/events/${id}/rsvp`, b) as Promise<{ ok: true }>;

export const postCheckInOffer = (id: string, b: Record<string, unknown>) =>
  postJson(`/events/${id}/checkin-offer`, b) as Promise<{ ok: true }>;

export const postCheckIn = (id: string, b: Record<string, unknown>) =>
  postJson(`/events/${id}/checkin`, b) as Promise<{ txHash: Hex }>;
