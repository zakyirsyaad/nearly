import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { checkInAcceptTypedData, checkInOfferTypedData, neighborCells } from "@nearly/shared";
import { acceptCheckIn, submitCheckInOffer } from "../src/event-gate";

const NOW = 1_700_000_000_000;
const NOW_SEC = BigInt(Math.floor(NOW / 1000));
const host = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex,
);
const guest = privateKeyToAccount(
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex,
);
const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;
const EVENT_ID = `0x${"1".repeat(64)}` as Hex;
const NONCE = `0x${"2".repeat(64)}` as Hex;
const CELL = "qqguv1r";

const eventRecord = {
  eventId: EVENT_ID, host: host.address, title: "Meetup BNB", venueLabel: "Kalibata",
  centerCell: CELL, startsAt: NOW_SEC - 600n, endsAt: NOW_SEC + 3600n, txHash: "0xtx" as Hex,
};

const pendingOffer = {
  nonce: NONCE, eventId: EVENT_ID, host: host.address, expiresAt: NOW_SEC + 30n,
  sigHost: "0x00" as Hex, cell: CELL, atMs: NOW, consumed: false,
};

function eventsStore(over: Record<string, unknown> = {}) {
  return {
    recordEvent: vi.fn(async () => {}),
    getEvent: vi.fn(async () => eventRecord),
    hasRsvp: vi.fn(async () => true),
    recordRsvp: vi.fn(async () => {}),
    putCheckInOffer: vi.fn(async () => {}),
    getCheckInOffer: vi.fn(async () => pendingOffer),
    consumeCheckInOffer: vi.fn(async () => {}),
    hasCheckIn: vi.fn(async () => false),
    recordCheckIn: vi.fn(async () => {}),
    ...over,
  };
}

function deps(over: Record<string, unknown> = {}) {
  return {
    events: eventsStore(),
    attendance: { submitCheckIn: vi.fn(async (): Promise<Hex> => "0xtxcheckin" as Hex) },
    profiles: {},
    attendanceContract: CONTRACT,
    nowMs: () => NOW,
    ...over,
  } as never;
}

async function offerInput(over: Record<string, unknown> = {}) {
  const expiresAt = NOW_SEC + 30n;
  const msg = { eventId: EVENT_ID, nonce: NONCE, expiresAt };
  return {
    eventId: EVENT_ID, nonce: NONCE, host: host.address, expiresAt,
    sigHost: await host.signTypedData(checkInOfferTypedData(msg, CONTRACT)),
    cell: CELL, atMs: NOW,
    ...over,
  } as never;
}

async function checkInInput(over: Record<string, unknown> = {}) {
  const expiresAt = NOW_SEC + 30n;
  const msg = { eventId: EVENT_ID, nonce: NONCE, attendee: guest.address, expiresAt };
  return {
    eventId: EVENT_ID, nonce: NONCE, attendee: guest.address, expiresAt,
    sigAttendee: await guest.signTypedData(checkInAcceptTypedData(msg, CONTRACT)),
    cell: CELL, atMs: NOW,
    ...over,
  } as never;
}

describe("submitCheckInOffer", () => {
  it("tawaran dari host yang sah disimpan", async () => {
    const d = deps({ events: eventsStore({ getCheckInOffer: vi.fn(async () => null) }) });
    const r = await submitCheckInOffer(await offerInput(), d);
    expect(r).toMatchObject({ ok: true });
  });

  // Hanya host yang boleh membuka pintu check-in. Kalau siapa pun boleh, QR
  // check-in bisa dibuat dari rumah dan seluruh premis fase ini runtuh.
  it("menolak tawaran dari orang yang bukan host event", async () => {
    const d = deps({ events: eventsStore({ getCheckInOffer: vi.fn(async () => null) }) });
    const r = await submitCheckInOffer(await offerInput({ host: guest.address }), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "not_host", httpStatus: 403 } });
  });

  it("menolak nonce yang sudah pernah dipakai", async () => {
    const r = await submitCheckInOffer(await offerInput(), deps());
    expect(r).toMatchObject({ ok: false, failure: { code: "nonce_used", httpStatus: 409 } });
  });

  it("menolak tawaran ke event yang tidak ada", async () => {
    const d = deps({
      events: eventsStore({
        getEvent: vi.fn(async () => null),
        getCheckInOffer: vi.fn(async () => null),
      }),
    });
    const r = await submitCheckInOffer(await offerInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "event_not_found" } });
  });
});

describe("acceptCheckIn", () => {
  it("check-in yang sah diteruskan ke chain dan dicatat", async () => {
    const d = deps();
    const r = await acceptCheckIn(await checkInInput(), d);
    expect(r).toMatchObject({ ok: true, value: { txHash: "0xtxcheckin" } });
  });

  it("menolak kalau tamu belum RSVP", async () => {
    const d = deps({ events: eventsStore({ hasRsvp: vi.fn(async () => false) }) });
    const r = await acceptCheckIn(await checkInInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "not_rsvped", httpStatus: 403 } });
  });

  it("menolak check-in kedua", async () => {
    const d = deps({ events: eventsStore({ hasCheckIn: vi.fn(async () => true) }) });
    const r = await acceptCheckIn(await checkInInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "already_checked_in" } });
  });

  it("menolak tawaran yang sudah dipakai", async () => {
    const d = deps({
      events: eventsStore({
        getCheckInOffer: vi.fn(async () => ({ ...pendingOffer, consumed: true })),
      }),
    });
    const r = await acceptCheckIn(await checkInInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "offer_consumed" } });
  });

  it("menolak tawaran yang tidak dikenal", async () => {
    const d = deps({ events: eventsStore({ getCheckInOffer: vi.fn(async () => null) }) });
    const r = await acceptCheckIn(await checkInInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "offer_not_found" } });
  });

  it("menolak check-in sebelum acara mulai", async () => {
    const d = deps({
      events: eventsStore({
        getEvent: vi.fn(async () => ({
          ...eventRecord, startsAt: NOW_SEC + 600n, endsAt: NOW_SEC + 4200n,
        })),
      }),
    });
    const r = await acceptCheckIn(await checkInInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "event_not_live", httpStatus: 422 } });
  });

  it("menolak check-in setelah acara selesai", async () => {
    const d = deps({
      events: eventsStore({
        getEvent: vi.fn(async () => ({
          ...eventRecord, startsAt: NOW_SEC - 7200n, endsAt: NOW_SEC - 3600n,
        })),
      }),
    });
    const r = await acceptCheckIn(await checkInInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "event_not_live" } });
  });

  it("menolak tamu yang selnya di luar geofence", async () => {
    const r = await acceptCheckIn(await checkInInput({ cell: "w1xyz00" }), deps());
    expect(r).toMatchObject({ ok: false, failure: { code: "outside_geofence", httpStatus: 422 } });
  });

  it("menerima tamu di sel tetangga sel pusat", async () => {
    const neighbour = neighborCells(CELL)[0]!;
    const r = await acceptCheckIn(await checkInInput({ cell: neighbour }), deps());
    expect(r).toMatchObject({ ok: true });
  });

  // Geofence menjawab "di venue?"; ko-lokasi menjawab "di depan host?".
  // Keduanya perlu: QR yang difoto lalu dipakai tiga jam kemudian gagal di sini.
  it("menolak kalau waktu tamu jauh dari waktu host", async () => {
    const r = await acceptCheckIn(await checkInInput({ atMs: NOW + 600_000 }), deps());
    expect(r).toMatchObject({
      ok: false, failure: { code: "not_colocated", reason: "time_too_far" },
    });
  });

  it("menolak tanda tangan tamu yang bukan miliknya", async () => {
    const r = await acceptCheckIn(await checkInInput({ attendee: host.address }), deps());
    expect(r).toMatchObject({ ok: false, failure: { code: "bad_signature" } });
  });

  // Tawaran TIDAK ditandai terpakai kalau transaksi gagal, supaya tamu bisa
  // mencoba lagi dengan QR yang sama alih-alih menunggu rotasi berikutnya.
  it("tidak menandai tawaran terpakai kalau transaksi gagal", async () => {
    const events = eventsStore();
    const d = deps({
      events,
      attendance: {
        submitCheckIn: vi.fn(async () => {
          throw new Error("rpc mati");
        }),
      },
    });
    const r = await acceptCheckIn(await checkInInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "chain_error", httpStatus: 502 } });
    expect(events.consumeCheckInOffer).not.toHaveBeenCalled();
    expect(events.recordCheckIn).not.toHaveBeenCalled();
  });
});
