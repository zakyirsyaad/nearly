import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hex } from "viem";
import { potongKelompok } from "./feed-store";
import { fetchAllPages, PAGE_SIZE } from "./trust/store";
import type { AcaraGraf, CheckInGraf, GrafStore, KoneksiGraf } from "./ports";
import { JENDELA_DAFTAR_ACARA_DETIK } from "./graf";

/**
 * Kolom yang BOLEH dipilih dari `connections` untuk graf publik. `cell` dan
 * `nonce` sengaja tidak ada (spec 6 §4.4) — yang tidak pernah dibaca tidak
 * bisa bocor.
 */
const KOLOM_KONEKSI = "id, addr_a, addr_b, created_at, tx_hash";
/** Tanpa `center_cell`, `host`, `venue_label`, `tx_hash`. */
const KOLOM_ACARA = "event_id, title, starts_at, ends_at";

export type BarisKoneksiGraf = {
  id: number | string; addr_a: string; addr_b: string; created_at: string; tx_hash: string;
};
export type BarisAcaraGraf = {
  event_id: string; title: string; starts_at: number | string; ends_at: number | string;
};

/** Waktu diurai PERSIS seperti `rowsToGraph`: `new Date(created_at).getTime()`. */
export function rowToKoneksiGraf(r: BarisKoneksiGraf): KoneksiGraf {
  return {
    id: Number(r.id),
    a: r.addr_a.toLowerCase() as Address,
    b: r.addr_b.toLowerCase() as Address,
    atMs: new Date(r.created_at).getTime(),
    txHash: r.tx_hash as Hex,
  };
}

export function rowToAcaraGraf(r: BarisAcaraGraf): AcaraGraf {
  return {
    eventId: r.event_id.toLowerCase() as Hex,
    title: r.title,
    startsAt: Number(r.starts_at),
    endsAt: Number(r.ends_at),
  };
}

export function createGrafStore(db: SupabaseClient): GrafStore {
  return {
    async koneksiSejak(sejakId, batas) {
      // PostgREST memotong di 1000 baris TANPA galat (lihat fetchAllPages),
      // jadi halaman 2000 diambil per potongan PAGE_SIZE. Offset di atas
      // `id > sejakId order by id` stabil: id tidak pernah berubah dan baris
      // baru selalu mendapat id lebih besar.
      const hasil: KoneksiGraf[] = [];
      for (let from = 0; hasil.length < batas; from += PAGE_SIZE) {
        const to = Math.min(from + PAGE_SIZE, batas) - 1;
        const { data, error } = await db.from("connections").select(KOLOM_KONEKSI)
          .gt("id", sejakId).order("id", { ascending: true }).range(from, to);
        if (error) throw new Error(`baca koneksi graf gagal: ${error.message}`);
        const halaman = (data ?? []) as BarisKoneksiGraf[];
        hasil.push(...halaman.map(rowToKoneksiGraf));
        if (halaman.length < to - from + 1) break;
      }
      return hasil;
    },

    async acara(eventId) {
      const { data, error } = await db.from("events").select(KOLOM_ACARA)
        .eq("event_id", eventId.toLowerCase()).maybeSingle();
      if (error) throw new Error(`baca acara graf gagal: ${error.message}`);
      return data ? rowToAcaraGraf(data as BarisAcaraGraf) : null;
    },

    async acaraBeririsan(mulaiDetik, akhirDetik) {
      const rows = await fetchAllPages<BarisAcaraGraf>(
        (f, t) => db.from("events").select(KOLOM_ACARA)
          .lte("starts_at", akhirDetik).gte("ends_at", mulaiDetik)
          .order("event_id", { ascending: true }).range(f, t) as never,
        "baca acara beririsan",
      );
      return rows.map(rowToAcaraGraf);
    },

    async checkInAcara(eventIds) {
      const unik = [...new Set(eventIds.map((e) => e.toLowerCase()))];
      if (unik.length === 0) return [];
      const perKelompok = await Promise.all(potongKelompok(unik).map((bagian) =>
        fetchAllPages<{ event_id: string; address: string }>(
          (f, t) => db.from("checkins").select("event_id, address")
            .in("event_id", bagian)
            .order("event_id", { ascending: true }).order("address", { ascending: true })
            .range(f, t) as never,
          "baca check-in graf",
        )));
      return perKelompok.flat().map((r): CheckInGraf => ({
        eventId: r.event_id.toLowerCase() as Hex,
        address: r.address.toLowerCase() as Address,
      }));
    },

    async koneksiDalamJendela(mulaiMs, akhirMs) {
      // `lt(akhirMs + 1)`, bukan `lte(akhirMs)`: created_at bisa bermikrodetik.
      // Koneksi pada akhirMs + 0,4 ms punya getTime() === akhirMs dan MASUK
      // menurut trust; `lte` akan membuangnya. Superset aman — graf.ts memutuskan.
      const rows = await fetchAllPages<BarisKoneksiGraf>(
        (f, t) => db.from("connections").select(KOLOM_KONEKSI)
          .gte("created_at", new Date(mulaiMs).toISOString())
          .lt("created_at", new Date(akhirMs + 1).toISOString())
          .order("id", { ascending: true }).range(f, t) as never,
        "baca koneksi acara",
      );
      return rows.map(rowToKoneksiGraf);
    },

    async daftarAcara(nowDetik, batas) {
      const { data, error } = await db.from("events").select(KOLOM_ACARA)
        .lte("starts_at", nowDetik)
        .gte("ends_at", nowDetik - JENDELA_DAFTAR_ACARA_DETIK)
        .order("ends_at", { ascending: false })
        .limit(batas);
      if (error) throw new Error(`baca daftar acara gagal: ${error.message}`);
      return ((data ?? []) as BarisAcaraGraf[]).map(rowToAcaraGraf);
    },
  };
}
