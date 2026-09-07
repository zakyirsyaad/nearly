import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  cellToBytes32, createEventTypedData, lihatEventTypedData, rsvpTypedData,
} from "@nearly/shared";
import { eventRoutes } from "../src/routes/events";
import type { MeetStore } from "../src/ports";

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

/** Stub MeetStore — rute event tidak menandai apa pun, cuma membaca dua metodenya. */
function meetStore(): MeetStore {
  return {
    setTanda: vi.fn(async () => {}), hitungTanda: vi.fn(async () => 0),
    adaTanda: vi.fn(async () => false),
    tandaOleh: vi.fn(async () => []), tandaKe: vi.fn(async () => []),
    cocokDilihatAtMs: vi.fn(async () => null), setCocokDilihat: vi.fn(async () => {}),
    profilRingkas: vi.fn(async () => new Map()),
    hitungTandaBanyak: vi.fn(async () => new Map()),
  };
}

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
      rsvpAddresses: vi.fn(async () => []),
    },
    attendance: {
      submitCreateEvent: vi.fn(async (): Promise<Hex> => "0xtx" as Hex),
      submitCheckIn: vi.fn(async (): Promise<Hex> => "0xtx2" as Hex),
    },
    profiles: {},
    attendanceContract: CONTRACT,
    nowMs: () => NOW,
    onChanged: vi.fn(async () => {}),
    meet: meetStore(),
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

/** Store yang akan mengembalikan kedua bendera KALAU rute memutuskan boleh. */
function eventsWithFlags() {
  return {
    getEvent: vi.fn(async () => ({
      eventId: EVENT_ID, host: host.address, title: "Meetup BNB",
      venueLabel: "Kalibata", centerCell: "qqguv1r",
      startsAt: NOW_SEC, endsAt: NOW_SEC + 3600n, txHash: "0xtx" as Hex,
    })),
    attendanceSummary: vi.fn(async () => ({ rsvps: 1, checkins: 1, rsvpBelumHadir: 0 })),
    hasRsvp: vi.fn(async () => true),
    hasCheckIn: vi.fn(async () => true),
    rsvpAddresses: vi.fn(async () => []),
  };
}

/** Query string berisi bukti LihatEvent yang sah milik `host`. */
async function buktiQuery(expiresAt = NOW_SEC + 600n) {
  const sig = await host.signTypedData(
    lihatEventTypedData({ eventId: EVENT_ID, who: host.address, expiresAt }, CONTRACT),
  );
  return `who=${host.address}&expiresAt=${expiresAt}&sig=${sig}`;
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

  // `who` membawa dua bendera tambahan — status RSVP dan check-in pemanggil
  // sendiri — supaya layar detail tidak perlu menebak-nebak dari state lokal
  // yang bisa basi begitu sesi ditutup lalu dibuka lagi. Tapi hanya untuk
  // pemanggil yang MEMBUKTIKAN dirinya `who`: tanpa bukti, rute ini jadi
  // oracle yang bisa ditanya siapa pun tentang siapa pun (spec induk §10.2).
  it("menyertakan sudahRsvp dan sudahCheckIn ketika bukti tanda tangan sah", async () => {
    const a = app({ events: eventsWithFlags() });
    const res = await a.request(`/events/${EVENT_ID}?${await buktiQuery()}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ sudahRsvp: true, sudahCheckIn: true });
  });

  // Tanda tangan yang tidak cocok BUKAN galat — rute ini tidak boleh pernah
  // gagal untuk orang asing yang membuka link. Yang terjadi: bendera hilang.
  it("mengembalikan event polos ketika tanda tangan bukan milik who", async () => {
    const orangLain = privateKeyToAccount(
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex,
    );
    const expiresAt = NOW_SEC + 600n;
    // Ditandatangani orangLain, tapi mengaku sebagai host.
    const sig = await orangLain.signTypedData(
      lihatEventTypedData(
        { eventId: EVENT_ID, who: host.address, expiresAt },
        CONTRACT,
      ),
    );
    const a = app({ events: eventsWithFlags() });
    const res = await a.request(
      `/events/${EVENT_ID}?who=${host.address}&expiresAt=${expiresAt}&sig=${sig}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ title: "Meetup BNB" });
    expect(body).not.toHaveProperty("sudahRsvp");
    expect(body).not.toHaveProperty("sudahCheckIn");
  });

  // Penjaga regresi utama perbaikan ini: proof baca GET memakai tipe
  // LihatEvent, BUKAN Rsvp. Tanda tangan Rsvp yang SAH milik `host` (mis.
  // yang dikirim tamu ke POST /events/:id/rsvp, lalu bocor lewat log akses)
  // tidak boleh bisa dipakai ulang untuk membuka bendera sudahRsvp/
  // sudahCheckIn di sini — kalau bisa, itu berarti dua tipe itu kembali
  // interchangeable dan celah oracle-nya kembali terbuka.
  it("mengabaikan tanda tangan Rsvp yang sah — bukan LihatEvent — pada bukti GET", async () => {
    const expiresAt = NOW_SEC + 600n;
    const sig = await host.signTypedData(
      rsvpTypedData({ eventId: EVENT_ID, who: host.address, expiresAt }, CONTRACT),
    );
    const a = app({ events: eventsWithFlags() });
    const res = await a.request(
      `/events/${EVENT_ID}?who=${host.address}&expiresAt=${expiresAt}&sig=${sig}`,
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("sudahRsvp");
    expect(body).not.toHaveProperty("sudahCheckIn");
  });

  // `who` sendirian (tanpa expiresAt dan sig) adalah bentuk lama rute ini.
  // Ia tidak boleh lagi membocorkan apa pun.
  it("mengabaikan who yang datang tanpa bukti tanda tangan", async () => {
    const a = app({ events: eventsWithFlags() });
    const res = await a.request(`/events/${EVENT_ID}?who=${host.address}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("sudahRsvp");
    expect(body).not.toHaveProperty("sudahCheckIn");
  });

  it("mengabaikan bukti yang sudah kedaluwarsa", async () => {
    const a = app({ events: eventsWithFlags() });
    const res = await a.request(`/events/${EVENT_ID}?${await buktiQuery(NOW_SEC - 1n)}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).not.toHaveProperty("sudahRsvp");
    expect(body).not.toHaveProperty("sudahCheckIn");
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
    const a = app({ events: eventsWithFlags() });
    const res = await a.request(
      `/events/${EVENT_ID}?who=bukan-alamat&expiresAt=${NOW_SEC + 600n}&sig=0xzz`,
    );
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
