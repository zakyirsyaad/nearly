import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { cellToBytes32, createEventTypedData } from "@nearly/shared";
import { eventRoutes } from "../src/routes/events";

const NOW = 1_700_000_000_000;
const NOW_SEC = BigInt(Math.floor(NOW / 1000));
const host = privateKeyToAccount(
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex,
);
const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;
const EVENT_ID = `0x${"1".repeat(64)}` as Hex;
// Mengandung huruf heksa (bukan cuma digit) supaya uji besar/kecil di bawah
// benar-benar berarti — EVENT_ID sendiri semua digit, toUpperCase() atasnya
// tidak mengubah apa-apa.
const CASE_ID = `0x${"a".repeat(64)}` as Hex;

function app(over: Record<string, unknown> = {}) {
  return eventRoutes({
    events: {
      recordEvent: vi.fn(async () => {}),
      getEvent: vi.fn(async () => null),
      listDiscovery: vi.fn(async () => []),
      hasRsvp: vi.fn(async () => false),
      recordRsvp: vi.fn(async () => {}),
      putCheckInOffer: vi.fn(async () => {}),
      getCheckInOffer: vi.fn(async () => null),
      consumeCheckInOffer: vi.fn(async () => {}),
      hasCheckIn: vi.fn(async () => false),
      recordCheckIn: vi.fn(async () => {}),
      attendanceSummary: vi.fn(async () => ({ rsvps: 3, checkins: 2, rsvpBelumHadir: 1 })),
    },
    attendance: {
      submitCreateEvent: vi.fn(async (): Promise<Hex> => "0xtx" as Hex),
      submitCheckIn: vi.fn(async (): Promise<Hex> => "0xtx2" as Hex),
    },
    profiles: {},
    attendanceContract: CONTRACT,
    nowMs: () => NOW,
    onChanged: vi.fn(async () => {}),
    ...over,
  } as never);
}

async function createBody() {
  const startsAt = NOW_SEC;
  const endsAt = NOW_SEC + 3600n;
  const expiresAt = NOW_SEC + 600n;
  const msg = {
    eventId: EVENT_ID, host: host.address, startsAt, endsAt,
    centerCell: cellToBytes32("qqguv1r"), expiresAt,
  };
  return {
    eventId: EVENT_ID, host: host.address, title: "Meetup BNB", venueLabel: "Kalibata",
    cell: "qqguv1r", startsAt: startsAt.toString(), endsAt: endsAt.toString(),
    expiresAt: expiresAt.toString(),
    sigHost: await host.signTypedData(createEventTypedData(msg, CONTRACT)),
  };
}

function post(a: ReturnType<typeof app>, path: string, body: unknown) {
  return a.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /events", () => {
  it("membuat event dan mengembalikan txHash", async () => {
    const res = await post(app(), "/events", await createBody());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ txHash: "0xtx" });
  });

  it("menolak badan yang tidak sesuai skema dengan 400", async () => {
    const res = await post(app(), "/events", { title: "cuma judul" });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_body" });
  });

  // Tanda tangan BERBENTUK SAH dari kunci lain, bukan heksa karangan: viem
  // melempar untuk byte v yang tidak sah, dan itu akan menghasilkan 500 —
  // menguji hal yang bukan maksud test ini. Yang diuji di sini adalah kode
  // kegagalan gerbang diteruskan beserta status HTTP-nya.
  it("meneruskan kode kegagalan gerbang beserta status HTTP-nya", async () => {
    const orangLain = privateKeyToAccount(
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex,
    );
    const startsAt = NOW_SEC;
    const endsAt = NOW_SEC + 3600n;
    const expiresAt = NOW_SEC + 600n;
    const sigHost = await orangLain.signTypedData(
      createEventTypedData(
        {
          eventId: EVENT_ID, host: host.address, startsAt, endsAt,
          centerCell: cellToBytes32("qqguv1r"), expiresAt,
        },
        CONTRACT,
      ),
    );
    const res = await post(app(), "/events", { ...(await createBody()), sigHost });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "bad_signature" });
  });
});

describe("GET /events/:id", () => {
  it("mengembalikan 404 untuk event yang tidak ada", async () => {
    const res = await app().request("/events/" + EVENT_ID);
    expect(res.status).toBe(404);
  });

  // Spec §8: detail SELALU bisa dibuka, tanpa penyaring apa pun. Ini yang
  // membuat "tetap bisa dibagikan lewat link" benar.
  it("mengembalikan event apa adanya tanpa menyaring host", async () => {
    const a = app({
      events: {
        getEvent: vi.fn(async () => ({
          eventId: EVENT_ID, host: host.address, title: "Meetup BNB",
          venueLabel: "Kalibata", centerCell: "qqguv1r",
          startsAt: NOW_SEC, endsAt: NOW_SEC + 3600n, txHash: "0xtx" as Hex,
        })),
        attendanceSummary: vi.fn(async () => ({ rsvps: 0, checkins: 0, rsvpBelumHadir: 0 })),
      },
    });
    const res = await a.request("/events/" + EVENT_ID);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ title: "Meetup BNB", startsAt: NOW_SEC.toString() });
  });

  // `who` opsional membawa dua bendera tambahan — status RSVP dan check-in
  // pemanggil sendiri — supaya layar detail tidak perlu menebak-nebak dari
  // state lokal yang bisa basi begitu sesi ditutup lalu dibuka lagi.
  it("menyertakan sudahRsvp dan sudahCheckIn ketika who diberikan", async () => {
    const a = app({
      events: {
        getEvent: vi.fn(async () => ({
          eventId: EVENT_ID, host: host.address, title: "Meetup BNB",
          venueLabel: "Kalibata", centerCell: "qqguv1r",
          startsAt: NOW_SEC, endsAt: NOW_SEC + 3600n, txHash: "0xtx" as Hex,
        })),
        attendanceSummary: vi.fn(async () => ({ rsvps: 1, checkins: 1, rsvpBelumHadir: 0 })),
        hasRsvp: vi.fn(async () => true),
        hasCheckIn: vi.fn(async () => true),
      },
    });
    const res = await a.request(`/events/${EVENT_ID}?who=${host.address}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ sudahRsvp: true, sudahCheckIn: true });
  });

  // Tanpa who (tautan yang dibagikan ke orang lain, misalnya), respons harus
  // identik dengan sebelum parameter ini ada — tidak ada kunci baru, dan
  // yang pasti bukan galat.
  it("mengembalikan respons yang sama seperti sebelumnya ketika who tidak diberikan", async () => {
    const a = app({
      events: {
        getEvent: vi.fn(async () => ({
          eventId: EVENT_ID, host: host.address, title: "Meetup BNB",
          venueLabel: "Kalibata", centerCell: "qqguv1r",
          startsAt: NOW_SEC, endsAt: NOW_SEC + 3600n, txHash: "0xtx" as Hex,
        })),
        attendanceSummary: vi.fn(async () => ({ rsvps: 1, checkins: 1, rsvpBelumHadir: 0 })),
      },
    });
    const res = await a.request("/events/" + EVENT_ID);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("sudahRsvp");
    expect(body).not.toHaveProperty("sudahCheckIn");
  });

  // who yang cacat (bukan alamat sah) harus diperlakukan sama seperti tidak
  // ada — rute ini harus tetap bisa dibuka siapa pun lewat link apa adanya,
  // jadi query yang jelek TIDAK BOLEH berubah jadi galat.
  it("mengabaikan who yang bukan alamat sah, bukan menjadikannya galat", async () => {
    const a = app({
      events: {
        getEvent: vi.fn(async () => ({
          eventId: EVENT_ID, host: host.address, title: "Meetup BNB",
          venueLabel: "Kalibata", centerCell: "qqguv1r",
          startsAt: NOW_SEC, endsAt: NOW_SEC + 3600n, txHash: "0xtx" as Hex,
        })),
        attendanceSummary: vi.fn(async () => ({ rsvps: 1, checkins: 1, rsvpBelumHadir: 0 })),
      },
    });
    const res = await a.request(`/events/${EVENT_ID}?who=bukan-alamat`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("sudahRsvp");
    expect(body).not.toHaveProperty("sudahCheckIn");
  });
});

describe("GET /events", () => {
  it("mengembalikan daftar discovery", async () => {
    const res = await app().request("/events");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ events: [] });
  });

  // Fake lama mengembalikan array kosong, jadi eventToJson tidak pernah
  // benar-benar dipanggil pada satu baris pun — regresi yang mengembalikan
  // baris mentah (bukan lewat eventToJson) tetap lolos. Baris di sini
  // berisi bigint asli supaya bug macam itu ketahuan: kalau serialisasi
  // gagal, respons akan berisi bigint mentah (dan Hono akan melempar saat
  // meng-encode-nya), bukan string.
  it("mengubah startsAt/endsAt bigint jadi string pada baris discovery", async () => {
    const a = app({
      events: {
        listDiscovery: vi.fn(async () => [
          {
            eventId: EVENT_ID, host: host.address, title: "Meetup BNB",
            venueLabel: "Kalibata", centerCell: "qqguv1r",
            startsAt: NOW_SEC, endsAt: NOW_SEC + 3600n, txHash: "0xtx" as Hex,
            hostScore: 7, rsvpCount: 4,
          },
        ]),
      },
    });
    const res = await a.request("/events");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      events: [
        {
          eventId: EVENT_ID,
          startsAt: NOW_SEC.toString(),
          endsAt: (NOW_SEC + 3600n).toString(),
          hostScore: 7,
          rsvpCount: 4,
        },
      ],
    });
  });
});

describe("GET /events/:id/attendance", () => {
  it("mengembalikan tiga angka", async () => {
    const res = await app().request(`/events/${EVENT_ID}/attendance`);
    expect(await res.json()).toMatchObject({ rsvps: 3, checkins: 2, rsvpBelumHadir: 1 });
  });
});

// :id di path dan eventId di badan harus sama — kalau tidak, path diam-diam
// diabaikan dan permintaan dieksekusi untuk event LAIN daripada yang
// ditunjuk URL-nya. Ditolak sebelum gerbang manapun dipanggil.
describe("POST /events/:id/checkin — :id vs eventId badan", () => {
  it("menolak dengan 400 kalau :id path tidak sama dengan eventId badan", async () => {
    const lainId = `0x${"2".repeat(64)}` as Hex;
    const res = await post(app(), `/events/${lainId}/checkin`, {
      eventId: EVENT_ID,
      nonce: `0x${"3".repeat(64)}`,
      attendee: host.address,
      expiresAt: NOW_SEC.toString(),
      sigAttendee: `0x${"4".repeat(130)}`,
      cell: "qqguv1r",
      atMs: NOW,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_body" });
  });

  // Perbedaan huruf besar/kecil saja BUKAN mismatch — id memang heksa
  // lowercase secara konvensi, tapi klien bisa mengirim campuran.
  it("menerima :id path dan eventId badan yang sama tapi beda huruf besar/kecil", async () => {
    const idHurufBesar = CASE_ID.toUpperCase().replace("0X", "0x") as Hex;
    const res = await post(app(), `/events/${idHurufBesar}/checkin`, {
      eventId: CASE_ID,
      nonce: `0x${"3".repeat(64)}`,
      attendee: host.address,
      expiresAt: NOW_SEC.toString(),
      sigAttendee: `0x${"4".repeat(130)}`,
      cell: "qqguv1r",
      atMs: NOW,
    });
    // Lolos pengecekan :id vs eventId, lanjut ke gerbang — yang di sini gagal
    // dengan offer_not_found (404) karena getCheckInOffer fake mengembalikan
    // null, bukan 400 invalid_body dari pengecekan :id.
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ code: "offer_not_found" });
  });
});
