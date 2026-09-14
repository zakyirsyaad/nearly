import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hex } from "viem";
import type { HandshakeStore, PendingOffer, ProfileStore } from "./ports";

/** Urutan kanonik: selalu [min, max] dalam huruf kecil (constraint addr_a < addr_b). */
export function orderPair(a: Address, b: Address): [Address, Address] {
  const x = a.toLowerCase() as Address;
  const y = b.toLowerCase() as Address;
  return x < y ? [x, y] : [y, x];
}

type OfferRow = {
  nonce: string; initiator: string; expires_at: string | number;
  sig_offer: string;
  /** null setelah `sapuLokasi` mengosongkannya (migrasi 0008, spec 4b+5 §4.4). */
  cell: string | null;
  at_ms: string | number; consumed_at: string | null;
};

export function rowToOffer(row: OfferRow): PendingOffer {
  return {
    nonce: row.nonce as Hex,
    initiator: row.initiator as Address,
    expiresAt: BigInt(row.expires_at),
    sigOffer: row.sig_offer as Hex,
    // Sel yang sudah disapu menjadi string kosong. Gerbang tidak diubah: offer
    // bersel kosong pasti sudah kedaluwarsa > 24 jam dan ditolak lebih dulu.
    cell: row.cell ?? "",
    atMs: Number(row.at_ms),
    consumed: row.consumed_at !== null,
  };
}

export function createSupabase(url: string, serviceRoleKey: string): SupabaseClient {
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

export function createStore(db: SupabaseClient): HandshakeStore {
  async function ensureProfile(address: Address): Promise<void> {
    const { error } = await db
      .from("profiles")
      .upsert({ address: address.toLowerCase() }, { onConflict: "address", ignoreDuplicates: true });
    if (error) throw new Error(`upsert profile gagal: ${error.message}`);
  }

  return {
    async putOffer(offer) {
      await ensureProfile(offer.initiator);
      const { error } = await db.from("handshake_offers").insert({
        nonce: offer.nonce.toLowerCase(),
        initiator: offer.initiator.toLowerCase(),
        expires_at: offer.expiresAt.toString(),
        sig_offer: offer.sigOffer,
        cell: offer.cell,
        at_ms: offer.atMs,
      });
      if (error) throw new Error(`insert offer gagal: ${error.message}`);
    },

    async getOffer(nonce) {
      const { data, error } = await db
        .from("handshake_offers")
        .select("nonce, initiator, expires_at, sig_offer, cell, at_ms, consumed_at")
        .eq("nonce", nonce.toLowerCase())
        .maybeSingle();
      if (error) throw new Error(`baca offer gagal: ${error.message}`);
      return data ? rowToOffer(data as OfferRow) : null;
    },

    async consumeOffer(nonce) {
      const { error } = await db
        .from("handshake_offers")
        .update({ consumed_at: new Date().toISOString() })
        .eq("nonce", nonce.toLowerCase())
        .is("consumed_at", null);
      if (error) throw new Error(`tandai offer terpakai gagal: ${error.message}`);
    },

    async areConnected(a, b) {
      const [x, y] = orderPair(a, b);
      const { count, error } = await db
        .from("connections")
        .select("id", { count: "exact", head: true })
        .eq("addr_a", x)
        .eq("addr_b", y);
      if (error) throw new Error(`cek koneksi gagal: ${error.message}`);
      return (count ?? 0) > 0;
    },

    async countConnectionsSince(addr, sinceMs) {
      const lower = addr.toLowerCase();
      const since = new Date(sinceMs).toISOString();
      const { count, error } = await db
        .from("connections")
        .select("id", { count: "exact", head: true })
        .or(`addr_a.eq.${lower},addr_b.eq.${lower}`)
        .gte("created_at", since);
      if (error) throw new Error(`hitung kuota gagal: ${error.message}`);
      return count ?? 0;
    },

    async recordConnection(row) {
      await ensureProfile(row.b);
      const [x, y] = orderPair(row.a, row.b);
      const { error } = await db.from("connections").insert({
        addr_a: x, addr_b: y,
        nonce: row.nonce.toLowerCase(),
        tx_hash: row.txHash,
        created_at: new Date(row.atMs).toISOString(),
        cell: row.cell,
      });
      if (error) throw new Error(`catat koneksi gagal: ${error.message}`);
    },
  };
}

export function createProfileStore(db: SupabaseClient): ProfileStore {
  return {
    async listConnections(addr, limit) {
      const lower = addr.toLowerCase();
      const { data, error } = await db
        .from("connections")
        .select("addr_a, addr_b, tx_hash, created_at")
        .or(`addr_a.eq.${lower},addr_b.eq.${lower}`)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`baca koneksi gagal: ${error.message}`);

      return (data ?? []).map((r) => ({
        address: (r.addr_a === lower ? r.addr_b : r.addr_a) as Address,
        txHash: r.tx_hash as Hex,
        at: new Date(r.created_at as string).getTime(),
      }));
    },

    async countConnections(addr) {
      const lower = addr.toLowerCase();
      const { count, error } = await db
        .from("connections")
        .select("id", { count: "exact", head: true })
        .or(`addr_a.eq.${lower},addr_b.eq.${lower}`);
      if (error) throw new Error(`hitung koneksi gagal: ${error.message}`);
      return count ?? 0;
    },

    async getDisplayName(addr) {
      const { data } = await db
        .from("profiles")
        .select("display_name")
        .eq("address", addr.toLowerCase())
        .maybeSingle();
      return (data?.display_name as string | undefined) ?? "";
    },
  };
}
