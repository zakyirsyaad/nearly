import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hex } from "viem";
import type { FeedCandidate, FeedStore, ImageStatus, PostRecord } from "./ports";

export type PostDbRow = {
  post_id: string;
  author: string;
  body: string;
  image_bucket: string | null;
  image_object: string | null;
  image_mime: string | null;
  image_status: string;
  created_at: string;
  deleted_at: string | null;
};

const KOLOM_POST =
  "post_id, author, body, image_bucket, image_object, image_mime, image_status, created_at, deleted_at";

export function rowToPost(row: PostDbRow): PostRecord {
  return {
    postId: row.post_id as Hex,
    author: row.author as Address,
    body: row.body,
    imageBucket: row.image_bucket,
    imageObject: row.image_object,
    imageMime: row.image_mime,
    imageStatus: row.image_status as ImageStatus,
    createdAtMs: Date.parse(row.created_at),
    deleted: row.deleted_at !== null,
  };
}

type Tepi = { addr_a: string; addr_b: string };

/**
 * Jarak graf penonton (spec §6.4). Murni, supaya bisa diuji tanpa database.
 *
 * Dihitung dari DUA himpunan tepi yang sudah diambil lebih dulu — bukan satu
 * kueri per unggahan. Feed dimuat jauh lebih sering daripada discovery, dan
 * pola N+1 di sini akan jauh lebih mahal daripada yang diparkir di Fase 3a.
 *
 * Kolom `blocked` TIDAK ADA di tabel connections; blokir baru datang di Fase 4
 * (spec §6.4). Setiap koneksi dihitung sebagai lompatan.
 */
export function petaHop(viewer: Address, tepi1: Tepi[], tepi2: Tepi[]): Map<string, 1 | 2> {
  const aku = viewer.toLowerCase();
  const peta = new Map<string, 1 | 2>();

  const seberang = (t: Tepi, dari: Set<string>): string | null => {
    const a = t.addr_a.toLowerCase();
    const b = t.addr_b.toLowerCase();
    if (dari.has(a)) return b;
    if (dari.has(b)) return a;
    return null;
  };

  const satu = new Set<string>();
  for (const t of tepi1) {
    const lain = seberang(t, new Set([aku]));
    if (lain && lain !== aku) satu.add(lain);
  }
  for (const a of satu) peta.set(a, 1);

  for (const t of tepi2) {
    const lain = seberang(t, satu);
    // 1 lompatan menang atas 2 — yang lebih dekat yang berlaku.
    if (lain && lain !== aku && !peta.has(lain)) peta.set(lain, 2);
  }

  return peta;
}

export function createFeedStore(db: SupabaseClient): FeedStore {
  async function ensureProfile(address: Address): Promise<void> {
    const { error } = await db
      .from("profiles")
      .upsert({ address: address.toLowerCase() }, { onConflict: "address", ignoreDuplicates: true });
    if (error) throw new Error(`upsert profile gagal: ${error.message}`);
  }

  return {
    async createPost(row) {
      // posts.author adalah foreign key ke profiles(address). Penulis yang
      // belum pernah handshake belum punya baris profil, dan tanpa ini
      // insert-nya gagal dengan pelanggaran foreign key mentah dari Postgres.
      // Pelajaran nyata dari Fase 3a.
      await ensureProfile(row.author);
      const { error } = await db.from("posts").insert({
        post_id: row.postId.toLowerCase(),
        author: row.author.toLowerCase(),
        body: row.body,
        created_at: new Date(row.createdAtMs).toISOString(),
      });
      if (error) throw new Error(`insert post gagal: ${error.message}`);
    },

    async getPost(postId) {
      const { data, error } = await db
        .from("posts").select(KOLOM_POST)
        .eq("post_id", postId.toLowerCase()).maybeSingle();
      if (error) throw new Error(`baca post gagal: ${error.message}`);
      return data ? rowToPost(data as PostDbRow) : null;
    },

    async markDeleted(postId) {
      const { error } = await db.from("posts")
        .update({ deleted_at: new Date().toISOString() })
        .eq("post_id", postId.toLowerCase());
      if (error) throw new Error(`hapus post gagal: ${error.message}`);
    },

    async setLike(postId, who, suka) {
      await ensureProfile(who);
      if (suka) {
        const { error } = await db.from("post_likes").upsert(
          { post_id: postId.toLowerCase(), address: who.toLowerCase() },
          { onConflict: "post_id,address", ignoreDuplicates: true },
        );
        if (error) throw new Error(`suka gagal: ${error.message}`);
        return;
      }
      const { error } = await db.from("post_likes").delete()
        .eq("post_id", postId.toLowerCase()).eq("address", who.toLowerCase());
      if (error) throw new Error(`batal suka gagal: ${error.message}`);
    },

    async addReport(postId, reporter, reason) {
      // post_reports.reporter TIDAK punya foreign key ke profiles (lihat
      // migrasi 0004: hanya check format alamat) — beda dari posts.author
      // yang memang foreign key. Jadi ensureProfile tidak dibutuhkan di
      // jalur ini; tidak ada pelanggaran foreign key yang mungkin terjadi.
      const { error } = await db.from("post_reports").upsert(
        { post_id: postId.toLowerCase(), reporter: reporter.toLowerCase(), reason },
        { onConflict: "post_id,reporter", ignoreDuplicates: true },
      );
      if (error) throw new Error(`lapor post gagal: ${error.message}`);
    },

    async setImagePending(postId, objectName, mime) {
      const { error } = await db.from("posts")
        .update({ image_object: objectName, image_mime: mime, image_status: "pending" })
        .eq("post_id", postId.toLowerCase());
      if (error) throw new Error(`set gambar pending gagal: ${error.message}`);
    },

    async setImageDone(postId, bucket) {
      const { error } = await db.from("posts")
        .update({ image_bucket: bucket, image_status: "ready" })
        .eq("post_id", postId.toLowerCase());
      if (error) throw new Error(`set gambar ready gagal: ${error.message}`);
    },

    async setImageFailed(postId) {
      const { error } = await db.from("posts")
        .update({ image_status: "failed" })
        .eq("post_id", postId.toLowerCase());
      if (error) throw new Error(`set gambar failed gagal: ${error.message}`);
    },

    /**
     * Jumlah kueri di sini TETAP — tidak tumbuh mengikuti jumlah kandidat.
     * Satu kueri per tabel pendukung, lalu digabung di memori. Jangan pernah
     * menaruh kueri di dalam map/for atas kandidat.
     */
    async listCandidates({ sinceMs, limit, viewer }) {
      const { data: postRows, error: e1 } = await db
        .from("posts").select(KOLOM_POST)
        .gte("created_at", new Date(sinceMs).toISOString())
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (e1) throw new Error(`ambil kandidat gagal: ${e1.message}`);

      const posts = (postRows ?? []).map((r) => rowToPost(r as PostDbRow));
      if (posts.length === 0) return [];

      const ids = posts.map((p) => p.postId.toLowerCase());
      const penulis = [...new Set(posts.map((p) => p.author.toLowerCase()))];
      const aku = viewer ? viewer.toLowerCase() : null;

      const [likes, reports, snapshots, slashed, profiles] = await Promise.all([
        db.from("post_likes").select("post_id, address").in("post_id", ids),
        db.from("post_reports").select("post_id, reporter").in("post_id", ids),
        db.from("trust_snapshots").select("address, ratio, tier, connections").in("address", penulis),
        db.from("slashes").select("subject").in("subject", penulis),
        db.from("profiles").select("address, display_name").in("address", penulis),
      ]);
      for (const r of [likes, reports, snapshots, slashed, profiles]) {
        if (r.error) throw new Error(`hidrasi feed gagal: ${r.error.message}`);
      }

      const jumlahSuka = new Map<string, number>();
      const sukaAku = new Set<string>();
      for (const r of (likes.data ?? []) as { post_id: string; address: string }[]) {
        jumlahSuka.set(r.post_id, (jumlahSuka.get(r.post_id) ?? 0) + 1);
        if (aku && r.address.toLowerCase() === aku) sukaAku.add(r.post_id);
      }

      const jumlahLapor = new Map<string, number>();
      for (const r of (reports.data ?? []) as { post_id: string }[]) {
        jumlahLapor.set(r.post_id, (jumlahLapor.get(r.post_id) ?? 0) + 1);
      }

      const snap = new Map<string, { ratio: number; tier: number; connections: number }>();
      for (const r of (snapshots.data ?? []) as
        { address: string; ratio: number; tier: number; connections: number }[]) {
        snap.set(r.address.toLowerCase(), r);
      }

      const kenaSlash = new Set(
        ((slashed.data ?? []) as { subject: string }[]).map((r) => r.subject.toLowerCase()),
      );

      const nama = new Map<string, string>();
      for (const r of (profiles.data ?? []) as { address: string; display_name: string }[]) {
        nama.set(r.address.toLowerCase(), r.display_name);
      }

      // DUA kueri untuk seluruh graf penonton, bukan satu per unggahan.
      let hop = new Map<string, 1 | 2>();
      if (aku) {
        const { data: t1, error: e2 } = await db
          .from("connections").select("addr_a, addr_b")
          .or(`addr_a.eq.${aku},addr_b.eq.${aku}`);
        if (e2) throw new Error(`ambil koneksi gagal: ${e2.message}`);

        const satu = [...new Set(((t1 ?? []) as { addr_a: string; addr_b: string }[])
          .flatMap((t) => [t.addr_a.toLowerCase(), t.addr_b.toLowerCase()])
          .filter((a) => a !== aku))];

        let t2: { addr_a: string; addr_b: string }[] = [];
        if (satu.length > 0) {
          const { data, error: e3 } = await db
            .from("connections").select("addr_a, addr_b")
            .or(`addr_a.in.(${satu.join(",")}),addr_b.in.(${satu.join(",")})`);
          if (e3) throw new Error(`ambil koneksi lapis dua gagal: ${e3.message}`);
          t2 = (data ?? []) as { addr_a: string; addr_b: string }[];
        }
        hop = petaHop(viewer as Address, (t1 ?? []) as Tepi[], t2);
      }

      return posts.map((p): FeedCandidate => {
        const a = p.author.toLowerCase();
        const s = snap.get(a);
        return {
          ...p,
          displayName: nama.get(a) ?? "",
          authorRatio: s?.ratio ?? 0,
          authorTier: s?.tier ?? 0,
          authorConnections: s?.connections ?? 0,
          authorSlashed: kenaSlash.has(a),
          reportCount: jumlahLapor.get(p.postId.toLowerCase()) ?? 0,
          likeCount: jumlahSuka.get(p.postId.toLowerCase()) ?? 0,
          sudahSuka: sukaAku.has(p.postId.toLowerCase()),
          hop: hop.get(a) ?? null,
        };
      });
    },
  };
}
