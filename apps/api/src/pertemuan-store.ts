import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hex } from "viem";
import { potongKelompok } from "./feed-store";
import type { AcaraRingkas, PertemuanStore } from "./ports";
import { fetchAllPages } from "./trust/store";

const kecil = (a: string) => a.toLowerCase();

/**
 * Kolom `events` yang BOLEH dibaca. `host` dan `tx_hash` sengaja tidak ada —
 * yang tidak pernah dibaca tidak bisa bocor (pola graf-store.ts). `center_cell`
 * dibaca HANYA untuk geofence di server.
 */
const KOLOM_ACARA = "event_id, title, venue_label, center_cell, starts_at, ends_at";

type BarisAcara = {
  event_id: string;
  title: string;
  venue_label: string;
  center_cell: string;
  starts_at: number | string;
  ends_at: number | string;
};

export function rowToAcaraRingkas(r: BarisAcara): AcaraRingkas {
  return {
    eventId: kecil(r.event_id) as Hex,
    title: r.title,
    venueLabel: r.venue_label,
    centerCell: r.center_cell,
    startsAt: Number(r.starts_at),
    endsAt: Number(r.ends_at),
  };
}

/**
 * Riwayat pertemuan dan penjamin (spec desain UI §8.1, §8.2). Semua kueri
 * dilayani indeks yang ada (§8.5): `connections_unique_pair`,
 * `checkins_address`, primary key `events`, `vouches_to` (parsial, aktif).
 */
export function createPertemuanStore(db: SupabaseClient): PertemuanStore {
  async function acaraCheckIn(address: Address): Promise<string[]> {
    // Berhalaman penuh dengan urutan total (event_id unik per alamat):
    // select polos terpotong 1000 baris tanpa galat (trust/store.ts).
    const baris = await fetchAllPages<{ event_id: string }>(
      (f, t) => db.from("checkins").select("event_id").eq("address", kecil(address))
        .order("event_id", { ascending: true }).range(f, t) as never,
      "baca check-in pertemuan",
    );
    return baris.map((r) => kecil(r.event_id));
  }

  return {
    async koneksiPasangan(a, b) {
      // Pasangan terurut addr_a < addr_b (0001): satu baris, satu kueri.
      const [x, y] = [kecil(a), kecil(b)].sort() as [string, string];
      const { data, error } = await db.from("connections").select("created_at, cell")
        .eq("addr_a", x).eq("addr_b", y).maybeSingle();
      if (error) throw new Error(`baca koneksi pasangan gagal: ${error.message}`);
      if (!data) return null;
      const d = data as { created_at: string; cell: string | null };
      return { atMs: new Date(d.created_at).getTime(), cell: d.cell ?? null };
    },

    async acaraCheckInBersama(a, b) {
      const [milikA, milikB] = await Promise.all([acaraCheckIn(a), acaraCheckIn(b)]);
      const setB = new Set(milikB);
      const bersama = [...new Set(milikA)].filter((e) => setB.has(e));
      const hasil = await Promise.all(potongKelompok(bersama).map(async (bagian) => {
        const { data, error } = await db.from("events").select(KOLOM_ACARA).in("event_id", bagian);
        if (error) throw new Error(`baca acara pertemuan gagal: ${error.message}`);
        return ((data ?? []) as BarisAcara[]).map(rowToAcaraRingkas);
      }));
      return hasil.flat();
    },

    async penjaminAktif(to) {
      const baris = await fetchAllPages<{ from_addr: string }>(
        (f, t) => db.from("vouches").select("from_addr").eq("to_addr", kecil(to)).is("revoked_at", null)
          .order("from_addr", { ascending: true }).range(f, t) as never,
        "baca penjamin aktif",
      );
      return baris.map((r) => kecil(r.from_addr) as Address);
    },
  };
}
