import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address } from "viem";
import type { BarisBlokir, BlokirStore } from "./ports";

type BarisDb = { blocker: string; blocked: string; created_at: string };

export function createBlokirStore(db: SupabaseClient): BlokirStore {
  return {
    async setBlokir(blocker, blocked, blokir) {
      const b = blocker.toLowerCase();
      const t = blocked.toLowerCase();

      if (!blokir) {
        // Mencabut MENGHAPUS barisnya, bukan menulis bendera. Tanpa baris,
        // tidak ada keadaan "pernah diblokir" yang bisa membusuk — dan tanda
        // "ingin bertemu" yang tertekan kembali dihitung dengan sendirinya
        // karena penyaringnya membaca tabel ini (spec §5.2).
        const { error } = await db.from("blocks").delete()
          .eq("blocker", b).eq("blocked", t);
        if (error) throw new Error(`cabut blokir gagal: ${error.message}`);
        return;
      }

      const { error } = await db.from("blocks")
        .upsert({ blocker: b, blocked: t }, { onConflict: "blocker,blocked", ignoreDuplicates: true });
      if (error) throw new Error(`pasang blokir gagal: ${error.message}`);
    },

    async adaBlokir(blocker, blocked) {
      const { data, error } = await db.from("blocks").select("blocker")
        .eq("blocker", blocker.toLowerCase()).eq("blocked", blocked.toLowerCase());
      if (error) throw new Error(`baca blokir gagal: ${error.message}`);
      return (data ?? []).length > 0;
    },

    async diblokirOleh(who) {
      const { data, error } = await db.from("blocks").select("blocked, created_at")
        .eq("blocker", who.toLowerCase())
        .order("created_at", { ascending: false });
      if (error) throw new Error(`baca daftar blokir gagal: ${error.message}`);
      return ((data ?? []) as Pick<BarisDb, "blocked" | "created_at">[])
        .map((r): BarisBlokir => ({
          address: r.blocked as Address,
          atMs: Date.parse(r.created_at),
        }));
    },

    async himpunanUntuk(who) {
      const a = who.toLowerCase();
      // KEDUA arah. Blokir dua arah tidak peduli siapa yang memulai; membaca
      // satu arah saja membuat orang yang memblokirmu tetap muncul di feedmu.
      const { data, error } = await db.from("blocks").select("blocker, blocked")
        .or(`blocker.eq.${a},blocked.eq.${a}`);
      if (error) throw new Error(`baca himpunan blokir gagal: ${error.message}`);

      const keluar = new Set<string>();
      for (const r of (data ?? []) as Pick<BarisDb, "blocker" | "blocked">[]) {
        const lain = r.blocker.toLowerCase() === a ? r.blocked.toLowerCase() : r.blocker.toLowerCase();
        // Alamat sendiri tidak pernah masuk. CHECK basis data sudah membuat
        // baris blocker = blocked mustahil, tapi penjaga ini gratis dan
        // menahan akibat terburuknya: penonton menyaring unggahannya sendiri.
        if (lain !== a) keluar.add(lain);
      }
      return keluar;
    },
  };
}
