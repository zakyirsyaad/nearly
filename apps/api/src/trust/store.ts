import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address } from "viem";
import type { TrustResult } from "@nearly/trust";
import type { ReportStore, TrustStore, VouchStore } from "../ports";
import { rowsToGraph } from "./load-graph";
import type { CheckInRow, ConnRow, EventWindowRow, SeedRow, SlashRow, VouchRow } from "./load-graph";

type Res<T> = { data: T | null; error: { message: string } | null };

function unwrap<T>(res: Res<T[]>, what: string): T[] {
  if (res.error) throw new Error(`${what} gagal: ${res.error.message}`);
  return res.data ?? [];
}

/**
 * Besar satu halaman. Disamakan dengan batas baris bawaan PostgREST supaya
 * halaman kita tidak pernah lebih besar dari yang mau dilayani server.
 */
export const PAGE_SIZE = 1000;

/**
 * Mengambil SELURUH baris sebuah tabel, per halaman.
 *
 * Tanpa ini, `select()` polos bergantung pada batas baris server — Supabase
 * umumnya memotong di 1000. Pemotongan itu TIDAK menghasilkan error: ia
 * mengembalikan sebagian data yang terlihat sah, graf trust jadi tidak lengkap,
 * dan SETIAP skor diam-diam salah. Di ruangan 500 orang, jumlah koneksi
 * melewati batas itu jauh sebelum grafnya terasa besar.
 *
 * Berhenti saat sebuah halaman mengembalikan kurang dari yang diminta — satu-
 * satunya tanda yang bisa dipercaya bahwa data sudah habis, karena jumlah total
 * bisa berubah di antara dua permintaan.
 */
export async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<Res<T[]>>,
  what: string,
  pageSize = PAGE_SIZE,
): Promise<T[]> {
  const semua: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const res = await fetchPage(from, from + pageSize - 1);
    // Gagal di tengah TIDAK boleh mengembalikan sebagian: itu kegagalan senyap
    // yang sama dengan pemotongan, tapi lebih sulit dilacak.
    if (res.error) throw new Error(`${what} gagal: ${res.error.message}`);

    const halaman = res.data ?? [];
    semua.push(...halaman);
    if (halaman.length < pageSize) return semua;
  }
}

export function createTrustStore(db: SupabaseClient): TrustStore {
  return {
    async loadGraph(nowMs) {
      // Diurutkan eksplisit: paginasi hanya benar kalau urutannya stabil antar
      // permintaan. Tanpa order by, PostgREST tidak menjamin apa pun dan sebuah
      // baris bisa terlewat atau terhitung dua kali di batas halaman.
      const [connections, vouches, seeds, slashes, checkins, events] = await Promise.all([
        fetchAllPages<ConnRow>(
          (f, t) =>
            db.from("connections").select("addr_a, addr_b, cell, created_at")
              .order("id", { ascending: true }).range(f, t) as never,
          "baca koneksi",
        ),
        fetchAllPages<VouchRow>(
          (f, t) =>
            db.from("vouches").select("from_addr, to_addr, created_at, revoked_at")
              .order("from_addr", { ascending: true }).order("to_addr", { ascending: true })
              .range(f, t) as never,
          "baca vouch",
        ),
        fetchAllPages<SeedRow>(
          (f, t) =>
            db.from("trust_seeds").select("address, weight")
              .order("address", { ascending: true }).range(f, t) as never,
          "baca seed",
        ),
        fetchAllPages<SlashRow>(
          (f, t) =>
            db.from("slashes").select("subject")
              .order("subject", { ascending: true }).range(f, t) as never,
          "baca slash",
        ),
        fetchAllPages<CheckInRow>(
          (f, t) =>
            db.from("checkins").select("event_id, address")
              .order("event_id", { ascending: true }).order("address", { ascending: true })
              .range(f, t) as never,
          "baca check-in",
        ),
        fetchAllPages<EventWindowRow>(
          (f, t) =>
            db.from("events").select("event_id, center_cell, starts_at, ends_at")
              .order("event_id", { ascending: true }).range(f, t) as never,
          "baca event",
        ),
      ]);
      return rowsToGraph({ connections, vouches, seeds, slashes, checkins, events }, nowMs);
    },

    async saveSnapshots(rows, computedAt) {
      if (rows.length === 0) return;
      const { error } = await db.from("trust_snapshots").upsert(
        rows.map((r) => ({
          address: r.address.toLowerCase(),
          score: r.score,
          ratio: r.ratio,
          tier: r.tier,
          connections: r.evidence.connections,
          occasions: r.evidence.occasions,
          regions: r.evidence.regions,
          vouches: r.evidence.vouches,
          operator_cluster: r.operatorCluster,
          computed_at: new Date(computedAt).toISOString(),
        })),
        { onConflict: "address" },
      );
      if (error) throw new Error(`simpan snapshot gagal: ${error.message}`);
    },

    async getSnapshot(addr) {
      const { data, error } = await db
        .from("trust_snapshots")
        .select("*")
        .eq("address", addr.toLowerCase())
        .maybeSingle();
      if (error) throw new Error(`baca snapshot gagal: ${error.message}`);
      if (!data) return null;
      return {
        address: data.address as Address,
        score: Number(data.score),
        ratio: Number(data.ratio),
        tier: data.tier as TrustResult["tier"],
        evidence: {
          connections: data.connections as number,
          occasions: data.occasions as number,
          regions: data.regions as number,
          vouches: data.vouches as number,
        },
        operatorCluster: (data.operator_cluster as string | null) ?? null,
      };
    },

    async listPublishedTiers() {
      const { data, error } = await db.from("trust_published").select("address, tier");
      if (error) throw new Error(`baca publikasi gagal: ${error.message}`);
      return new Map((data ?? []).map((r) => [r.address as string, r.tier as number]));
    },

    async markPublished(rows) {
      if (rows.length === 0) return;
      const { error } = await db.from("trust_published").upsert(
        rows.map((r) => ({
          address: r.address.toLowerCase(),
          tier: r.tier,
          score: r.score,
          tx_hash: r.txHash,
          published_at: new Date().toISOString(),
        })),
        { onConflict: "address" },
      );
      if (error) throw new Error(`catat publikasi gagal: ${error.message}`);
    },
  };
}

export function createVouchStore(db: SupabaseClient): VouchStore {
  return {
    async countVouchesSince(from, sinceMs) {
      const { count, error } = await db
        .from("vouches")
        .select("from_addr", { count: "exact", head: true })
        .eq("from_addr", from.toLowerCase())
        .gte("created_at", new Date(sinceMs).toISOString());
      if (error) throw new Error(`hitung kuota vouch gagal: ${error.message}`);
      return count ?? 0;
    },

    // "Pernah vouch", bukan "vouch masih aktif". Kontrak menyimpan catatan
    // vouch selamanya (satu vouch per pasangan), jadi mencoba vouch ulang
    // setelah dicabut akan revert AlreadyVouched. Menyaring revoked_at di sini
    // akan membuat API mengirim transaksi yang pasti gagal.
    async hasVouch(from, to) {
      const { count, error } = await db
        .from("vouches")
        .select("from_addr", { count: "exact", head: true })
        .eq("from_addr", from.toLowerCase())
        .eq("to_addr", to.toLowerCase());
      if (error) throw new Error(`cek vouch gagal: ${error.message}`);
      return (count ?? 0) > 0;
    },

    async isActiveVouch(from, to) {
      const { count, error } = await db
        .from("vouches")
        .select("from_addr", { count: "exact", head: true })
        .eq("from_addr", from.toLowerCase())
        .eq("to_addr", to.toLowerCase())
        .is("revoked_at", null);
      if (error) throw new Error(`cek vouch aktif gagal: ${error.message}`);
      return (count ?? 0) > 0;
    },

    async recordVouch(row) {
      const { error } = await db.from("vouches").upsert(
        {
          from_addr: row.from.toLowerCase(),
          to_addr: row.to.toLowerCase(),
          tags: row.tags,
          tags_hash: row.tagsHash,
          tx_hash: row.txHash,
          created_at: new Date().toISOString(),
          revoked_at: null,
        },
        { onConflict: "from_addr,to_addr" },
      );
      if (error) throw new Error(`catat vouch gagal: ${error.message}`);
    },

    async markRevoked(from, to) {
      const { error } = await db
        .from("vouches")
        .update({ revoked_at: new Date().toISOString() })
        .eq("from_addr", from.toLowerCase())
        .eq("to_addr", to.toLowerCase());
      if (error) throw new Error(`cabut vouch gagal: ${error.message}`);
    },
  };
}

export function createReportStore(db: SupabaseClient): ReportStore {
  return {
    async recordReport(row) {
      const { error } = await db.from("reports").upsert(
        {
          reporter: row.reporter.toLowerCase(),
          subject: row.subject.toLowerCase(),
          reason: row.reason,
          evidence: row.evidence ?? null,
        },
        { onConflict: "reporter,subject" },
      );
      if (error) throw new Error(`catat laporan gagal: ${error.message}`);
    },

    async listReports(subject) {
      const { data, error } = await db
        .from("reports")
        .select("reporter, subject, created_at")
        .eq("subject", subject.toLowerCase());
      if (error) throw new Error(`baca laporan gagal: ${error.message}`);
      return (data ?? []).map((r) => ({
        reporter: r.reporter as Address,
        subject: r.subject as Address,
        atMs: new Date(r.created_at as string).getTime(),
      }));
    },

    async setReportStatus(subject, status) {
      // Hanya laporan yang MASIH "baru" ikut berubah. Tanpa penjagaan ini,
      // gerbang yang gagal menandai SEMUA laporan untuk subjek ini sebagai
      // "ditolak" — termasuk laporan yang masuk SETELAH admin menekan tombol
      // dan belum sempat ditinjau sama sekali.
      const { error } = await db
        .from("reports")
        .update({ status })
        .eq("subject", subject.toLowerCase())
        .eq("status", "baru");
      if (error) throw new Error(`ubah status laporan gagal: ${error.message}`);
    },

    async recordSlash(subject, txHash) {
      const { error } = await db.from("slashes").upsert(
        { subject: subject.toLowerCase(), tx_hash: txHash, confirmed_at: new Date().toISOString() },
        { onConflict: "subject" },
      );
      if (error) throw new Error(`catat slash gagal: ${error.message}`);
    },
  };
}
