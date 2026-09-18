import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address } from "viem";
import { potongKelompok } from "./feed-store";
import type { RadarStore } from "./ports";
import { fetchAllPages } from "./trust/store";

/** Retensi data lokasi yang tidak dipakai trust (spec 4b+5 §4.5, keputusan #5). */
export const RETENSI_LOKASI_MS = 24 * 60 * 60 * 1000;
export const RETENSI_LOKASI_DETIK = 24 * 60 * 60;

const kecil = (a: string) => a.toLowerCase();
const iso = (ms: number) => new Date(ms).toISOString();

/**
 * Akses Supabase untuk `kehadiran` dan `notif_kedekatan`, satu kueri baca ke
 * `connections`, dan penyapuan lokasi.
 *
 * `terhubungDengan` membaca tabel `connections` yang dimiliki HandshakeStore.
 * Menambah metode ke HandshakeStore berarti mengubah blok yang sudah ada di
 * ports.ts — dilarang batas jalur paralel spec 4b+5 §12. Presedennya
 * `MeetStore.profilRingkas`, yang membaca `profiles` dan `trust_snapshots`.
 */
export function createRadarStore(db: SupabaseClient): RadarStore {
  return {
    async ambilKehadiran(eventId, address) {
      const { data, error } = await db.from("kehadiran").select("cell, seen_at")
        .eq("event_id", kecil(eventId)).eq("address", kecil(address)).maybeSingle();
      if (error) throw new Error(`baca kehadiran gagal: ${error.message}`);
      if (!data) return null;
      const d = data as { cell: string; seen_at: string };
      return { cell: d.cell, seenAtMs: Date.parse(d.seen_at) };
    },

    async simpanKehadiran(eventId, address, cell, seenAtMs) {
      const { error } = await db.from("kehadiran").upsert({
        event_id: kecil(eventId), address: kecil(address), cell, seen_at: iso(seenAtMs),
      }, { onConflict: "event_id,address" });
      if (error) throw new Error(`simpan kehadiran gagal: ${error.message}`);
    },

    async hapusKehadiran(eventId, address) {
      const { error } = await db.from("kehadiran").delete()
        .eq("event_id", kecil(eventId)).eq("address", kecil(address));
      if (error) throw new Error(`hapus kehadiran gagal: ${error.message}`);
    },

    async hapusSemuaKehadiran(address) {
      const { error } = await db.from("kehadiran").delete().eq("address", kecil(address));
      if (error) throw new Error(`hapus semua kehadiran gagal: ${error.message}`);
    },

    async hadirSejak(eventId, sejakMs) {
      // Berhalaman penuh dengan urutan total (address unik per acara): select
      // polos terpotong 1000 baris tanpa galat, dan orang yang terpotong
      // hilang dari radar tanpa jejak (trust/store.ts).
      const baris = await fetchAllPages<{ address: string }>(
        (f, t) => db.from("kehadiran").select("address")
          .eq("event_id", kecil(eventId)).gte("seen_at", iso(sejakMs))
          .order("address", { ascending: true }).range(f, t) as never,
        "baca kehadiran acara",
      );
      return baris.map((r) => kecil(r.address) as Address);
    },

    async terhubungDengan(who, kandidat) {
      const w = kecil(who);
      const unik = [...new Set(kandidat.map(kecil))].filter((a) => a !== w);
      // `connections` menyimpan pasangan terurut `addr_a < addr_b` (0001).
      // Kandidat yang lebih besar dari `who` ada di `addr_b`, yang lebih
      // kecil di `addr_a` — dua kueri tepat, tanpa `.or()` yang membengkak.
      const lebihBesar = unik.filter((a) => a > w);
      const lebihKecil = unik.filter((a) => a < w);

      const kueri = [
        ...potongKelompok(lebihBesar).map(async (bagian) => {
          const { data, error } = await db.from("connections").select("addr_b")
            .eq("addr_a", w).in("addr_b", bagian);
          if (error) throw new Error(`baca koneksi radar gagal: ${error.message}`);
          return ((data ?? []) as { addr_b: string }[]).map((r) => kecil(r.addr_b));
        }),
        ...potongKelompok(lebihKecil).map(async (bagian) => {
          const { data, error } = await db.from("connections").select("addr_a")
            .eq("addr_b", w).in("addr_a", bagian);
          if (error) throw new Error(`baca koneksi radar gagal: ${error.message}`);
          return ((data ?? []) as { addr_a: string }[]).map((r) => kecil(r.addr_a));
        }),
      ];
      return new Set((await Promise.all(kueri)).flat());
    },

    async hitungKoneksiBersama(who, kandidat, kecuali) {
      const w = kecil(who);
      const unik = [...new Set(kandidat.map(kecil))].filter((k) => k !== w);
      if (unik.length === 0) return new Map();
      // Pemanggil, dan himpunan blokir dua arahnya, tidak pernah dihitung
      // sebagai koneksi bersama (spec desain UI §8.3).
      const buang = new Set([w, ...kecuali.map(kecil)]);

      // Koneksi pemanggil, berhalaman penuh di kedua sisi urutan kanonik.
      const [sisiA, sisiB] = await Promise.all([
        fetchAllPages<{ addr_b: string }>(
          (f, t) => db.from("connections").select("addr_b").eq("addr_a", w)
            .order("addr_b", { ascending: true }).range(f, t) as never,
          "baca koneksi pemanggil",
        ),
        fetchAllPages<{ addr_a: string }>(
          (f, t) => db.from("connections").select("addr_a").eq("addr_b", w)
            .order("addr_a", { ascending: true }).range(f, t) as never,
          "baca koneksi pemanggil",
        ),
      ]);
      const milikku = new Set(
        [...sisiA.map((r) => kecil(r.addr_b)), ...sisiB.map((r) => kecil(r.addr_a))].filter((m) => !buang.has(m)),
      );

      const hasil = new Map<string, number>(unik.map((k) => [k, 0]));
      if (milikku.size === 0) return hasil;

      // Koneksi kandidat: satu kueri per kelompok per sisi, seperti terhubungDengan.
      const kueri = potongKelompok(unik).flatMap((bagian) => ([
        fetchAllPages<{ addr_a: string; addr_b: string }>(
          (f, t) => db.from("connections").select("addr_a, addr_b").in("addr_a", bagian)
            .order("id", { ascending: true }).range(f, t) as never,
          "baca koneksi kandidat radar",
        ),
        fetchAllPages<{ addr_a: string; addr_b: string }>(
          (f, t) => db.from("connections").select("addr_a, addr_b").in("addr_b", bagian)
            .order("id", { ascending: true }).range(f, t) as never,
          "baca koneksi kandidat radar",
        ),
      ]));
      const terlihat = new Set<string>();
      for (const r of (await Promise.all(kueri)).flat()) {
        const a = kecil(r.addr_a);
        const b = kecil(r.addr_b);
        if (terlihat.has(`${a}|${b}`)) continue; // dua kandidat saling terhubung: baris muncul di dua kueri
        terlihat.add(`${a}|${b}`);
        if (hasil.has(a) && milikku.has(b)) hasil.set(a, (hasil.get(a) ?? 0) + 1);
        if (hasil.has(b) && milikku.has(a)) hasil.set(b, (hasil.get(b) ?? 0) + 1);
      }
      return hasil;
    },

    async hitungNotifKedekatan(eventId, penerima) {
      const { count, error } = await db.from("notif_kedekatan")
        .select("subjek", { count: "exact", head: true })
        .eq("event_id", kecil(eventId)).eq("penerima", kecil(penerima));
      if (error) throw new Error(`hitung notifikasi kedekatan gagal: ${error.message}`);
      return count ?? 0;
    },

    async sisipNotifKedekatan(eventId, penerima, subjek) {
      const { error } = await db.from("notif_kedekatan").insert({
        event_id: kecil(eventId), penerima: kecil(penerima), subjek: kecil(subjek),
      });
      // 23505 = unique_violation: pasangan ini sudah pernah diberi tahu di acara ini.
      if (error && (error as { code?: string }).code === "23505") return false;
      if (error) throw new Error(`sisip notifikasi kedekatan gagal: ${error.message}`);
      return true;
    },

    async sapuLokasi(nowMs) {
      const batasIso = iso(nowMs - RETENSI_LOKASI_MS);
      const batasDetik = Math.floor(nowMs / 1000) - RETENSI_LOKASI_DETIK;

      // Persis pernyataan spec 4b+5 §4.5. TIDAK ADA `connections` atau
      // `checkins` di sini: selnya dipakai sidik jari ko-lokasi trust
      // (load-graph.ts) — pengecualian keputusan #5, dicatat di §10.7.
      //
      // Offer TIDAK dihapus, hanya selnya dikosongkan: keberadaan barisnya yang
      // menolak nonce dipakai ulang (§4.4).
      const [kehadiran, notif, salaman, checkIn] = await Promise.all([
        db.from("kehadiran").delete({ count: "exact" }).lt("seen_at", batasIso),
        db.from("notif_kedekatan").delete({ count: "exact" }).lt("sent_at", batasIso),
        db.from("handshake_offers").update({ cell: null }, { count: "exact" })
          .lt("expires_at", batasDetik).not("cell", "is", null),
        db.from("checkin_offers").update({ cell: null }, { count: "exact" })
          .lt("expires_at", batasDetik).not("cell", "is", null),
      ]);
      if (kehadiran.error) throw new Error(`sapu kehadiran gagal: ${kehadiran.error.message}`);
      if (notif.error) throw new Error(`sapu notifikasi kedekatan gagal: ${notif.error.message}`);
      if (salaman.error) throw new Error(`sapu sel QR salaman gagal: ${salaman.error.message}`);
      if (checkIn.error) throw new Error(`sapu sel QR check-in gagal: ${checkIn.error.message}`);

      return {
        kehadiran: kehadiran.count ?? 0,
        notifKedekatan: notif.count ?? 0,
        offerSalaman: salaman.count ?? 0,
        offerCheckIn: checkIn.count ?? 0,
      };
    },
  };
}
