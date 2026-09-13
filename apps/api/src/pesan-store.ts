import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hex } from "viem";
import type { BarisPesan, PesanStore } from "./ports";
import { potongKelompok } from "./feed-store";
import { fetchAllPages } from "./trust/store";

export type BarisDb = {
  id: string;
  pengirim: string;
  penerima: string;
  ciphertext: string;
  nonce: string;
  created_at: string;
  dibaca_at: string | null;
};

const KOLOM = "id, pengirim, penerima, ciphertext, nonce, created_at, dibaca_at";
const kecil = (a: string) => a.toLowerCase();
const iso = (ms: number) => new Date(ms).toISOString();

export function rowToPesan(r: BarisDb): BarisPesan {
  return {
    id: r.id,
    pengirim: r.pengirim as Address,
    penerima: r.penerima as Address,
    ciphertext: r.ciphertext,
    nonce: r.nonce as Hex,
    createdAtMs: Date.parse(r.created_at),
    dibacaAtMs: r.dibaca_at ? Date.parse(r.dibaca_at) : null,
  };
}

export function createPesanStore(db: SupabaseClient): PesanStore {
  return {
    async simpanKunci(address, kunci) {
      const { error } = await db.from("kunci_pesan").upsert({
        address: kecil(address),
        kunci_enkripsi: kecil(kunci.kunciEnkripsi),
        kunci_tanda: kecil(kunci.kunciTanda),
        updated_at: new Date().toISOString(),
      }, { onConflict: "address" });
      if (error) throw new Error(`simpan kunci pesan gagal: ${error.message}`);
    },

    async ambilKunci(address) {
      const { data, error } = await db.from("kunci_pesan")
        .select("kunci_enkripsi, kunci_tanda").eq("address", kecil(address)).maybeSingle();
      if (error) throw new Error(`baca kunci pesan gagal: ${error.message}`);
      if (!data) return null;
      const d = data as { kunci_enkripsi: string; kunci_tanda: string };
      return { kunciEnkripsi: d.kunci_enkripsi as Hex, kunciTanda: d.kunci_tanda as Hex };
    },

    async simpanPesan(row) {
      const { error } = await db.from("pesan").insert({
        id: kecil(row.id),
        pengirim: kecil(row.pengirim),
        penerima: kecil(row.penerima),
        ciphertext: row.ciphertext,
        nonce: kecil(row.nonce),
      });
      // 23505 = unique_violation. `id` dibuat HP; yang sama berarti kirim ulang.
      if (error && (error as { code?: string }).code === "23505") return "sudah_ada";
      if (error) throw new Error(`simpan pesan gagal: ${error.message}`);
      return "baru";
    },

    async hitungTerkirimSejak(pengirim, sejakMs) {
      const { count, error } = await db.from("pesan")
        .select("id", { count: "exact", head: true })
        .eq("pengirim", kecil(pengirim)).gte("created_at", iso(sejakMs));
      if (error) throw new Error(`hitung pesan terkirim gagal: ${error.message}`);
      return count ?? 0;
    },

    async pesanTerbaruUntuk(who, batas) {
      const a = kecil(who);
      const { data, error } = await db.from("pesan").select(KOLOM)
        .or(`pengirim.eq.${a},penerima.eq.${a}`)
        .order("created_at", { ascending: false }).limit(batas);
      if (error) throw new Error(`baca pesan terbaru gagal: ${error.message}`);
      return ((data ?? []) as BarisDb[]).map(rowToPesan);
    },

    async belumDibacaPerPengirim(penerima) {
      // Berhalaman penuh: select polos terpotong 1000 baris tanpa galat
      // (trust/store.ts), dan lencana belum-dibaca yang diam-diam salah lebih
      // buruk daripada kueri yang sedikit lebih mahal.
      const baris = await fetchAllPages<{ pengirim: string }>(
        (f, t) => db.from("pesan").select("pengirim, created_at, id")
          .eq("penerima", kecil(penerima)).is("dibaca_at", null)
          .order("created_at", { ascending: true }).order("id", { ascending: true })
          .range(f, t) as never,
        "baca pesan belum dibaca",
      );
      const peta = new Map<string, number>();
      for (const r of baris) peta.set(kecil(r.pengirim), (peta.get(kecil(r.pengirim)) ?? 0) + 1);
      return peta;
    },

    async riwayat(a, b, sebelumMs, batas) {
      const x = kecil(a);
      const y = kecil(b);
      let q = db.from("pesan").select(KOLOM)
        .or(`and(pengirim.eq.${x},penerima.eq.${y}),and(pengirim.eq.${y},penerima.eq.${x})`);
      if (sebelumMs !== null) q = q.lt("created_at", iso(sebelumMs));
      const { data, error } = await q.order("created_at", { ascending: false }).limit(batas);
      if (error) throw new Error(`baca riwayat pesan gagal: ${error.message}`);
      return ((data ?? []) as BarisDb[]).map(rowToPesan);
    },

    async tandaiDibaca(penerima, pengirim, sampaiMs) {
      // `lt(sampaiMs + 1)`, BUKAN `lte(sampaiMs)`: created_at menyimpan
      // mikrodetik, dan `lte` dengan milidetik mengecualikan pesan terakhir.
      const { error } = await db.from("pesan")
        .update({ dibaca_at: new Date().toISOString() })
        .eq("penerima", kecil(penerima)).eq("pengirim", kecil(pengirim))
        .is("dibaca_at", null).lt("created_at", iso(sampaiMs + 1));
      if (error) throw new Error(`tandai dibaca gagal: ${error.message}`);
    },

    async adaBelumDibacaLainDari(penerima, pengirim, kecualiId) {
      const { count, error } = await db.from("pesan")
        .select("id", { count: "exact", head: true })
        .eq("penerima", kecil(penerima)).eq("pengirim", kecil(pengirim))
        .is("dibaca_at", null).neq("id", kecil(kecualiId));
      if (error) throw new Error(`cek belum dibaca gagal: ${error.message}`);
      return (count ?? 0) > 0;
    },

    async simpanTokenPush(address, token) {
      // Satu HP berganti dompet: tanpa ini, notifikasi dompet lama terus sampai
      // ke pemakai HP yang baru.
      const { error: e1 } = await db.from("token_push").delete()
        .eq("token", token).neq("address", kecil(address));
      if (e1) throw new Error(`cabut token push lama gagal: ${e1.message}`);
      const { error: e2 } = await db.from("token_push").upsert(
        { address: kecil(address), token },
        { onConflict: "address,token", ignoreDuplicates: true },
      );
      if (e2) throw new Error(`simpan token push gagal: ${e2.message}`);
    },

    async tokenPush(address) {
      const { data, error } = await db.from("token_push").select("token").eq("address", kecil(address));
      if (error) throw new Error(`baca token push gagal: ${error.message}`);
      return ((data ?? []) as { token: string }[]).map((r) => r.token);
    },

    async hapusTokenPush(tokens) {
      if (tokens.length === 0) return;
      for (const bagian of potongKelompok([...new Set(tokens)])) {
        const { error } = await db.from("token_push").delete().in("token", bagian);
        if (error) throw new Error(`hapus token push gagal: ${error.message}`);
      }
    },

    async pesanBerdasarkanId(ids) {
      const unik = [...new Set(ids.map(kecil))];
      const keluar: BarisPesan[] = [];
      for (const bagian of potongKelompok(unik)) {
        const { data, error } = await db.from("pesan").select(KOLOM).in("id", bagian);
        if (error) throw new Error(`baca pesan bukti gagal: ${error.message}`);
        keluar.push(...((data ?? []) as BarisDb[]).map(rowToPesan));
      }
      return keluar;
    },

    async gantiBuktiLaporan(laporanId, bukti) {
      const { error: e1 } = await db.from("bukti_laporan_pesan").delete().eq("laporan_id", laporanId);
      if (e1) throw new Error(`hapus bukti lama gagal: ${e1.message}`);
      if (bukti.length === 0) return;
      const { error: e2 } = await db.from("bukti_laporan_pesan").insert(bukti.map((b) => ({
        laporan_id: laporanId,
        pesan_id: kecil(b.pesanId),
        isi: b.isi,
        dikirim_ms: b.dikirimMs,
        tanda: kecil(b.tanda),
        kunci_tanda: kecil(b.kunciTanda),
      })));
      if (e2) throw new Error(`simpan bukti laporan gagal: ${e2.message}`);
    },
  };
}
