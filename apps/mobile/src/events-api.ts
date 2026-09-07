import type { Hex } from "viem";
import { req } from "./http";

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
  /** Hanya ada kalau `who` disertakan saat memuat. */
  sudahRsvp?: boolean;
  sudahCheckIn?: boolean;
  /**
   * Hanya ada kalau bukti bacanya berhasil DAN acara ini melewati KEDUA
   * ambang k-anonimitas di server: jumlah RSVP acara, dan nilai angkanya
   * sendiri (angka kecil menunjuk orang tertentu lewat eliminasi berapa pun
   * besar acaranya). `undefined` di sini adalah keadaan NORMAL, bukan nol.
   */
  penandaHadir?: number;
  /**
   * Berapa KECOCOKAN (tanda dua arah) milik pemanggil yang sudah RSVP —
   * bukan tanda sepihaknya. Hanya ada kalau bukti bacanya berhasil, dan
   * tidak diberi ambang: kedua pihak sudah sepakat saling terlihat, jadi
   * angkanya tidak bisa dipancing dari luar.
   */
  kutandaiHadir?: number;
};

const postJson = (path: string, body: unknown) =>
  req<Record<string, unknown>>(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

export const getDiscovery = () => req<{ events: EventSummary[] }>("/events");

/**
 * Bukti bahwa pemanggil memang `who`: tanda tangan Rsvp berumur pendek.
 * Tanpa ini server tidak mengembalikan bendera sudahRsvp/sudahCheckIn —
 * status RSVP orang lain bukan urusan siapa pun yang menebak alamat.
 */
export type BuktiRsvp = { expiresAt: string; sig: string };

export const getEvent = (id: string, who?: string, bukti?: BuktiRsvp) => {
  const q = new URLSearchParams();
  if (who && bukti) {
    q.set("who", who.toLowerCase());
    q.set("expiresAt", bukti.expiresAt);
    q.set("sig", bukti.sig);
  }
  const s = q.toString();
  return req<EventSummary>(`/events/${id}${s ? `?${s}` : ""}`);
};

export const postCreateEvent = (b: Record<string, unknown>) =>
  postJson("/events", b) as Promise<{ txHash: Hex }>;

export const postRsvp = (id: string, b: Record<string, unknown>) =>
  postJson(`/events/${id}/rsvp`, b) as Promise<{ ok: true }>;

export const postCheckInOffer = (id: string, b: Record<string, unknown>) =>
  postJson(`/events/${id}/checkin-offer`, b) as Promise<{ ok: true }>;

export const postCheckIn = (id: string, b: Record<string, unknown>) =>
  postJson(`/events/${id}/checkin`, b) as Promise<{ txHash: Hex }>;
