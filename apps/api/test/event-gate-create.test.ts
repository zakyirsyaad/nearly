import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { cellToBytes32, createEventTypedData, rsvpTypedData } from "@nearly/shared";
import { createEvent, rsvp } from "../src/event-gate";

const NOW = 1_700_000_000_000;
const NOW_SEC = BigInt(Math.floor(NOW / 1000));
const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const host = privateKeyToAccount(PK);
const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;
const EVENT_ID = `0x${"1".repeat(64)}` as Hex;
const CELL = "qqguv1r";

function deps(over: Record<string, unknown> = {}) {
  return {
    events: {
      recordEvent: vi.fn(async () => {}),
      getEvent: vi.fn(async () => null),
      hasRsvp: vi.fn(async () => false),
      recordRsvp: vi.fn(async () => {}),
    },
    attendance: {
      submitCreateEvent: vi.fn(async (): Promise<Hex> => "0xtx" as Hex),
    },
    profiles: {},
    attendanceContract: CONTRACT,
    nowMs: () => NOW,
    ...over,
  } as never;
}

async function createInput(over: Record<string, unknown> = {}) {
  const startsAt = NOW_SEC;
  const endsAt = NOW_SEC + 3600n;
  const expiresAt = NOW_SEC + 600n;
  const msg = {
    eventId: EVENT_ID, host: host.address, startsAt, endsAt,
    centerCell: cellToBytes32(CELL), expiresAt,
  };
  return {
    eventId: EVENT_ID,
    host: host.address,
    title: "Meetup BNB",
    venueLabel: "Kalibata",
    cell: CELL,
    startsAt,
    endsAt,
    expiresAt,
    sigHost: await host.signTypedData(createEventTypedData(msg, CONTRACT)),
    ...over,
  } as never;
}

describe("createEvent", () => {
  it("event yang sah diteruskan ke chain dan dicatat", async () => {
    const d = deps();
    const r = await createEvent(await createInput(), d);
    expect(r).toMatchObject({ ok: true, value: { txHash: "0xtx" } });
  });

  it("menolak tanda tangan yang bukan milik host", async () => {
    const other = "0x000000000000000000000000000000000000beef" as Address;
    const r = await createEvent(await createInput({ host: other }), deps());
    expect(r).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
  });

  it("menolak permintaan yang sudah kedaluwarsa", async () => {
    const r = await createEvent(await createInput({ expiresAt: NOW_SEC - 1n }), deps());
    expect(r).toMatchObject({ ok: false, failure: { code: "expired", httpStatus: 410 } });
  });

  it("menolak eventId yang sudah dipakai", async () => {
    const d = deps({
      events: {
        recordEvent: vi.fn(async () => {}),
        getEvent: vi.fn(async () => ({ eventId: EVENT_ID })),
        hasRsvp: vi.fn(async () => false),
        recordRsvp: vi.fn(async () => {}),
      },
    });
    const r = await createEvent(await createInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "event_exists", httpStatus: 409 } });
  });

  // Transaksi yang gagal TIDAK boleh meninggalkan baris event di database:
  // event yang ada di Postgres tapi tidak ada on-chain akan membuat SETIAP
  // check-in ke event itu revert dengan EventUnknown, dan penyebabnya tidak
  // terlihat dari sisi pengguna.
  it("tidak mencatat event kalau transaksi gagal", async () => {
    const recordEvent = vi.fn(async () => {});
    const d = deps({
      events: {
        recordEvent,
        getEvent: vi.fn(async () => null),
        hasRsvp: vi.fn(async () => false),
        recordRsvp: vi.fn(async () => {}),
      },
      attendance: {
        submitCreateEvent: vi.fn(async () => {
          throw new Error("rpc mati");
        }),
      },
    });
    const r = await createEvent(await createInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "chain_error", httpStatus: 502 } });
    expect(recordEvent).not.toHaveBeenCalled();
  });
});

describe("rsvp", () => {
  async function rsvpInput(over: Record<string, unknown> = {}) {
    const expiresAt = NOW_SEC + 600n;
    const msg = { eventId: EVENT_ID, who: host.address, expiresAt };
    return {
      eventId: EVENT_ID,
      who: host.address,
      expiresAt,
      sig: await host.signTypedData(rsvpTypedData(msg, CONTRACT)),
      ...over,
    } as never;
  }

  function rsvpDeps(over: Record<string, unknown> = {}) {
    return deps({
      events: {
        recordEvent: vi.fn(async () => {}),
        getEvent: vi.fn(async () => ({
          eventId: EVENT_ID, host: host.address, centerCell: CELL,
          startsAt: NOW_SEC, endsAt: NOW_SEC + 3600n,
        })),
        hasRsvp: vi.fn(async () => false),
        recordRsvp: vi.fn(async () => {}),
      },
      ...over,
    });
  }

  it("RSVP yang sah dicatat", async () => {
    const r = await rsvp(await rsvpInput(), rsvpDeps());
    expect(r).toMatchObject({ ok: true });
  });

  it("menolak RSVP ke event yang tidak ada", async () => {
    const d = deps({
      events: {
        recordEvent: vi.fn(async () => {}),
        getEvent: vi.fn(async () => null),
        hasRsvp: vi.fn(async () => false),
        recordRsvp: vi.fn(async () => {}),
      },
    });
    const r = await rsvp(await rsvpInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "event_not_found", httpStatus: 404 } });
  });

  // Tanpa penjagaan ini, `who` datang telanjang dari body dan siapa pun bisa
  // mengarang RSVP atas nama orang lain — dan karena RSVP adalah SYARAT
  // check-in, itu berarti mengarang syarat orang lain.
  it("menolak RSVP yang ditandatangani orang lain", async () => {
    const other = "0x000000000000000000000000000000000000beef" as Address;
    const r = await rsvp(await rsvpInput({ who: other }), rsvpDeps());
    expect(r).toMatchObject({ ok: false, failure: { code: "bad_signature" } });
  });

  it("RSVP kedua ditolak", async () => {
    const d = rsvpDeps({
      events: {
        recordEvent: vi.fn(async () => {}),
        getEvent: vi.fn(async () => ({
          eventId: EVENT_ID, host: host.address, centerCell: CELL,
          startsAt: NOW_SEC, endsAt: NOW_SEC + 3600n,
        })),
        hasRsvp: vi.fn(async () => true),
        recordRsvp: vi.fn(async () => {}),
      },
    });
    const r = await rsvp(await rsvpInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "already_rsvped", httpStatus: 409 } });
  });

  it("menolak RSVP setelah acara selesai", async () => {
    const d = rsvpDeps({
      events: {
        recordEvent: vi.fn(async () => {}),
        getEvent: vi.fn(async () => ({
          eventId: EVENT_ID, host: host.address, centerCell: CELL,
          startsAt: NOW_SEC - 7200n, endsAt: NOW_SEC - 3600n,
        })),
        hasRsvp: vi.fn(async () => false),
        recordRsvp: vi.fn(async () => {}),
      },
    });
    const r = await rsvp(await rsvpInput(), d);
    expect(r).toMatchObject({ ok: false, failure: { code: "event_over", httpStatus: 410 } });
  });
});
