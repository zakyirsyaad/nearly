import type { SupabaseClient } from "@supabase/supabase-js";
import type { Address, Hex } from "viem";
import type { BlokirStore, FeedCandidate, FeedStore, ImageStatus, PostRecord } from "./ports";

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
 * Penonton MEMETAKAN DIRINYA SENDIRI ke 0. Sebelumnya ia sengaja dikeluarkan
 * dari peta, sehingga unggahannya sendiri tiba dengan `hop: null` — kartunya
 * berbunyi "Di luar jaringanmu" untuk unggahan penulisnya sendiri, dan
 * penilai mengalikan skornya dengan JARAK_LUAR 0.3. Nol berarti "milikmu",
 * dan ia menang atas 1 maupun 2 kalau seseorang entah bagaimana punya tepi ke
 * dirinya sendiri.
 *
 * `terblokir` memuat setiap alamat yang punya hubungan blokir dengan penonton
 * ke arah mana pun — kosong untuk penonton yang tidak terbukti (lihat
 * `listCandidates`). Edge yang menyentuhnya dibuang SEBELUM lompatan
 * dihitung, bukan sesudahnya — kalau disaring sesudah, orang ketiga yang
 * hanya terjangkau LEWAT orang yang diblokir tetap terhitung dua lompatan
 * padahal jalannya sudah putus bagi penonton.
 *
 * Feed dan trust TIDAK sepakat sepenuhnya, dengan sengaja (spec §5.1). Trust
 * membuang edge antara pasangan terblokir MANA PUN; di sini hanya edge yang
 * menyentuh blokir PENONTON sendiri. Kalau B memblokir Z, penonton masih
 * menjangkau Z lewat B di feed, tapi tidak di trust. Versi per-pasangan akan
 * membutuhkan himpunan blokir pihak ketiga, dan `hop` yang dikirim ke
 * penonton akan membocorkannya: Z yang tiba-tiba "di luar jaringanmu"
 * memberi tahu penonton bahwa B dan Z saling memblokir.
 */
export function petaHop(
  viewer: Address, tepi1: Tepi[], tepi2: Tepi[], terblokir: ReadonlySet<string>,
): Map<string, 0 | 1 | 2> {
  const aku = viewer.toLowerCase();
  const peta = new Map<string, 0 | 1 | 2>();
  peta.set(aku, 0);

  // Edge yang menyentuh alamat terblokir dibuang lebih dulu, kedua lapisnya.
  const hidup = (t: Tepi) =>
    !terblokir.has(t.addr_a.toLowerCase()) && !terblokir.has(t.addr_b.toLowerCase());
  const t1 = tepi1.filter(hidup);
  const t2 = tepi2.filter(hidup);

  const seberang = (t: Tepi, dari: Set<string>): string | null => {
    const a = t.addr_a.toLowerCase();
    const b = t.addr_b.toLowerCase();
    if (dari.has(a)) return b;
    if (dari.has(b)) return a;
    return null;
  };

  const satu = new Set<string>();
  for (const t of t1) {
    const lain = seberang(t, new Set([aku]));
    if (lain && lain !== aku) satu.add(lain);
  }
  for (const a of satu) peta.set(a, 1);

  for (const t of t2) {
    const lain = seberang(t, satu);
    // 1 lompatan menang atas 2 — yang lebih dekat yang berlaku.
    if (lain && lain !== aku && !peta.has(lain)) peta.set(lain, 2);
  }

  return peta;
}

/**
 * PostgREST mengirim `.in(...)` sebagai query string di URL GET. Dengan
 * MAKS_KANDIDAT 500 dan post_id sepanjang 66 karakter, satu `.in("post_id",
 * ids)` menghasilkan sekitar 33 KB query string dalam SATU permintaan GET —
 * dan proksi di depan Supabase menolaknya. Akibatnya listCandidates melempar
 * dan GET /feed mengembalikan 500: feed mati total, dan hanya setelah cukup
 * banyak unggahan menumpuk, jadi ia lolos demo lalu gagal belakangan.
 *
 * 100 dipilih supaya kelompok terpanjang (post_id 66 karakter) tetap jauh di
 * bawah batas URL mana pun yang wajar: 100 x ~70 = ~7 KB.
 */
export const UKURAN_KELOMPOK = 100;

/** Murni, dan diuji sendiri. */
export function potongKelompok<T>(items: T[], ukuran = UKURAN_KELOMPOK): T[][] {
  if (ukuran < 1) throw new Error("ukuran kelompok minimal 1");
  const keluar: T[][] = [];
  for (let i = 0; i < items.length; i += ukuran) {
    keluar.push(items.slice(i, i + ukuran));
  }
  return keluar;
}

type HasilKueri = { data: unknown[] | null; error: { message: string } | null };

/**
 * Menjalankan satu kueri PER KELOMPOK lalu menggabungkan hasilnya di memori.
 *
 * Ini TIDAK melanggar aturan "jangan N+1": jumlah kuerinya terikat pada
 * jumlah kelompok (maksimal 5 untuk 500 kandidat), bukan pada jumlah kandidat
 * satu per satu. Kelompok-kelompoknya berjalan bersamaan.
 */
async function gabungPerKelompok(
  kelompok: string[][],
  jalankan: (bagian: string[]) => PromiseLike<HasilKueri>,
  konteks: string,
): Promise<unknown[]> {
  const hasil = await Promise.all(kelompok.map(jalankan));
  const keluar: unknown[] = [];
  for (const r of hasil) {
    if (r.error) throw new Error(`${konteks} gagal: ${r.error.message}`);
    keluar.push(...(r.data ?? []));
  }
  return keluar;
}

export function createFeedStore(db: SupabaseClient, blokir: BlokirStore): FeedStore {
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
     * Jumlah kueri di sini terikat pada jumlah KELOMPOK, bukan pada jumlah
     * kandidat satu per satu — jadi ia tetap memenuhi aturan "jangan N+1".
     * Satu kueri per tabel pendukung per kelompok maksimal UKURAN_KELOMPOK,
     * lalu digabung di memori. Jangan pernah menaruh kueri di dalam map/for
     * atas kandidat.
     */
    async listCandidates({ sinceMs, limit, viewer, terbukti }) {
      const { data: postRows, error: e1 } = await db
        .from("posts").select(KOLOM_POST)
        .gte("created_at", new Date(sinceMs).toISOString())
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (e1) throw new Error(`ambil kandidat gagal: ${e1.message}`);

      const aku = viewer ? viewer.toLowerCase() : null;

      // Dua arah: unggahan orang yang kamu blokir hilang dari feedmu, DAN
      // unggahanmu hilang dari feed mereka. Yang kedua terjadi sendirinya
      // karena himpunan ini simetris (spec §5.1).
      //
      // HANYA untuk penonton TERBUKTI (review akhir 4a, C1). Untuk `who` yang
      // datang tanpa bukti LihatFeed, `himpunanUntuk` tidak dipanggil sama
      // sekali dan himpunannya kosong — baik untuk saringan unggahan maupun
      // `petaHop` di bawah. Kalau tidak, `GET /feed` vs `GET /feed?who=A`
      // gratis menyingkap siapa yang punya hubungan blokir dengan A: penulis
      // yang hilang, dan `hop` yang bergeser.
      const terblokir = aku && terbukti
        ? await blokir.himpunanUntuk(viewer as Address)
        : new Set<string>();

      const posts = (postRows ?? []).map((r) => rowToPost(r as PostDbRow))
        .filter((p) => !terblokir.has(p.author.toLowerCase()));
      if (posts.length === 0) return [];

      const ids = posts.map((p) => p.postId.toLowerCase());
      const penulis = [...new Set(posts.map((p) => p.author.toLowerCase()))];

      // Setiap `.in()` dipotong jadi kelompok maksimal UKURAN_KELOMPOK id.
      const kelompokId = potongKelompok(ids);
      const kelompokPenulis = potongKelompok(penulis);

      const [likes, reports, snapshots, slashed, profiles] = await Promise.all([
        gabungPerKelompok(kelompokId, (bagian) =>
          db.from("post_likes").select("post_id, address").in("post_id", bagian),
        "hidrasi feed"),
        gabungPerKelompok(kelompokId, (bagian) =>
          db.from("post_reports").select("post_id, reporter").in("post_id", bagian),
        "hidrasi feed"),
        gabungPerKelompok(kelompokPenulis, (bagian) =>
          db.from("trust_snapshots").select("address, ratio, tier, connections").in("address", bagian),
        "hidrasi feed"),
        gabungPerKelompok(kelompokPenulis, (bagian) =>
          db.from("slashes").select("subject").in("subject", bagian),
        "hidrasi feed"),
        gabungPerKelompok(kelompokPenulis, (bagian) =>
          db.from("profiles").select("address, display_name").in("address", bagian),
        "hidrasi feed"),
      ]);

      const jumlahSuka = new Map<string, number>();
      const sukaAku = new Set<string>();
      for (const r of likes as { post_id: string; address: string }[]) {
        jumlahSuka.set(r.post_id, (jumlahSuka.get(r.post_id) ?? 0) + 1);
        if (aku && r.address.toLowerCase() === aku) sukaAku.add(r.post_id);
      }

      const jumlahLapor = new Map<string, number>();
      for (const r of reports as { post_id: string }[]) {
        jumlahLapor.set(r.post_id, (jumlahLapor.get(r.post_id) ?? 0) + 1);
      }

      const snap = new Map<string, { ratio: number; tier: number; connections: number }>();
      for (const r of snapshots as
        { address: string; ratio: number; tier: number; connections: number }[]) {
        snap.set(r.address.toLowerCase(), r);
      }

      const kenaSlash = new Set(
        (slashed as { subject: string }[]).map((r) => r.subject.toLowerCase()),
      );

      const nama = new Map<string, string>();
      for (const r of profiles as { address: string; display_name: string }[]) {
        nama.set(r.address.toLowerCase(), r.display_name);
      }

      // Graf penonton diambil dengan jumlah kueri TETAP — satu untuk lapis
      // satu, lalu satu per kelompok untuk lapis dua — bukan satu kueri per
      // unggahan.
      let hop = new Map<string, 0 | 1 | 2>();
      if (aku) {
        const { data: t1, error: e2 } = await db
          .from("connections").select("addr_a, addr_b")
          .or(`addr_a.eq.${aku},addr_b.eq.${aku}`);
        if (e2) throw new Error(`ambil koneksi gagal: ${e2.message}`);

        const satu = [...new Set(((t1 ?? []) as { addr_a: string; addr_b: string }[])
          .flatMap((t) => [t.addr_a.toLowerCase(), t.addr_b.toLowerCase()])
          .filter((a) => a !== aku))];

        // `.or(...in...)` juga masuk query string, dan orang dengan banyak
        // koneksi membuatnya sama panjangnya. Dipotong dengan aturan sama.
        const t2 = await gabungPerKelompok(
          potongKelompok(satu),
          (bagian) => db.from("connections").select("addr_a, addr_b")
            .or(`addr_a.in.(${bagian.join(",")}),addr_b.in.(${bagian.join(",")})`),
          "ambil koneksi lapis dua",
        ) as { addr_a: string; addr_b: string }[];
        hop = petaHop(viewer as Address, (t1 ?? []) as Tepi[], t2, terblokir);
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
