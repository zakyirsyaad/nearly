import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address } from "viem";
import type { TrustResult } from "@nearly/trust";
import type { ReportStore, TrustStore, VouchStore } from "../ports";
import { rowsToGraph } from "./load-graph";

type Res<T> = { data: T | null; error: { message: string } | null };

function unwrap<T>(res: Res<T[]>, what: string): T[] {
  if (res.error) throw new Error(`${what} gagal: ${res.error.message}`);
  return res.data ?? [];
}

export function createTrustStore(db: SupabaseClient): TrustStore {
  return {
    async loadGraph(nowMs) {
      const [connections, vouches, seeds, slashes] = await Promise.all([
        db.from("connections").select("addr_a, addr_b, cell, created_at"),
        db.from("vouches").select("from_addr, to_addr, created_at, revoked_at"),
        db.from("trust_seeds").select("address, weight"),
        db.from("slashes").select("subject"),
      ]);
      return rowsToGraph(
        {
          connections: unwrap(connections as never, "baca koneksi"),
          vouches: unwrap(vouches as never, "baca vouch"),
          seeds: unwrap(seeds as never, "baca seed"),
          slashes: unwrap(slashes as never, "baca slash"),
        },
        nowMs,
      );
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
      const { error } = await db
        .from("reports")
        .update({ status })
        .eq("subject", subject.toLowerCase());
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
