import type { SupabaseClient } from "@supabase/supabase-js";
import type { Visibilitas } from "@nearly/shared";
import { potongKelompok } from "./feed-store";
import type { ProfilSayaStore } from "./ports";

const kecil = (a: string) => a.toLowerCase();

/**
 * Hanya nilai persis `tersembunyi` yang menyembunyikan. Kolom punya CHECK dua
 * nilai (0008), jadi nilai lain tidak pernah datang dari basis data; baris yang
 * tidak ada berarti default kolom, `terlihat` (keputusan #2).
 */
export function keVisibilitas(nilai: unknown): Visibilitas {
  return nilai === "tersembunyi" ? "tersembunyi" : "terlihat";
}

export function createProfilSayaStore(db: SupabaseClient): ProfilSayaStore {
  return {
    async profilSaya(address) {
      const { data, error } = await db.from("profiles").select("display_name, visibilitas")
        .eq("address", kecil(address)).maybeSingle();
      if (error) throw new Error(`baca profil saya gagal: ${error.message}`);
      const d = data as { display_name: string | null; visibilitas: string | null } | null;
      return { displayName: d?.display_name ?? "", visibilitas: keVisibilitas(d?.visibilitas) };
    },

    async aturProfil(address, profil) {
      // Upsert: orang yang belum pernah salaman belum punya baris profiles.
      // Kolom lain (pfp_url, cocok_dilihat_at) tidak disebut, jadi tidak disentuh.
      const { error } = await db.from("profiles").upsert({
        address: kecil(address), display_name: profil.displayName, visibilitas: profil.visibilitas,
      }, { onConflict: "address" });
      if (error) throw new Error(`atur profil gagal: ${error.message}`);
    },

    async visibilitasBanyak(addresses) {
      const unik = [...new Set(addresses.map(kecil))];
      const keluar = new Map<string, Visibilitas>(unik.map((a) => [a, "terlihat"]));
      // Dipotong per kelompok 100 — `.in()` dengan ratusan nilai ditolak proksi
      // Supabase (Fase 3b).
      const hasil = await Promise.all(potongKelompok(unik).map(async (bagian) => {
        const { data, error } = await db.from("profiles").select("address, visibilitas").in("address", bagian);
        if (error) throw new Error(`baca visibilitas gagal: ${error.message}`);
        return (data ?? []) as { address: string; visibilitas: string }[];
      }));
      for (const r of hasil.flat()) keluar.set(kecil(r.address), keVisibilitas(r.visibilitas));
      return keluar;
    },
  };
}
