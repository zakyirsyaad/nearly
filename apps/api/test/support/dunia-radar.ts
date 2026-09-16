import { vi } from "vitest";
import type { Address, Hex } from "viem";
import { encodeCell, neighborCells, type Visibilitas } from "@nearly/shared";
import type {
  BarisKehadiran, EventRecord, KunciPesanTerdaftar, ProfilDeps, ProfilSayaStore, PushPort,
  RadarDeps, RadarStore,
} from "../../src/ports";
import { duniaBlokir } from "./dunia-blokir";

export const NOW_RADAR = 1_700_000_000_000;
export const EVENT_RADAR = `0x${"e1".repeat(32)}` as Hex;
export const SEL_PUSAT = encodeCell(-6.2088, 106.8456);
export const SEL_TETANGGA = neighborCells(SEL_PUSAT)[0]!;
/** Beberapa kilometer dari pusat — pasti di luar geofence 3×3. */
export const SEL_JAUH = encodeCell(-6.3, 106.95);
export const VC_RADAR = "0x0000000000000000000000000000000000000abc" as Address;
export const MENIT = 60_000;

/** Alamat uji huruf kecil yang urutannya bisa ditebak: `alamat(1) < alamat(2)`. */
export const alamat = (n: number) => `0x${n.toString(16).padStart(40, "0")}` as Address;

/**
 * Dunia radar di memori: tabel `kehadiran`, `notif_kedekatan`, `profiles`,
 * `connections`, `checkins`, dan token push sebagai struktur data, dengan store
 * yang membacanya SUNGGUHAN. Meet dan blokir memakai duniaBlokir supaya kedua
 * arah blokir dan semantik `kecuali` nyata — fake yang mengembalikan jawaban
 * karangan tidak bisa membuktikan "blokir satu arah mana pun menyembunyikan".
 */
export function duniaRadar(awal: {
  acara?: Partial<EventRecord>;
  checkIn?: Address[];
  koneksi?: [Address, Address][];
  tanda?: { who: Address; target: Address }[];
  blokir?: { blocker: Address; blocked: Address }[];
  nama?: Record<string, string>;
  tier?: Record<string, number>;
  tersembunyi?: Address[];
  token?: Record<string, string[]>;
  nowMs?: number;
} = {}) {
  const kecil = (a: string) => a.toLowerCase();
  const pasangan = (a: string, b: string) => [kecil(a), kecil(b)].sort().join("|");
  const jam = { sekarang: awal.nowMs ?? NOW_RADAR };
  const detik = BigInt(Math.floor(jam.sekarang / 1000));

  const acara: EventRecord = {
    eventId: EVENT_RADAR, host: alamat(0xdead), title: "Hackathon", venueLabel: "Kalibata",
    centerCell: SEL_PUSAT, startsAt: detik - 600n, endsAt: detik + 3600n, txHash: "0xtx" as Hex,
    ...awal.acara,
  };

  const db = {
    kehadiran: new Map<string, BarisKehadiran & { eventId: string; address: string }>(),
    notif: [] as { eventId: string; penerima: string; subjek: string; sentAtMs: number }[],
    profil: new Map<string, { displayName: string; visibilitas: Visibilitas }>(),
    checkIn: new Set((awal.checkIn ?? []).map((a) => `${kecil(acara.eventId)}|${kecil(a)}`)),
    koneksi: new Set((awal.koneksi ?? []).map(([a, b]) => pasangan(a, b))),
    kunci: new Map<string, KunciPesanTerdaftar>(),
    token: Object.entries(awal.token ?? {}).flatMap(([a, ts]) => ts.map((t) => ({ address: kecil(a), token: t }))),
  };
  for (const a of awal.tersembunyi ?? []) db.profil.set(kecil(a), { displayName: "", visibilitas: "tersembunyi" });
  for (const [a, n] of Object.entries(awal.nama ?? {})) {
    const lama = db.profil.get(kecil(a));
    db.profil.set(kecil(a), { displayName: n, visibilitas: lama?.visibilitas ?? "terlihat" });
  }
  const tier = new Map(Object.entries(awal.tier ?? {}).map(([a, t]) => [kecil(a), t]));
  const kunciHadir = (e: string, a: string) => `${kecil(e)}|${kecil(a)}`;

  const blok = duniaBlokir({ tanda: awal.tanda, blokir: awal.blokir });

  const radar: RadarStore = {
    ambilKehadiran: vi.fn(async (e: Hex, a: Address) => {
      const b = db.kehadiran.get(kunciHadir(e, a));
      return b ? { cell: b.cell, seenAtMs: b.seenAtMs } : null;
    }),
    simpanKehadiran: vi.fn(async (e: Hex, a: Address, cell: string, seenAtMs: number) => {
      db.kehadiran.set(kunciHadir(e, a), { eventId: kecil(e), address: kecil(a), cell, seenAtMs });
    }),
    hapusKehadiran: vi.fn(async (e: Hex, a: Address) => { db.kehadiran.delete(kunciHadir(e, a)); }),
    hapusSemuaKehadiran: vi.fn(async (a: Address) => {
      for (const [k, b] of db.kehadiran) if (b.address === kecil(a)) db.kehadiran.delete(k);
    }),
    hadirSejak: vi.fn(async (e: Hex, sejakMs: number) => [...db.kehadiran.values()]
      .filter((b) => b.eventId === kecil(e) && b.seenAtMs >= sejakMs)
      .map((b) => b.address as Address).sort()),
    terhubungDengan: vi.fn(async (who: Address, kandidat: Address[]) =>
      new Set(kandidat.map(kecil).filter((k) => db.koneksi.has(pasangan(who, k))))),
    hitungNotifKedekatan: vi.fn(async (e: Hex, p: Address) =>
      db.notif.filter((n) => n.eventId === kecil(e) && n.penerima === kecil(p)).length),
    sisipNotifKedekatan: vi.fn(async (e: Hex, p: Address, s: Address) => {
      if (db.notif.some((n) => n.eventId === kecil(e) && n.penerima === kecil(p) && n.subjek === kecil(s))) return false;
      db.notif.push({ eventId: kecil(e), penerima: kecil(p), subjek: kecil(s), sentAtMs: jam.sekarang });
      return true;
    }),
    sapuLokasi: vi.fn(async () => ({ kehadiran: 0, notifKedekatan: 0, offerSalaman: 0, offerCheckIn: 0 })),
  };

  const profilSaya: ProfilSayaStore = {
    profilSaya: vi.fn(async (a: Address) => {
      const p = db.profil.get(kecil(a));
      return { displayName: p?.displayName ?? "", visibilitas: p?.visibilitas ?? "terlihat" };
    }),
    aturProfil: vi.fn(async (a: Address, p: { displayName: string; visibilitas: Visibilitas }) => {
      db.profil.set(kecil(a), { displayName: p.displayName, visibilitas: p.visibilitas });
    }),
    visibilitasBanyak: vi.fn(async (addrs: Address[]) =>
      new Map(addrs.map((a) => [kecil(a), db.profil.get(kecil(a))?.visibilitas ?? "terlihat" as Visibilitas]))),
  };

  const push = { kirim: vi.fn<PushPort["kirim"]>(async () => ({ tokenMati: [] })) };

  const deps: RadarDeps & ProfilDeps = {
    radar,
    profilSaya,
    events: {
      getEvent: vi.fn(async (e: Hex) => (kecil(e) === kecil(acara.eventId) ? acara : null)),
      hasCheckIn: vi.fn(async (e: Hex, a: Address) => db.checkIn.has(`${kecil(e)}|${kecil(a)}`)),
    },
    blokir: blok.blokir,
    meet: {
      tandaOleh: blok.meet.tandaOleh,
      tandaKe: blok.meet.tandaKe,
      profilRingkas: vi.fn(async (addrs: Address[]) => new Map(addrs.map((a) => [
        kecil(a), { displayName: db.profil.get(kecil(a))?.displayName ?? "", tier: tier.get(kecil(a)) ?? 0 },
      ]))),
    },
    pesan: {
      ambilKunci: vi.fn(async (a: Address) => db.kunci.get(kecil(a)) ?? null),
      tokenPush: vi.fn(async (a: Address) => db.token.filter((t) => t.address === kecil(a)).map((t) => t.token)),
      hapusTokenPush: vi.fn(async (ts: string[]) => { db.token = db.token.filter((t) => !ts.includes(t.token)); }),
    },
    push,
    verifyingContract: VC_RADAR,
    nowMs: () => jam.sekarang,
  };

  return {
    deps,
    db,
    push,
    jam,
    acara,
    pasangBlokir: blok.pasangBlokir,
    /** Menulis baris kehadiran langsung, seperti detak yang lolos `menitLalu` menit lalu. */
    hadirkan(a: Address, menitLalu = 0, cell = SEL_PUSAT) {
      db.kehadiran.set(kunciHadir(acara.eventId, a), {
        eventId: kecil(acara.eventId), address: kecil(a), cell, seenAtMs: jam.sekarang - menitLalu * MENIT,
      });
    },
    sembunyikan(a: Address) {
      const lama = db.profil.get(kecil(a));
      db.profil.set(kecil(a), { displayName: lama?.displayName ?? "", visibilitas: "tersembunyi" });
    },
  };
}
