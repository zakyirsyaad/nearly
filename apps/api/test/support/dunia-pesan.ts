import { vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { kunciPesanTypedData, turunkanKunciPesan, VERSI_KUNCI_PESAN } from "@nearly/shared";
import type {
  BarisPesan, BuktiTersimpan, KunciPesanTerdaftar, PesanDeps, PesanStore, PushPort,
} from "../../src/ports";
import { duniaBlokir } from "./dunia-blokir";

export const VC_PESAN = "0x0000000000000000000000000000000000000abc" as Address;
export const VOUCH_PESAN = "0x0000000000000000000000000000000000000def" as Address;

/** Pengguna uji dengan kunci pesan SUNGGUHAN, diturunkan persis seperti di HP. */
export async function buatPengguna(hexByte: string) {
  const akun = privateKeyToAccount(`0x${hexByte.repeat(32)}` as Hex);
  const kunci = turunkanKunciPesan(await akun.signTypedData(
    kunciPesanTypedData({ who: akun.address, versi: VERSI_KUNCI_PESAN }, VC_PESAN)));
  return {
    akun,
    address: akun.address as Address,
    kunci,
    terdaftar: { kunciEnkripsi: kunci.pubEnkripsi, kunciTanda: kunci.pubTanda } as KunciPesanTerdaftar,
  };
}

/**
 * Dunia pesan di memori: tabel sebagai larik, dengan PesanStore yang
 * membacanya SUNGGUHAN. Blokir memakai duniaBlokir supaya kedua arahnya
 * nyata. Fake yang mengembalikan jawaban karangan tidak bisa membuktikan
 * urutan gerbang — "bukan koneksi tidak bisa membedakan belum_siap" hanya
 * bermakna kalau kunci lawan BENAR-BENAR ada di dunia ini.
 */
export function duniaPesan(awal: {
  koneksi?: [Address, Address][];
  blokir?: { blocker: Address; blocked: Address }[];
  nama?: Record<string, string>;
  nowMs?: number;
} = {}) {
  const kecil = (a: string) => a.toLowerCase();
  const pasangan = (a: string, b: string) => [kecil(a), kecil(b)].sort().join("|");
  const koneksi = new Set((awal.koneksi ?? []).map(([a, b]) => pasangan(a, b)));
  const nama = new Map(Object.entries(awal.nama ?? {}).map(([k, v]) => [kecil(k), v]));
  const jam = { sekarang: awal.nowMs ?? 1_700_000_000_000 };
  const db = {
    kunci: new Map<string, KunciPesanTerdaftar>(),
    pesan: [] as BarisPesan[],
    token: [] as { address: string; token: string }[],
    bukti: new Map<number, BuktiTersimpan[]>(),
  };
  const blok = duniaBlokir({ blokir: awal.blokir });
  const laporan: { id: number; reporter: string; subject: string; reason: string }[] = [];

  const pesan: PesanStore = {
    simpanKunci: vi.fn(async (a: Address, k: KunciPesanTerdaftar) => {
      db.kunci.set(kecil(a), { kunciEnkripsi: kecil(k.kunciEnkripsi) as Hex, kunciTanda: kecil(k.kunciTanda) as Hex });
    }),
    ambilKunci: vi.fn(async (a: Address) => db.kunci.get(kecil(a)) ?? null),
    simpanPesan: vi.fn(async (r) => {
      if (db.pesan.some((p) => p.id === kecil(r.id))) return "sudah_ada" as const;
      db.pesan.push({
        id: kecil(r.id), pengirim: kecil(r.pengirim) as Address, penerima: kecil(r.penerima) as Address,
        ciphertext: r.ciphertext, nonce: r.nonce, createdAtMs: jam.sekarang, dibacaAtMs: null,
      });
      return "baru" as const;
    }),
    hitungTerkirimSejak: vi.fn(async (p: Address, sejak: number) =>
      db.pesan.filter((x) => x.pengirim === kecil(p) && x.createdAtMs >= sejak).length),
    pesanTerbaruUntuk: vi.fn(async (w: Address, batas: number) => db.pesan
      .filter((x) => x.pengirim === kecil(w) || x.penerima === kecil(w))
      .sort((a, b) => b.createdAtMs - a.createdAtMs).slice(0, batas)),
    belumDibacaPerPengirim: vi.fn(async (pen: Address) => {
      const m = new Map<string, number>();
      for (const x of db.pesan) {
        if (x.penerima === kecil(pen) && x.dibacaAtMs === null) m.set(x.pengirim, (m.get(x.pengirim) ?? 0) + 1);
      }
      return m;
    }),
    riwayat: vi.fn(async (a: Address, b: Address, sebelum: number | null, batas: number) => db.pesan
      .filter((x) => pasangan(x.pengirim, x.penerima) === pasangan(a, b)
        && (sebelum === null || x.createdAtMs < sebelum))
      .sort((p, q) => q.createdAtMs - p.createdAtMs).slice(0, batas)),
    tandaiDibaca: vi.fn(async (pen: Address, pengirim: Address, sampai: number) => {
      for (const x of db.pesan) {
        if (x.penerima === kecil(pen) && x.pengirim === kecil(pengirim)
          && x.dibacaAtMs === null && x.createdAtMs <= sampai) x.dibacaAtMs = jam.sekarang;
      }
    }),
    adaBelumDibacaLainDari: vi.fn(async (pen: Address, pengirim: Address, kecuali: string) => db.pesan
      .some((x) => x.penerima === kecil(pen) && x.pengirim === kecil(pengirim)
        && x.dibacaAtMs === null && x.id !== kecil(kecuali))),
    simpanTokenPush: vi.fn(async (a: Address, t: string) => {
      db.token = db.token.filter((x) => !(x.token === t && x.address !== kecil(a)));
      if (!db.token.some((x) => x.token === t)) db.token.push({ address: kecil(a), token: t });
    }),
    tokenPush: vi.fn(async (a: Address) => db.token.filter((x) => x.address === kecil(a)).map((x) => x.token)),
    hapusTokenPush: vi.fn(async (ts: string[]) => { db.token = db.token.filter((x) => !ts.includes(x.token)); }),
    pesanBerdasarkanId: vi.fn(async (ids: string[]) => db.pesan.filter((x) => ids.map(kecil).includes(x.id))),
    gantiBuktiLaporan: vi.fn(async (id: number, b: BuktiTersimpan[]) => { db.bukti.set(id, b); }),
  };

  const push = { kirim: vi.fn<PushPort["kirim"]>(async () => ({ tokenMati: [] })) };

  const deps: PesanDeps = {
    pesan,
    blokir: blok.blokir,
    store: { areConnected: vi.fn(async (a: Address, b: Address) => koneksi.has(pasangan(a, b))) },
    meet: {
      profilRingkas: vi.fn(async (addrs: Address[]) => new Map(addrs.map((a) => [
        kecil(a), { displayName: nama.get(kecil(a)) ?? "", tier: 1 },
      ]))),
    },
    reports: {
      recordReport: vi.fn(async (r) => {
        const id = laporan.length + 1;
        laporan.push({ id, reporter: kecil(r.reporter), subject: kecil(r.subject), reason: r.reason });
        return id;
      }),
    },
    push,
    verifyingContract: VC_PESAN,
    vouchContract: VOUCH_PESAN,
    nowMs: () => jam.sekarang,
  };

  return { deps, db, push, laporan, jam, pasangBlokir: blok.pasangBlokir };
}
