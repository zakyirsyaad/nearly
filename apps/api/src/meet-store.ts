import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address } from "viem";
import { potongKelompok } from "./feed-store";
import type { MeetStore, ProfilRingkas, Tanda } from "./ports";

export type TandaDbRow = {
  target: string;
  who: string;
  created_at: string;
};

/**
 * Satu baris dibaca dari DUA arah. Saat mencari "siapa yang kutandai" yang
 * menarik adalah kolom `target`; saat mencari "siapa yang menandaiku" yang
 * menarik adalah `who`. Satu pemeta, dua sisi.
 */
export function rowToTanda(row: TandaDbRow, sisi: "target" | "who"): Tanda {
  return {
    address: row[sisi] as Address,
    atMs: Date.parse(row.created_at),
  };
}

export function createMeetStore(db: SupabaseClient): MeetStore {
  async function ensureProfile(address: Address): Promise<void> {
    const { error } = await db
      .from("profiles")
      .upsert({ address: address.toLowerCase() }, { onConflict: "address", ignoreDuplicates: true });
    if (error) throw new Error(`upsert profile gagal: ${error.message}`);
  }

  return {
    async setTanda(target, who, ingin) {
      if (!ingin) {
        const { error } = await db.from("ingin_bertemu").delete()
          .eq("target", target.toLowerCase()).eq("who", who.toLowerCase());
        if (error) throw new Error(`cabut tanda gagal: ${error.message}`);
        return;
      }

      // KEDUA alamat adalah foreign key ke profiles(address). Menandai orang
      // yang belum pernah handshake adalah kasus PALING UMUM di fitur ini —
      // itulah gunanya penanda ini — jadi keduanya wajib dipastikan ada.
      await Promise.all([ensureProfile(target), ensureProfile(who)]);

      const { error } = await db.from("ingin_bertemu").upsert(
        { target: target.toLowerCase(), who: who.toLowerCase() },
        { onConflict: "target,who", ignoreDuplicates: true },
      );
      if (error) throw new Error(`tandai gagal: ${error.message}`);
    },

    async hitungTanda(target) {
      const { count, error } = await db.from("ingin_bertemu")
        .select("*", { count: "exact", head: true })
        .eq("target", target.toLowerCase());
      if (error) throw new Error(`hitung tanda gagal: ${error.message}`);
      return count ?? 0;
    },

    async adaTanda(target, who) {
      const { data, error } = await db.from("ingin_bertemu")
        .select("target")
        .eq("target", target.toLowerCase()).eq("who", who.toLowerCase())
        .maybeSingle();
      if (error) throw new Error(`baca tanda gagal: ${error.message}`);
      return data !== null;
    },

    async tandaOleh(who) {
      const { data, error } = await db.from("ingin_bertemu")
        .select("target, who, created_at").eq("who", who.toLowerCase());
      if (error) throw new Error(`baca tanda keluar gagal: ${error.message}`);
      return (data ?? []).map((r) => rowToTanda(r as TandaDbRow, "target"));
    },

    async tandaKe(target) {
      const { data, error } = await db.from("ingin_bertemu")
        .select("target, who, created_at").eq("target", target.toLowerCase());
      if (error) throw new Error(`baca tanda masuk gagal: ${error.message}`);
      return (data ?? []).map((r) => rowToTanda(r as TandaDbRow, "who"));
    },

    async cocokDilihatAtMs(who) {
      const { data, error } = await db.from("profiles")
        .select("cocok_dilihat_at").eq("address", who.toLowerCase()).maybeSingle();
      if (error) throw new Error(`baca cocok_dilihat_at gagal: ${error.message}`);
      const nilai = (data as { cocok_dilihat_at: string | null } | null)?.cocok_dilihat_at;
      return nilai ? Date.parse(nilai) : null;
    },

    async setCocokDilihat(who, atMs) {
      await ensureProfile(who);
      const { error } = await db.from("profiles")
        .update({ cocok_dilihat_at: new Date(atMs).toISOString() })
        .eq("address", who.toLowerCase());
      if (error) throw new Error(`set cocok_dilihat_at gagal: ${error.message}`);
    },

    /**
     * Dipotong per kelompok 100. Fase 3b menemukan bahwa `.in()` dengan
     * ratusan nilai menghasilkan query string puluhan KB yang ditolak proksi
     * Supabase — mati total, dan hanya setelah datanya menumpuk.
     */
    async profilRingkas(addresses) {
      const unik = [...new Set(addresses.map((a) => a.toLowerCase()))];
      if (unik.length === 0) return new Map();

      const kelompok = potongKelompok(unik);
      const hasil = await Promise.all(kelompok.map((bagian) => Promise.all([
        db.from("profiles").select("address, display_name").in("address", bagian),
        db.from("trust_snapshots").select("address, tier").in("address", bagian),
      ])));

      const nama = new Map<string, string>();
      const tier = new Map<string, number>();
      for (const [p, t] of hasil) {
        if (p.error) throw new Error(`baca profil gagal: ${p.error.message}`);
        if (t.error) throw new Error(`baca tier gagal: ${t.error.message}`);
        for (const r of (p.data ?? []) as { address: string; display_name: string }[]) {
          nama.set(r.address.toLowerCase(), r.display_name);
        }
        for (const r of (t.data ?? []) as { address: string; tier: number }[]) {
          tier.set(r.address.toLowerCase(), r.tier);
        }
      }

      const keluar = new Map<string, ProfilRingkas>();
      for (const a of unik) {
        keluar.set(a, { displayName: nama.get(a) ?? "", tier: tier.get(a) ?? 0 });
      }
      return keluar;
    },

    /**
     * Sama seperti profilRingkas: dipotong per kelompok, bukan satu `.in()`
     * dengan seluruh daftar target sekaligus.
     */
    async hitungTandaBanyak(targets) {
      const unik = [...new Set(targets.map((a) => a.toLowerCase()))];
      if (unik.length === 0) return new Map();

      const kelompok = potongKelompok(unik);
      const hasil = await Promise.all(kelompok.map((bagian) =>
        db.from("ingin_bertemu").select("target").in("target", bagian)));

      const keluar = new Map<string, number>();
      for (const a of unik) keluar.set(a, 0);
      for (const r of hasil) {
        if (r.error) throw new Error(`hitung tanda banyak gagal: ${r.error.message}`);
        for (const baris of (r.data ?? []) as { target: string }[]) {
          const t = baris.target.toLowerCase();
          keluar.set(t, (keluar.get(t) ?? 0) + 1);
        }
      }
      return keluar;
    },
  };
}
