import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address } from "viem";
import { potongKelompok } from "./feed-store";
import type { MeetStore, ProfilRingkas, Tanda } from "./ports";

/**
 * Batas baris eksplisit untuk `tandaOleh`/`tandaKe`.
 *
 * Tanpa ini keduanya bergantung pada `db-max-rows` PostgREST — angka yang
 * tidak terlihat di kode ini dan bisa berubah tanpa satu baris pun ikut
 * berubah di sini. Diamnya itu yang berbahaya: `tandaOleh` yang terpotong
 * MENJATUHKAN kecocokan sungguhan dari `GET /kecocokan`, jadi dua orang yang
 * sudah saling menandai tidak pernah diberi tahu — kegagalan senyap tepat
 * pada janji utama fitur ini.
 *
 * Batasnya dibuat eksplisit supaya keterpotongan bisa DILIHAT, bukan ditebak:
 * kalau jumlah baris yang kembali persis sama dengan batas ini, ada
 * kemungkinan besar masih ada baris lain di belakangnya dan itu dicatat
 * sebagai peringatan. Nilainya jauh di atas jumlah tanda yang masuk akal
 * untuk satu orang, jadi peringatan ini semestinya tidak pernah muncul —
 * kalau muncul, ia menandai bahwa paginasi sungguhan sudah dibutuhkan.
 */
const BATAS_TANDA = 1000;

function peringatkanKalauTerpotong(arah: string, alamat: string, jumlah: number) {
  if (jumlah < BATAS_TANDA) return;
  console.warn(
    `${arah} untuk ${alamat} mencapai batas ${BATAS_TANDA} baris — daftar tanda`
    + " kemungkinan terpotong dan kecocokan bisa hilang. Paginasi dibutuhkan.",
  );
}

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

    /**
     * TIDAK memakai `.not(kolom, "in", …)`: postgrest-js menempelkan SETIAP
     * pemanggilan `.not()`/`.in()` sebagai parameter TAMBAHAN pada URL yang
     * SAMA (lihat `not()` di `@supabase/postgrest-js` — ia menambah ke
     * `this.url.searchParams` lalu mengembalikan `this`), bukan mengirim satu
     * request per potongan. Memotong daftar pengecualian jadi beberapa
     * kelompok lalu memanggil `.not()` sekali per kelompok TETAP menghasilkan
     * SATU URL yang memuat semua kelompok itu sekaligus — 250 alamat blokir
     * masih membangun query string ~11 KB pada setiap pembacaan profil,
     * event, dan kecocokan. Itulah sebabnya versi sebelumnya (`tanpa()`)
     * salah: ia memotong PARAMETER, bukan REQUEST, dan URL yang genuinely
     * pendek hanya didapat kalau setiap kelompok jadi request HTTP-nya
     * sendiri.
     *
     * Jadi: SATU request tanpa filter pengecualian sama sekali untuk
     * menghitung total, lalu SATU request TERPISAH per kelompok
     * `potongKelompok` (maksimal UKURAN_KELOMPOK alamat per `.in()`,
     * dijalankan paralel) untuk menghitung berapa dari total itu yang
     * datang dari alamat terblokir — dikurangkan di JS. Ini benar karena
     * primary key `ingin_bertemu` adalah `(target, who)`
     * (`supabase/migrations/0005_meet.sql`): baris untuk `target` yang sama
     * dan `who` tertentu hanya ADA SEKALI, jadi kelompok `who` yang saling
     * lepas (potongKelompok tidak pernah menaruh alamat yang sama di dua
     * kelompok) tidak pernah dihitung dua kali dan pengurangannya tidak
     * pernah salah.
     */
    async hitungTanda(target, kecuali) {
      const t = target.toLowerCase();
      const { count, error } = await db.from("ingin_bertemu")
        .select("*", { count: "exact", head: true })
        .eq("target", t);
      if (error) throw new Error(`hitung tanda gagal: ${error.message}`);
      const total = count ?? 0;

      const unik = [...new Set(kecuali.map((a) => a.toLowerCase()))];
      if (unik.length === 0) return total;

      const perKelompok = await Promise.all(potongKelompok(unik).map(async (bagian) => {
        const { count: c, error: e } = await db.from("ingin_bertemu")
          .select("*", { count: "exact", head: true })
          .eq("target", t).in("who", bagian);
        // Kelompok yang gagal HARUS melempar, bukan dianggap nol — kalau
        // tidak, kegagalan satu kelompok akan membuat pengurangan terlalu
        // kecil dan angka publik jadi lebih besar dari yang sebenarnya
        // (tanda dari orang terblokir ikut kehitung).
        if (e) throw new Error(`hitung tanda terkecuali gagal: ${e.message}`);
        return c ?? 0;
      }));
      const dikecualikan = perKelompok.reduce((a, b) => a + b, 0);
      // Math.max sebagai jaring pengaman murni — secara matematis tidak
      // pernah negatif berkat PK (target, who) di atas — bukan celah yang
      // sengaja dibiarkan.
      return Math.max(0, total - dikecualikan);
    },

    /**
     * TIDAK menyaring lewat query: kalau `who` sendiri sudah ada di
     * `kecuali`, jawabannya PASTI false tanpa perlu bertanya ke database
     * sama sekali — baris (kalaupun ada) datang dari salah satu pihak yang
     * sedang terblokir. Query sungguhan hanya dijalankan saat itu TIDAK
     * terjadi, jadi tidak ada `.in()`/`.not()` yang perlu dipotong di sini.
     */
    async adaTanda(target, who, kecuali) {
      const kecualiSet = new Set(kecuali.map((a) => a.toLowerCase()));
      if (kecualiSet.has(who.toLowerCase())) return false;

      const { data, error } = await db.from("ingin_bertemu")
        .select("target")
        .eq("target", target.toLowerCase()).eq("who", who.toLowerCase())
        .maybeSingle();
      if (error) throw new Error(`baca tanda gagal: ${error.message}`);
      return data !== null;
    },

    /**
     * Pengecualian disaring DI JS setelah baris kembali, bukan lewat
     * `.not()`/`.in()` di kuerinya — itu yang membuat URL-nya tidak pernah
     * membengkak seiring panjangnya daftar blokir. Ini aman karena
     * pembacaan sudah dibatasi `BATAS_TANDA` di atas: menyaring array yang
     * sudah dipotong di memori TIDAK PERNAH lebih mahal daripada memotong
     * kuerinya sendiri, dan peringatan keterpotongan tetap dihitung dari
     * jumlah baris MENTAH (sebelum disaring) karena itulah yang mengukur
     * apakah `BATAS_TANDA` sendiri sudah kena, bukan efek penyaringan blokir.
     */
    async tandaOleh(who, kecuali) {
      const { data, error } = await db.from("ingin_bertemu")
        .select("target, who, created_at").eq("who", who.toLowerCase())
        .limit(BATAS_TANDA);
      if (error) throw new Error(`baca tanda keluar gagal: ${error.message}`);
      const baris = data ?? [];
      peringatkanKalauTerpotong("tandaOleh", who.toLowerCase(), baris.length);
      const kecualiSet = new Set(kecuali.map((a) => a.toLowerCase()));
      return baris
        .filter((r) => !kecualiSet.has((r as TandaDbRow).target.toLowerCase()))
        .map((r) => rowToTanda(r as TandaDbRow, "target"));
    },

    /** Cermin dari `tandaOleh`: menyaring kolom `who` di JS, alasan sama. */
    async tandaKe(target, kecuali) {
      const { data, error } = await db.from("ingin_bertemu")
        .select("target, who, created_at").eq("target", target.toLowerCase())
        .limit(BATAS_TANDA);
      if (error) throw new Error(`baca tanda masuk gagal: ${error.message}`);
      const baris = data ?? [];
      peringatkanKalauTerpotong("tandaKe", target.toLowerCase(), baris.length);
      const kecualiSet = new Set(kecuali.map((a) => a.toLowerCase()));
      return baris
        .filter((r) => !kecualiSet.has((r as TandaDbRow).who.toLowerCase()))
        .map((r) => rowToTanda(r as TandaDbRow, "who"));
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
  };
}
