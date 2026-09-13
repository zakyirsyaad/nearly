import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address } from "viem";
import type { BarisBlokir, BlokirStore } from "./ports";
import { fetchAllPages } from "./trust/store";

type BarisDb = { blocker: string; blocked: string; created_at: string };

/**
 * SETIAP pembaca daftar/himpunan di sini berhalaman, dengan urutan total yang
 * stabil. PostgREST memotong select di 1000 baris TANPA galat dan dalam
 * urutan arbitrer — dan tabel ini bisa DIBANJIRI dari luar: siapa pun bisa
 * membuat 1000 kunci sekali pakai yang semuanya memblokir korban V. Dengan
 * select polos, blokir V terhadap penyerang bisa terlempar dari himpunan V,
 * dan unggahan penyerang muncul lagi di feed V tanpa satu galat pun.
 *
 * `(blocker, blocked)` adalah primary key, jadi urutan dua kolom itu total:
 * batas halaman tidak bisa melewatkan atau menggandakan baris.
 */

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
      // Terbaru dulu, dengan `blocked` sebagai pemecah seri: dua blokir dalam
      // satu transaksi berbagi `created_at`, dan tanpa pemecah seri urutannya
      // tidak total sehingga baris bisa melompati batas halaman. `blocker`
      // tetap satu nilai di sini, jadi (created_at, blocked) sudah unik.
      const baris = await fetchAllPages<Pick<BarisDb, "blocked" | "created_at">>(
        (f, t) => db.from("blocks").select("blocked, created_at")
          .eq("blocker", who.toLowerCase())
          .order("created_at", { ascending: false })
          .order("blocked", { ascending: true })
          .range(f, t) as never,
        "baca daftar blokir",
      );
      return baris
        .map((r): BarisBlokir => ({
          address: r.blocked as Address,
          atMs: Date.parse(r.created_at),
        }));
    },

    async himpunanUntuk(who) {
      const a = who.toLowerCase();
      // KEDUA arah. Blokir dua arah tidak peduli siapa yang memulai; membaca
      // satu arah saja membuat orang yang memblokirmu tetap muncul di feedmu.
      const baris = await fetchAllPages<Pick<BarisDb, "blocker" | "blocked">>(
        (f, t) => db.from("blocks").select("blocker, blocked")
          .or(`blocker.eq.${a},blocked.eq.${a}`)
          .order("blocker", { ascending: true }).order("blocked", { ascending: true })
          .range(f, t) as never,
        "baca himpunan blokir",
      );

      const keluar = new Set<string>();
      for (const r of baris) {
        const lain = r.blocker.toLowerCase() === a ? r.blocked.toLowerCase() : r.blocker.toLowerCase();
        // Alamat sendiri tidak pernah masuk. CHECK basis data sudah membuat
        // baris blocker = blocked mustahil, tapi penjaga ini gratis dan
        // menahan akibat terburuknya: penonton menyaring unggahannya sendiri.
        if (lain !== a) keluar.add(lain);
      }
      return keluar;
    },

    async pemblokirUntuk(who) {
      const a = who.toLowerCase();
      // SATU arah, dengan sengaja: hanya yang MEMBLOKIR `who`. Dipakai angka
      // publik dan `penandaHadir` (spec §5.2) — kalau arah sebaliknya ikut,
      // tindakan blokir `who` sendiri menggerakkan angkanya sendiri, dan
      // selisih angka sebelum/sesudah memblokir memberi tahu siapa yang
      // diam-diam menandainya.
      const baris = await fetchAllPages<Pick<BarisDb, "blocker">>(
        (f, t) => db.from("blocks").select("blocker")
          .eq("blocked", a)
          .order("blocker", { ascending: true }).order("blocked", { ascending: true })
          .range(f, t) as never,
        "baca pemblokir",
      );

      const keluar = new Set<string>();
      for (const r of baris) {
        const lain = r.blocker.toLowerCase();
        if (lain !== a) keluar.add(lain);
      }
      return keluar;
    },
  };
}
