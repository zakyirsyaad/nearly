import { Hono } from "hono";
import { isAddress, type Address, type Hex } from "viem";
import {
  CheckInOfferRequestSchema, CheckInRequestSchema,
  CreateEventRequestSchema, recoverLihatEventSigner, RsvpRequestSchema,
} from "@nearly/shared";
import { acceptCheckIn, createEvent, rsvp, submitCheckInOffer } from "../event-gate";
import { irisan, kecocokanDari } from "../meet-rank";
import type { EventDeps, EventRecord, MeetStore } from "../ports";
import { pulihkanTandaTangan } from "../pulihkan-tanda-tangan";

const DISCOVERY_LIMIT = 50;

/**
 * Ambang k-anonimitas untuk `penandaHadir`, lapis pertama: ukuran kerumunan.
 *
 * Di event kecil, pemanggil yang sudah terbukti dan tahu jumlah RSVP event
 * ini bisa menyimpulkan SIAPA menandainya lewat eliminasi murni — bukan
 * dengan melihat nama, hanya dengan berhitung. Itu adalah reveal SEPIHAK,
 * dan aturan inti aplikasi ini mensyaratkan KEDUA pihak sama-sama menandai
 * sebelum identitas siapa pun terungkap.
 *
 * Ambang ini LUNAK, dan harus dibaca begitu: `rsvp()` di event-gate.ts tidak
 * meminta tier, koneksi, ongkos, maupun tulisan on-chain — RSVP gratis dibuat.
 * Penyerang di acara berdua cukup menambahkan empat alamat miliknya sendiri
 * untuk membuat `summary.rsvps` melewati ambang ini, padahal kerumunan
 * sebenarnya tidak bertambah seorang pun. Karena itu ia BUKAN penjaga utama;
 * yang benar-benar menutup identifikasi adalah PENANDA_HADIR_MIN_NILAI di
 * bawah. Ambang ini dipertahankan sebagai lapis kedua, bukan sebagai jaminan.
 */
const PENANDA_HADIR_MIN_RSVP = 5;

/**
 * Ambang k-anonimitas untuk `penandaHadir`, lapis kedua: NILAI angkanya.
 *
 * Kasus yang benar-benar mengidentifikasi orang adalah angka KECIL, bukan
 * kerumunan kecil. `penandaHadir: 1` menyebut satu orang tertentu lewat
 * eliminasi berapa pun besar acaranya, dan `2` masih menyisakan himpunan
 * yang bisa ditebak di kerumunan yang saling kenal. Ambang pada nilai
 * menutup itu tanpa bergantung pada jumlah RSVP sama sekali.
 *
 * Justru inilah yang membuat ambang ini kebal terhadap serangan yang
 * melumpuhkan PENANDA_HADIR_MIN_RSVP: menggelembungkan RSVP dengan alamat
 * sendiri TIDAK menaikkan `penandaHadir` — angka itu hanya naik kalau orang
 * sungguhan menandai pemanggil, dan penyerang tidak bisa memaksa siapa pun
 * menandai orang lain. Sybil bisa membuka gerbang pertama; gerbang ini tidak.
 *
 * Keduanya harus terpenuhi sebelum angkanya keluar.
 */
const PENANDA_HADIR_MIN_NILAI = 3;

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
 * lengkap, belum kedaluwarsa, dan tanda tangan LihatEvent-nya memang milik
 * `who`. Selain itu null — termasuk kalau tidak ada satu pun parameter yang
 * dikirim.
 *
 * Tipe LihatEvent, BUKAN Rsvp: bentuk fieldnya sama ({eventId, who,
 * expiresAt}), tapi POST /events/:id/rsvp menerima Rsvp sebagai perintah
 * TULIS. Kalau proof baca ini memakai tipe yang sama, tanda tangan yang
 * bocor lewat query string (log akses, proxy, siapa pun yang membaca URL
 * dalam masa berlakunya) bisa diputar ulang sebagai RSVP sungguhan.
 * LihatEvent adalah tipe terpisah justru supaya digest-nya berbeda dan
 * tanda tangan ini tidak valid di jalur tulis.
 */
async function pemanggilTerbukti(
  q: Record<string, string>, eventId: Hex, deps: EventDeps,
): Promise<Address | null> {
  const { who, expiresAt, sig } = q;
  if (!who || !expiresAt || !sig) return null;
  if (!isAddress(who)) return null;
  if (!/^\d+$/.test(expiresAt)) return null;
  if (deps.nowMs() > Number(expiresAt) * 1000) return null;

  // Lewat pulihkanTandaTangan: tanda tangan yang cacat bentuknya membuat viem
  // melempar. Itu tetap "tidak terbukti", bukan 500.
  const signer = await pulihkanTandaTangan(() => recoverLihatEventSigner(
      { eventId, who: who as Address, expiresAt: BigInt(expiresAt) },
    sig as Hex,
    deps.attendanceContract,
  ));
  if (signer === null || signer.toLowerCase() !== who.toLowerCase()) return null;
  return who.toLowerCase() as Address;
}

export function eventRoutes(
  deps: EventDeps & { onChanged: () => Promise<void>; meet: MeetStore },
) {
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
  // `who` lewat tanda tangan LihatEvent. Tanpa bukti itu, `?who=` jadi oracle
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
      const [sudahRsvp, sudahCheckIn, tandaKe, tandaOleh, alamatRsvp] = await Promise.all([
        deps.events.hasRsvp(ev.eventId, addr),
        deps.events.hasCheckIn(ev.eventId, addr),
        deps.meet.tandaKe(addr),
        deps.meet.tandaOleh(addr),
        deps.events.rsvpAddresses(ev.eventId),
      ]);

      // Spec §4.3: ANGKA, bukan daftar. Daftar akan membocorkan siapa
      // menandai siapa, dan itu justru yang dijaga spec induk §7.6.
      //
      // Keduanya di dalam cabang TERBUKTI: tanpa itu, siapa pun bisa
      // menanyakan "berapa orang yang ingin bertemu Alice akan datang ke
      // acara ini", dan mengulanginya lintas banyak acara akan menyingkap
      // pola tanda Alice tanpa satu nama pun terlihat (spec §5.3).
      //
      // `kutandaiHadir` memotong KECOCOKAN dengan daftar RSVP, bukan tanda
      // sepihak. Bedanya bukan kosmetik.
      //
      // Versi sepihak — |tandaOleh ∩ RSVP| — adalah oracle keanggotaan RSVP.
      // Menandai orang itu gratis, sepihak, tidak butuh kontak sebelumnya,
      // dan senyap. Jadi siapa pun yang bisa membuat bukti LihatEvent (cukup
      // tanda tangan atas namanya sendiri; tidak perlu RSVP, check-in, atau
      // hubungan apa pun dengan acaranya) bisa: baca `kutandaiHadir`, tandai
      // X, baca lagi. Selisih 1 berarti X RSVP di acara ini. Cabut tandanya,
      // barisnya terhapus, angkanya kembali seperti semula — dan X tidak
      // pernah tahu. Diulang lintas hasil penemuan acara, itu memberi kalender
      // X ke depan: sinyal lokasi fisik, di aplikasi yang justru
      // mempertemukan orang asing secara fisik, kepada orang yang belum
      // pernah ditemui X.
      //
      // Memotong dengan kecocokan menutup itu karena KEDUA pihak sudah
      // sepakat saling terlihat: agar RSVP X ikut terhitung, X harus lebih
      // dulu menandai pemanggil balik — pilihan X sendiri, bukan pilihan
      // pemanggil. Itulah sebabnya kunci ini tidak diberi ambang: yang
      // ditampilkannya sudah berada di dalam batas pengungkapan yang dibuka
      // kedua orang sendiri.
      //
      // Yang tertutup adalah serangan terhadap ORANG ASING, bukan seluruh
      // probe. Terhadap X yang sudah mencocokimu, pemanggil masih bisa
      // mencabut tandanya (kecocokan bubar, angkanya turun kalau X RSVP) lalu
      // memasangnya lagi. Bedanya dengan versi sepihak: himpunan yang bisa
      // disurvei menyusut jadi orang yang memang sudah menandai pemanggil,
      // dan probenya meninggalkan jejak — memasang ulang tanda memajukan
      // `sejakMs` kecocokan itu (Math.max kedua tanda), jadi ia menyala lagi
      // sebagai "baru" di lencana X. Jangan baca ini sebagai selesai; spec
      // §11.8 mencatat residunya.
      //
      // `penandaHadir` beda: ia menghitung tanda sepihak ke arah pemanggil,
      // jadi ia digerbangi dua ambang di atas.
      const kecocokan = kecocokanDari(tandaOleh, tandaKe);
      const kutandaiHadir = irisan(kecocokan.map((k) => k.address), alamatRsvp);

      const penandaHadirMentah = irisan(tandaKe.map((t) => t.address), alamatRsvp);
      const penandaHadir =
        summary.rsvps >= PENANDA_HADIR_MIN_RSVP
        && penandaHadirMentah >= PENANDA_HADIR_MIN_NILAI
          ? penandaHadirMentah
          : undefined;

      return c.json({
        ...eventToJson(ev), ...summary,
        sudahRsvp, sudahCheckIn,
        ...(penandaHadir !== undefined ? { penandaHadir } : {}),
        kutandaiHadir,
      });
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
