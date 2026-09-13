import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  lampirGambarTypedData, laporPostTypedData, lihatBlokirTypedData, lihatFeedTypedData,
  lihatKecocokanTypedData, makePostId, postTypedData, tandaiDilihatTypedData,
} from "@nearly/shared";
import { feedRoutes } from "../src/routes/feed";
import type { FeedCandidate, FeedDeps, FeedStore, PostRecord } from "../src/ports";

const penulis = privateKeyToAccount(`0x${"77".repeat(32)}` as Hex);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const NOW = 1_800_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);

function rekam(over: Partial<PostRecord> = {}): PostRecord {
  return {
    postId: `0x${"1".repeat(64)}` as Hex, author: penulis.address, body: "halo",
    imageBucket: null, imageObject: null, imageMime: null, imageStatus: "none",
    createdAtMs: NOW, deleted: false, ...over,
  };
}

function kandidat(over: Partial<FeedCandidate> = {}): FeedCandidate {
  return {
    ...rekam(), displayName: "Andi", authorRatio: 0.1, authorTier: 1,
    authorConnections: 4, authorSlashed: false, reportCount: 0,
    likeCount: 3, sudahSuka: false, hop: 1, ...over,
  };
}

function store(over: Partial<FeedStore> = {}): FeedStore {
  return {
    createPost: vi.fn(async () => {}), getPost: vi.fn(async () => null),
    markDeleted: vi.fn(async () => {}), setLike: vi.fn(async () => {}),
    addReport: vi.fn(async () => {}), setImagePending: vi.fn(async () => {}),
    setImageDone: vi.fn(async () => {}), setImageFailed: vi.fn(async () => {}),
    listCandidates: vi.fn(async () => []), ...over,
  };
}

function app(feed: FeedStore) {
  const deps: FeedDeps = {
    feed,
    greenfield: { bucket: "nearly-feed", spEndpoint: "https://sp.example", upload: vi.fn(async () => {}) },
    verifyingContract: KONTRAK,
    nowMs: () => NOW,
  };
  const a = new Hono();
  a.route("/", feedRoutes(deps));
  return a;
}

async function badanBuat(over: Record<string, unknown> = {}) {
  const postId = makePostId();
  const pesan = { postId, author: penulis.address, body: "halo dunia", expiresAt: EXP };
  const sig = await penulis.signTypedData(postTypedData(pesan, KONTRAK));
  return { postId, author: penulis.address, body: "halo dunia", expiresAt: EXP.toString(), sig, ...over };
}

const kirim = (a: Hono, path: string, body: unknown) =>
  a.request(path, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });

describe("POST /posts", () => {
  it("mengembalikan 200 untuk permintaan sah", async () => {
    const res = await kirim(app(store()), "/posts", await badanBuat());
    expect(res.status).toBe(200);
  });

  it("mengembalikan 400 untuk badan yang tidak valid", async () => {
    const res = await kirim(app(store()), "/posts", { author: penulis.address });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_body" });
  });

  it("mengembalikan 400 untuk body melebihi 500 karakter", async () => {
    const res = await kirim(app(store()), "/posts", await badanBuat({ body: "a".repeat(501) }));
    expect(res.status).toBe(400);
  });

  // Bukan 500. Zod menjalankan refine walau field gagal.
  it("mengembalikan 400, bukan 500, untuk expiresAt bukan angka", async () => {
    const res = await kirim(app(store()), "/posts", await badanBuat({ expiresAt: "besok" }));
    expect(res.status).toBe(400);
  });

  it("meneruskan httpStatus dari gerbang", async () => {
    const res = await kirim(app(store({ getPost: vi.fn(async () => rekam()) })), "/posts", await badanBuat());
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "post_exists" });
  });
});

describe("kecocokan :id dengan badan", () => {
  it("menolak ketika :id berbeda dari postId di badan", async () => {
    const badan = await badanBuat();
    const res = await kirim(app(store()), `/posts/0x${"9".repeat(64)}/delete`, {
      postId: badan.postId, author: penulis.address, expiresAt: EXP.toString(), sig: badan.sig,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_body" });
  });

  it("menerima :id yang sama walau beda besar-kecil huruf", async () => {
    const s = store({ getPost: vi.fn(async () => null) });
    const id = `0x${"1".repeat(64)}` as Hex;
    const res = await kirim(app(s), `/posts/${id.toUpperCase()}/delete`, {
      postId: id, author: penulis.address, expiresAt: EXP.toString(), sig: `0x${"b".repeat(130)}`,
    });
    // Lolos pemeriksaan :id, lalu gagal di gerbang karena unggahan tidak ada.
    expect(res.status).toBe(404);
  });
});

describe("POST /posts/:id/report", () => {
  const ID = `0x${"1".repeat(64)}` as Hex;
  const ALASAN = "spam berulang di feed";

  async function badanLapor(over: Record<string, unknown> = {}) {
    const pesan = { postId: ID, reporter: penulis.address, reason: ALASAN, expiresAt: EXP };
    const sig = await penulis.signTypedData(laporPostTypedData(pesan, KONTRAK));
    return {
      postId: ID, reporter: penulis.address, reason: ALASAN,
      expiresAt: EXP.toString(), sig, ...over,
    };
  }

  it("mencatat laporan yang bertanda tangan sah", async () => {
    const s = store({ getPost: vi.fn(async () => rekam()) });
    const res = await kirim(app(s), `/posts/${ID}/report`, await badanLapor());
    expect(res.status).toBe(200);
    expect(s.addReport).toHaveBeenCalled();
  });

  /**
   * Rute ini menyembunyikan unggahan begitu 3 pelapor BERBEDA terkumpul, dan
   * `post_reports.reporter` bukan foreign key — alamatnya tidak perlu pernah
   * ada. Tes ini menjadi merah begitu pemeriksaan tanda tangan dicabut.
   */
  it("menolak tiga alamat karangan yang mencoba menembus ambang", async () => {
    const karangan = [
      "0x00000000000000000000000000000000000000a1",
      "0x00000000000000000000000000000000000000a2",
      "0x00000000000000000000000000000000000000a3",
    ];
    const sah = await badanLapor();
    for (const palsu of karangan) {
      const s = store({ getPost: vi.fn(async () => rekam()) });
      const res = await kirim(app(s), `/posts/${ID}/report`, { ...sah, reporter: palsu });
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({ code: "bad_signature" });
      expect(s.addReport).not.toHaveBeenCalled();
    }
  });

  it("menolak badan laporan tanpa tanda tangan sama sekali", async () => {
    const s = store({ getPost: vi.fn(async () => rekam()) });
    const res = await kirim(app(s), `/posts/${ID}/report`, {
      postId: ID, reporter: penulis.address, reason: ALASAN,
    });
    expect(res.status).toBe(400);
    expect(s.addReport).not.toHaveBeenCalled();
  });
});

/**
 * Diuji di TINGKAT HTTP, bukan lewat skema saja. Validasi statis lewat skema
 * berjalan SETELAH seluruh badan disangga dan diurai — lubang yang perbaikan
 * ini tutup justru membuktikan bahwa memeriksa skemanya saja tidak cukup.
 */
describe("POST /posts/:id/image — batas di tingkat HTTP", () => {
  const ID = `0x${"1".repeat(64)}` as Hex;

  async function badanGambar(over: Record<string, unknown> = {}) {
    const mime = (over.mime as string) ?? "image/jpeg";
    const pesan = { postId: ID, author: penulis.address, mime, expiresAt: EXP };
    const sig = await penulis.signTypedData(lampirGambarTypedData(pesan, KONTRAK));
    return {
      postId: ID, author: penulis.address, mime,
      expiresAt: EXP.toString(), sig, dataBase64: "aGFsbw==", ...over,
    };
  }

  it("menerima jpeg yang sah", async () => {
    const s = store({ getPost: vi.fn(async () => rekam()) });
    const res = await kirim(app(s), `/posts/${ID}/image`, await badanGambar());
    expect(res.status).toBe(200);
  });

  // Klien pernah melabeli ulang HEIC/WebP jadi image/jpeg. Rute harus
  // menolak mime asing, bukan menerimanya lalu menyajikan berkas yang tidak
  // akan pernah tampil.
  it("menolak mime asing dengan 400", async () => {
    const s = store({ getPost: vi.fn(async () => rekam()) });
    const res = await kirim(app(s), `/posts/${ID}/image`, await badanGambar({ mime: "image/heic" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: "invalid_body" });
    expect(s.setImagePending).not.toHaveBeenCalled();
  });

  /**
   * Badan raksasa harus ditolak SEBELUM disangga dan diurai. Kalau bodyLimit
   * dicabut, badan ini tetap ditolak — tapi baru setelah dialokasikan dua
   * kali, yaitu persis kegagalan yang dilaporkan.
   */
  it("menolak dataBase64 yang melewati batas", async () => {
    const s = store({ getPost: vi.fn(async () => rekam()) });
    const raksasa = "A".repeat(4 * 1024 * 1024);
    const res = await kirim(app(s), `/posts/${ID}/image`, await badanGambar({ dataBase64: raksasa }));
    expect([400, 413]).toContain(res.status);
    expect(s.setImagePending).not.toHaveBeenCalled();
  });

  // Penjaga khusus lapis PERTAMA: badan lebih besar dari batas ditolak 413
  // oleh bodyLimit, tanpa handler-nya pernah dijalankan. Kalau bodyLimit
  // dicabut, badan ini lolos ke c.req.json() dan statusnya jadi 400.
  it("badan melebihi batas ditolak 413 oleh bodyLimit sebelum diurai", async () => {
    const s = store({ getPost: vi.fn(async () => rekam()) });
    const raksasa = "A".repeat(4 * 1024 * 1024);
    const res = await kirim(app(s), `/posts/${ID}/image`, await badanGambar({ dataBase64: raksasa }));
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ code: "image_too_large" });
    expect(s.getPost).not.toHaveBeenCalled();
  });
});

/**
 * Spec §11.5 mengakui PERGESERAN URUTAN akibat kebaruan yang meluruh. Ia
 * TIDAK mengakui unggahan yang hilang dari semua halaman, maupun unggahan
 * yang muncul dua kali. Dengan `nowMs` beku, tidak ada peluruhan sama sekali,
 * jadi kedua hal itu tidak punya pembelaan.
 */
describe("GET /feed — paginasi dengan jam beku", () => {
  // 33 kandidat berskor sama; urutannya ditentukan pemecah seri postId, jadi
  // peringkatnya deterministik tanpa bergantung pada rumus skor.
  function tigaPuluhTiga(): FeedCandidate[] {
    return Array.from({ length: 33 }, (_, i) => kandidat({
      postId: `0x${String(i + 10).padStart(64, "0")}` as Hex,
      author: `0x${String(i + 10).padStart(40, "0")}` as Address,
      // Satu-satunya yang memenuhi syarat slot pendatang, dan ia berada di
      // luar 30 besar — persis kondisi yang menyalakan penyisipan.
      authorConnections: i === 31 ? 1 : 9,
      createdAtMs: NOW,
      likeCount: 0,
      authorRatio: 0.1,
    }));
  }

  async function halaman(s: FeedStore, cursor?: string) {
    const res = await app(s).request(`/feed${cursor ? `?cursor=${cursor}` : ""}`);
    expect(res.status).toBe(200);
    return await res.json() as { posts: { postId: string }[]; cursor: string | null };
  }

  it("tidak ada unggahan yang hilang maupun muncul dua kali antar dua halaman", async () => {
    const semua = tigaPuluhTiga();
    const s = store({ listCandidates: vi.fn(async () => semua) });

    const h1 = await halaman(s);
    expect(h1.posts).toHaveLength(30);
    expect(h1.cursor).toBe("30");

    const h2 = await halaman(s, h1.cursor!);

    const terkumpul = [...h1.posts, ...h2.posts].map((p) => p.postId);

    // Tanpa duplikat.
    expect(new Set(terkumpul).size).toBe(terkumpul.length);

    // Tanpa yang hilang: 33 kandidat, 33 baris terkumpul.
    expect(new Set(terkumpul)).toEqual(new Set(semua.map((c) => c.postId)));
  });

  it("slot pendatang hanya muncul di halaman pertama", async () => {
    const semua = tigaPuluhTiga();
    const pendatang = semua[31]!.postId;
    const s = store({ listCandidates: vi.fn(async () => semua) });

    const h1 = await halaman(s);
    const h2 = await halaman(s, "30");

    // Dipromosikan ke slot pertama (indeks 5) di halaman satu...
    expect(h1.posts[5]!.postId).toBe(pendatang);
    // ...dan TIDAK muncul lagi di halaman dua.
    expect(h2.posts.map((p) => p.postId)).not.toContain(pendatang);
  });
});

describe("GET /feed", () => {
  it("mengembalikan baris terperingkat tanpa menuntut who", async () => {
    const s = store({ listCandidates: vi.fn(async () => [kandidat()]) });
    const res = await app(s).request("/feed");
    expect(res.status).toBe(200);
    const json = await res.json() as { posts: unknown[] };
    expect(json.posts).toHaveLength(1);
  });

  /**
   * `who` TANPA bukti tetap diterima dan tetap dipakai untuk urutan graf
   * (Fase 3b): graf koneksi sudah publik on-chain. Tapi sejak blokir (C1
   * review akhir 4a) ia TIDAK TERBUKTI — efek blokir tidak diterapkan,
   * karena kalau diterapkan, siapa pun bisa membandingkan feed dengan dan
   * tanpa `who` lalu membaca hubungan blokir alamat itu.
   */
  it("menerima who tanpa tanda tangan bukti baca, sebagai penonton TIDAK terbukti", async () => {
    const s = store({ listCandidates: vi.fn(async () => [kandidat()]) });
    const res = await app(s).request(`/feed?who=${penulis.address}`);
    expect(res.status).toBe(200);
    expect(s.listCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ viewer: penulis.address.toLowerCase(), terbukti: false }),
    );
  });

  it("mengabaikan who yang bukan alamat, bukan menggagalkan permintaan", async () => {
    const s = store({ listCandidates: vi.fn(async () => [kandidat()]) });
    const res = await app(s).request("/feed?who=bukan-alamat");
    expect(res.status).toBe(200);
    expect(s.listCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ viewer: null, terbukti: false }),
    );
  });

  // Semua angka waktu keluar sebagai angka JSON biasa; tidak ada bigint yang
  // lolos ke serializer. Fase 3a menemukan bug ini lewat fixture kosong.
  it("seluruh baris bisa diserialisasi tanpa galat bigint", async () => {
    const s = store({ listCandidates: vi.fn(async () => [kandidat(), kandidat()]) });
    const res = await app(s).request("/feed");
    await expect(res.json()).resolves.toBeTruthy();
  });

  it("cursor bukan angka diperlakukan sebagai halaman pertama", async () => {
    const s = store({ listCandidates: vi.fn(async () => [kandidat()]) });
    const res = await app(s).request("/feed?cursor=abc");
    expect(res.status).toBe(200);
  });
});

/**
 * C1 review akhir 4a. Penonton TERBUKTI = `who` + `expiresAt` + `sig` yang
 * sah untuk LihatFeed, belum kedaluwarsa, penanda tangan == who. Hanya dia
 * yang mendapat efek blokir di feed-nya.
 *
 * Bukti yang hilang, cacat, kedaluwarsa, milik orang lain, atau bertipe
 * salah TIDAK PERNAH 4xx: rute ini tidak boleh gagal untuk orang yang
 * membuka tautan. Ia turun ke "tidak terbukti" — urutan graf tetap, efek
 * blokir tidak.
 */
describe("GET /feed — bukti LihatFeed", () => {
  const WAKTU = EXP;

  async function kueri(tanda: (m: { who: Address; expiresAt: bigint }) => Promise<Hex>, over: Record<string, string> = {}) {
    const m = { who: penulis.address, expiresAt: WAKTU };
    const sig = await tanda(m);
    return new URLSearchParams({
      who: penulis.address, expiresAt: WAKTU.toString(), sig, ...over,
    }).toString();
  }

  async function panggil(q: string) {
    const s = store({ listCandidates: vi.fn(async () => [kandidat()]) });
    const res = await app(s).request(`/feed?${q}`);
    return { res, s };
  }

  it("bukti LihatFeed sah → penonton terbukti", async () => {
    const { res, s } = await panggil(await kueri((m) => penulis.signTypedData(lihatFeedTypedData(m, KONTRAK))));
    expect(res.status).toBe(200);
    expect(s.listCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ viewer: penulis.address.toLowerCase(), terbukti: true }),
    );
  });

  // Keluarga `{ who, expiresAt }`: hanya nama tipe yang membedakan digest.
  it("tanda tangan LihatKecocokan diperlakukan TIDAK terbukti", async () => {
    const { res, s } = await panggil(await kueri((m) => penulis.signTypedData(lihatKecocokanTypedData(m, KONTRAK))));
    expect(res.status).toBe(200);
    expect(s.listCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ viewer: penulis.address.toLowerCase(), terbukti: false }),
    );
  });

  it("tanda tangan LihatBlokir dan TandaiDilihat juga TIDAK terbukti", async () => {
    const kueriSalahTipe = [
      await kueri((m) => penulis.signTypedData(lihatBlokirTypedData(m, KONTRAK))),
      await kueri((m) => penulis.signTypedData(tandaiDilihatTypedData(m, KONTRAK))),
    ];
    for (const q of kueriSalahTipe) {
      const { res, s } = await panggil(q);
      expect(res.status).toBe(200);
      expect(s.listCandidates).toHaveBeenCalledWith(expect.objectContaining({ terbukti: false }));
    }
  });

  it("bukti kedaluwarsa → 200, tidak terbukti", async () => {
    const lewat = BigInt(Math.floor(NOW / 1000) - 1);
    const m = { who: penulis.address, expiresAt: lewat };
    const sig = await penulis.signTypedData(lihatFeedTypedData(m, KONTRAK));
    const q = new URLSearchParams({ who: penulis.address, expiresAt: lewat.toString(), sig });
    const { res, s } = await panggil(q.toString());
    expect(res.status).toBe(200);
    expect(s.listCandidates).toHaveBeenCalledWith(expect.objectContaining({ terbukti: false }));
  });

  it("tanda tangan orang lain atas nama who → 200, tidak terbukti", async () => {
    const orangLain = privateKeyToAccount(`0x${"88".repeat(32)}` as Hex);
    const { res, s } = await panggil(await kueri((m) => orangLain.signTypedData(lihatFeedTypedData(m, KONTRAK))));
    expect(res.status).toBe(200);
    expect(s.listCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ viewer: penulis.address.toLowerCase(), terbukti: false }),
    );
  });

  // Byte `v` di luar {0,1,27,28}: viem melempar. Tanpa pulihkanTandaTangan
  // ini 500 — dan rute feed tidak boleh gagal untuk orang yang membuka tautan.
  it("tanda tangan cacat bentuk → 200, tidak terbukti, bukan 500", async () => {
    const q = new URLSearchParams({
      who: penulis.address, expiresAt: WAKTU.toString(), sig: `0x${"99".repeat(65)}`,
    });
    const { res, s } = await panggil(q.toString());
    expect(res.status).toBe(200);
    expect(s.listCandidates).toHaveBeenCalledWith(expect.objectContaining({ terbukti: false }));
  });

  it("expiresAt bukan angka atau sig hilang → 200, tidak terbukti", async () => {
    for (const q of [
      await kueri((m) => penulis.signTypedData(lihatFeedTypedData(m, KONTRAK)), { expiresAt: "besok" }),
      new URLSearchParams({ who: penulis.address, expiresAt: WAKTU.toString() }).toString(),
    ]) {
      const { res, s } = await panggil(q);
      expect(res.status).toBe(200);
      expect(s.listCandidates).toHaveBeenCalledWith(expect.objectContaining({ terbukti: false }));
    }
  });

  it("bukti sah untuk alamat yang bukan who tidak membuat who terbukti", async () => {
    const lain = privateKeyToAccount(`0x${"88".repeat(32)}` as Hex);
    const m = { who: lain.address, expiresAt: WAKTU };
    const sig = await lain.signTypedData(lihatFeedTypedData(m, KONTRAK));
    const q = new URLSearchParams({ who: penulis.address, expiresAt: WAKTU.toString(), sig });
    const { res, s } = await panggil(q.toString());
    expect(res.status).toBe(200);
    expect(s.listCandidates).toHaveBeenCalledWith(expect.objectContaining({ terbukti: false }));
  });
});
