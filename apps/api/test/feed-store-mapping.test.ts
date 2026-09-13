import { describe, expect, it, vi } from "vitest";
import type { Address } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BlokirStore } from "../src/ports";
import {
  createFeedStore, petaHop, potongKelompok, rowToPost, UKURAN_KELOMPOK,
  type PostDbRow,
} from "../src/feed-store";

// Fake BlokirStore dengan tepat lima metode (lihat METODE_BLOKIR_STORE di
// ports.ts) — `himpunanUntuk` kosong karena tes-tes di bawah memakai
// `viewer: null`, jadi ia tidak seharusnya pernah dipanggil.
function blokirPalsu(): BlokirStore {
  return {
    setBlokir: async () => {},
    adaBlokir: async () => false,
    diblokirOleh: async () => [],
    himpunanUntuk: async () => new Set<string>(),
    pemblokirUntuk: async () => new Set<string>(),
  };
}

const AKU = "0x00000000000000000000000000000000000000a1" as Address;
const B = "0x00000000000000000000000000000000000000b2";
const C = "0x00000000000000000000000000000000000000c3";
const D = "0x00000000000000000000000000000000000000d4";

function row(over: Partial<PostDbRow> = {}): PostDbRow {
  return {
    post_id: `0x${"1".repeat(64)}`,
    author: AKU,
    body: "halo",
    image_bucket: null, image_object: null, image_mime: null, image_status: "none",
    created_at: "2026-09-07T10:00:00.000Z",
    deleted_at: null,
    ...over,
  };
}

describe("rowToPost", () => {
  it("mengubah created_at menjadi milidetik epoch", () => {
    expect(rowToPost(row()).createdAtMs).toBe(Date.parse("2026-09-07T10:00:00.000Z"));
  });

  it("deleted_at yang terisi menjadi deleted true", () => {
    expect(rowToPost(row({ deleted_at: "2026-09-07T11:00:00.000Z" })).deleted).toBe(true);
    expect(rowToPost(row()).deleted).toBe(false);
  });

  it("meneruskan medan gambar apa adanya", () => {
    const p = rowToPost(row({
      image_bucket: "nearly-feed", image_object: "x.jpg",
      image_mime: "image/jpeg", image_status: "ready",
    }));
    expect(p.imageBucket).toBe("nearly-feed");
    expect(p.imageObject).toBe("x.jpg");
    expect(p.imageStatus).toBe("ready");
  });
});

describe("petaHop", () => {
  const tepi = (a: string, b: string) => ({ addr_a: a, addr_b: b });

  it("koneksi langsung berjarak 1 lompatan", () => {
    expect(petaHop(AKU, [tepi(AKU, B)], [], new Set()).get(B.toLowerCase())).toBe(1);
  });

  it("koneksi dari koneksi berjarak 2 lompatan", () => {
    expect(petaHop(AKU, [tepi(AKU, B)], [tepi(B, C)], new Set()).get(C.toLowerCase())).toBe(2);
  });

  it("arah tepi tidak penting", () => {
    expect(petaHop(AKU, [tepi(B, AKU)], [], new Set()).get(B.toLowerCase())).toBe(1);
  });

  // Satu lompatan menang atas dua: kalau seseorang bisa dicapai lewat kedua
  // jalur, yang lebih dekat yang berlaku.
  it("1 lompatan tidak diturunkan menjadi 2", () => {
    expect(petaHop(AKU, [tepi(AKU, B), tepi(AKU, C)], [tepi(B, C)], new Set()).get(C.toLowerCase())).toBe(1);
  });

  /**
   * Penonton memetakan DIRINYA SENDIRI ke 0. Sebelumnya ia dikeluarkan dari
   * peta, jadi unggahannya sendiri tiba dengan `hop: null` — kartunya berbunyi
   * "Di luar jaringanmu" untuk unggahan penulisnya sendiri, dan penilai
   * mengalikan skornya dengan JARAK_LUAR 0.3.
   */
  it("penonton memetakan dirinya sendiri ke 0", () => {
    expect(petaHop(AKU, [tepi(AKU, B)], [tepi(B, AKU)], new Set()).get(AKU.toLowerCase())).toBe(0);
  });

  it("0 tidak bisa diturunkan menjadi 1 atau 2 oleh tepi mana pun", () => {
    const peta = petaHop(AKU, [tepi(AKU, B), tepi(AKU, AKU)], [tepi(B, AKU)], new Set());
    expect(peta.get(AKU.toLowerCase())).toBe(0);
  });

  it("0 dipetakan tanpa peduli besar-kecil huruf alamat penonton", () => {
    const peta = petaHop(AKU.toUpperCase() as Address, [], [], new Set());
    expect(peta.get(AKU.toLowerCase())).toBe(0);
  });

  it("orang yang tak terjangkau tidak masuk peta", () => {
    expect(petaHop(AKU, [tepi(AKU, B)], [tepi(B, C)], new Set()).has(D.toLowerCase())).toBe(false);
  });

  it("pencocokan tidak peka besar-kecil huruf", () => {
    expect(petaHop(AKU.toUpperCase() as Address, [tepi(AKU, B)], [], new Set()).get(B.toLowerCase())).toBe(1);
  });

  // Hanya dirinya sendiri yang ada di dalamnya.
  it("penonton tanpa koneksi hanya memetakan dirinya sendiri", () => {
    const peta = petaHop(AKU, [], [], new Set());
    expect(peta.size).toBe(1);
    expect(peta.get(AKU.toLowerCase())).toBe(0);
  });
});

describe("potongKelompok", () => {
  it("memotong tepat pada ukuran kelompok", () => {
    const k = potongKelompok(Array.from({ length: 250 }, (_, i) => i), 100);
    expect(k.map((b) => b.length)).toEqual([100, 100, 50]);
  });

  it("daftar kosong menghasilkan nol kelompok, bukan satu kelompok kosong", () => {
    expect(potongKelompok([], 100)).toEqual([]);
  });

  it("daftar lebih pendek dari ukuran menghasilkan satu kelompok", () => {
    expect(potongKelompok([1, 2, 3], 100)).toEqual([[1, 2, 3]]);
  });

  it("tidak kehilangan maupun menggandakan satu elemen pun", () => {
    const asal = Array.from({ length: 501 }, (_, i) => `x${i}`);
    const rata = potongKelompok(asal, UKURAN_KELOMPOK).flat();
    expect(rata).toEqual(asal);
  });

  it("menolak ukuran nol, bukan berputar selamanya", () => {
    expect(() => potongKelompok([1, 2], 0)).toThrow();
  });
});

/**
 * PostgREST mengirim `.in(...)` di query string URL GET. 500 post_id
 * sepanjang 66 karakter menghasilkan sekitar 33 KB dalam SATU permintaan, dan
 * proksi Supabase menolaknya — listCandidates melempar, GET /feed jadi 500,
 * feed mati total. Tes ini menjaga tidak ada satu pun `.in()` yang dikirim
 * dengan lebih dari UKURAN_KELOMPOK nilai.
 */
describe("listCandidates memotong setiap .in()", () => {
  type Panggilan = { tabel: string; in: [string, string[]][]; or: string[] };

  function dbPalsu(baris: Record<string, unknown[]>, jejak: Panggilan[]): SupabaseClient {
    const buat = (tabel: string) => {
      const rec: Panggilan = { tabel, in: [], or: [] };
      jejak.push(rec);
      const b = {
        select: () => b,
        gte: () => b,
        is: () => b,
        order: () => b,
        limit: () => b,
        in: (kolom: string, nilai: string[]) => { rec.in.push([kolom, nilai]); return b; },
        or: (ekspresi: string) => { rec.or.push(ekspresi); return b; },
        then: (teruskan: (h: { data: unknown[]; error: null }) => unknown) =>
          teruskan({ data: baris[tabel] ?? [], error: null }),
      };
      return b;
    };
    return { from: (tabel: string) => buat(tabel) } as unknown as SupabaseClient;
  }

  it("tidak pernah mengirim lebih dari UKURAN_KELOMPOK nilai dalam satu .in()", async () => {
    // 500 unggahan, masing-masing dari penulis berbeda — kasus terburuk.
    const posts: PostDbRow[] = Array.from({ length: 500 }, (_, i) => ({
      post_id: `0x${String(i).padStart(64, "0")}`,
      author: `0x${String(i).padStart(40, "0")}`,
      body: "halo",
      image_bucket: null, image_object: null, image_mime: null,
      image_status: "none",
      created_at: "2026-09-07T00:00:00.000Z",
      deleted_at: null,
    }));

    const jejak: Panggilan[] = [];
    const store = createFeedStore(dbPalsu({ posts }, jejak), blokirPalsu());
    await store.listCandidates({ sinceMs: 0, limit: 500, viewer: null, terbukti: false });

    const semuaIn = jejak.flatMap((p) => p.in);
    expect(semuaIn.length).toBeGreaterThan(0);
    for (const [, nilai] of semuaIn) {
      expect(nilai.length).toBeLessThanOrEqual(UKURAN_KELOMPOK);
    }
  });

  // Memotong tidak boleh berarti kehilangan: gabungan seluruh kelompok wajib
  // memuat setiap id, tepat satu kali.
  it("gabungan kelompok memuat seluruh id tanpa yang hilang", async () => {
    const posts: PostDbRow[] = Array.from({ length: 250 }, (_, i) => ({
      post_id: `0x${String(i).padStart(64, "0")}`,
      author: `0x${String(i).padStart(40, "0")}`,
      body: "halo",
      image_bucket: null, image_object: null, image_mime: null,
      image_status: "none",
      created_at: "2026-09-07T00:00:00.000Z",
      deleted_at: null,
    }));

    const jejak: Panggilan[] = [];
    const store = createFeedStore(dbPalsu({ posts }, jejak), blokirPalsu());
    await store.listCandidates({ sinceMs: 0, limit: 250, viewer: null, terbukti: false });

    const idTerkirim = jejak
      .filter((p) => p.tabel === "post_likes")
      .flatMap((p) => p.in.flatMap(([, nilai]) => nilai));
    expect(idTerkirim).toHaveLength(250);
    expect(new Set(idTerkirim).size).toBe(250);
  });
});

/**
 * Tes ini menjalankan penyaringan blokir yang SEBENARNYA lewat
 * createFeedStore(...).listCandidates(...) dengan viewer terisi dan
 * himpunanUntuk yang TIDAK kosong — bukan lewat petaHop secara langsung.
 * Tanpa tes ini, menghapus `.filter(...)` di listCandidates tidak akan
 * membuat tes mana pun merah (lihat temuan review Task 9).
 */
describe("listCandidates menyaring blokir dua arah", () => {
  type Panggilan = { tabel: string; in: [string, string[]][]; or: string[] };

  function dbPalsu(baris: Record<string, unknown[]>, jejak: Panggilan[]): SupabaseClient {
    const buat = (tabel: string) => {
      const rec: Panggilan = { tabel, in: [], or: [] };
      jejak.push(rec);
      const b = {
        select: () => b,
        gte: () => b,
        is: () => b,
        order: () => b,
        limit: () => b,
        in: (kolom: string, nilai: string[]) => { rec.in.push([kolom, nilai]); return b; },
        or: (ekspresi: string) => { rec.or.push(ekspresi); return b; },
        then: (teruskan: (h: { data: unknown[]; error: null }) => unknown) =>
          teruskan({ data: baris[tabel] ?? [], error: null }),
      };
      return b;
    };
    return { from: (tabel: string) => buat(tabel) } as unknown as SupabaseClient;
  }

  function blokirPalsuDengan(himpunan: Set<string>) {
    return {
      setBlokir: vi.fn(async () => {}),
      adaBlokir: vi.fn(async () => false),
      diblokirOleh: vi.fn(async () => []),
      himpunanUntuk: vi.fn(async (_who: Address) => himpunan),
      pemblokirUntuk: vi.fn(async (_who: Address) => new Set<string>()),
    } satisfies BlokirStore;
  }

  const VIEWER = "0x00000000000000000000000000000000000000aa" as Address;
  // Penonton memblokir dia.
  const DIBLOKIR = "0x00000000000000000000000000000000000000bb";
  // Dia memblokir penonton — arah sebaliknya, dan himpunanUntuk (Task 5)
  // sudah simetris, jadi keduanya berakhir di himpunan yang sama.
  const MEMBLOKIR = "0x00000000000000000000000000000000000000cc";
  // Tidak terkait blokir sama sekali — wajib tetap ada di hasil.
  const LAIN = "0x00000000000000000000000000000000000000dd";

  function postDari(author: string, idAngka: number): PostDbRow {
    return {
      post_id: `0x${String(idAngka).padStart(64, "0")}`,
      author,
      body: "halo",
      image_bucket: null, image_object: null, image_mime: null, image_status: "none",
      created_at: "2026-09-07T00:00:00.000Z",
      deleted_at: null,
    };
  }

  it("membuang unggahan dari kedua arah blokir tapi menyisakan penonton sendiri dan orang tak terkait", async () => {
    const posts: PostDbRow[] = [
      postDari(VIEWER, 1), // milik penonton sendiri — wajib tetap
      // Huruf besar di baris DB: membuktikan penyaringan menormalkan huruf
      // sebelum dibandingkan dengan himpunan terblokir (yang selalu huruf kecil).
      postDari(DIBLOKIR.toUpperCase(), 2),
      postDari(MEMBLOKIR, 3),
      postDari(LAIN, 4), // tak terkait — wajib tetap
    ];

    const jejak: Panggilan[] = [];
    const terblokir = new Set([DIBLOKIR.toLowerCase(), MEMBLOKIR.toLowerCase()]);
    const store = createFeedStore(dbPalsu({ posts }, jejak), blokirPalsuDengan(terblokir));
    const hasil = await store.listCandidates({ sinceMs: 0, limit: 10, viewer: VIEWER, terbukti: true });

    const penulisTersisa = hasil.map((p) => p.author.toLowerCase());
    expect(penulisTersisa).toContain(VIEWER.toLowerCase());
    expect(penulisTersisa).toContain(LAIN.toLowerCase());
    expect(penulisTersisa).not.toContain(DIBLOKIR.toLowerCase());
    expect(penulisTersisa).not.toContain(MEMBLOKIR.toLowerCase());
    expect(hasil).toHaveLength(2);
  });

  /**
   * C1 review akhir 4a — INVARIAN. Keluaran feed untuk `who` yang TIDAK
   * terbukti tidak boleh bergantung pada tabel `blocks` sama sekali. Kalau
   * bergantung, `GET /feed` vs `GET /feed?who=A` (gratis, tanpa tanda
   * tangan) menyingkap siapa yang punya hubungan blokir dengan A: penulis yang
   * hilang dari yang kedua, dan `hop` yang bergeser.
   *
   * Dua lapis bukti: `himpunanUntuk` TIDAK dipanggil sama sekali, DAN hasil
   * dengan dunia blokir kosong identik dengan hasil dengan dunia blokir
   * penuh — termasuk `hop` orang ketiga yang hanya terjangkau lewat orang
   * yang diblokir.
   */
  it("who TIDAK terbukti: himpunanUntuk tidak dipanggil, unggahan terkait blokir tetap ada, hop tak bergeser", async () => {
    const posts: PostDbRow[] = [
      postDari(VIEWER, 1), postDari(DIBLOKIR, 2), postDari(MEMBLOKIR, 3), postDari(LAIN, 4),
    ];
    // VIEWER — DIBLOKIR — LAIN: LAIN dua lompatan, dan hanya lewat DIBLOKIR.
    const connections = [
      { addr_a: VIEWER, addr_b: DIBLOKIR }, { addr_a: DIBLOKIR, addr_b: LAIN },
    ];

    const penuh = blokirPalsuDengan(new Set([DIBLOKIR, MEMBLOKIR]));
    const kosong = blokirPalsuDengan(new Set());
    const denganBlokir = await createFeedStore(dbPalsu({ posts, connections }, []), penuh)
      .listCandidates({ sinceMs: 0, limit: 10, viewer: VIEWER, terbukti: false });
    const tanpaBlokir = await createFeedStore(dbPalsu({ posts, connections }, []), kosong)
      .listCandidates({ sinceMs: 0, limit: 10, viewer: VIEWER, terbukti: false });

    expect(penuh.himpunanUntuk).not.toHaveBeenCalled();
    expect(penuh.pemblokirUntuk).not.toHaveBeenCalled();
    expect(denganBlokir).toEqual(tanpaBlokir);

    const penulis = denganBlokir.map((p) => p.author.toLowerCase());
    expect(penulis).toContain(DIBLOKIR);
    expect(penulis).toContain(MEMBLOKIR);
    expect(denganBlokir.find((p) => p.author === DIBLOKIR)?.hop).toBe(1);
    expect(denganBlokir.find((p) => p.author === LAIN)?.hop).toBe(2);
  });

  it("who TERBUKTI: himpunan blokir dimuat untuk penonton itu, unggahan disaring, hop lewat yang diblokir putus", async () => {
    const posts: PostDbRow[] = [
      postDari(VIEWER, 1), postDari(DIBLOKIR, 2), postDari(MEMBLOKIR, 3), postDari(LAIN, 4),
    ];
    const connections = [
      { addr_a: VIEWER, addr_b: DIBLOKIR }, { addr_a: DIBLOKIR, addr_b: LAIN },
    ];
    const penuh = blokirPalsuDengan(new Set([DIBLOKIR, MEMBLOKIR]));
    const hasil = await createFeedStore(dbPalsu({ posts, connections }, []), penuh)
      .listCandidates({ sinceMs: 0, limit: 10, viewer: VIEWER, terbukti: true });

    expect(penuh.himpunanUntuk).toHaveBeenCalledWith(VIEWER);
    const penulis = hasil.map((p) => p.author.toLowerCase());
    expect(penulis).not.toContain(DIBLOKIR);
    expect(penulis).not.toContain(MEMBLOKIR);
    expect(hasil.find((p) => p.author === LAIN)?.hop).toBeNull();
  });

  /**
   * Kebocoran yang sama kelasnya dengan C1, ada sejak Fase 3b: `sudahSuka`
   * dihitung untuk `who` mana pun, jadi `GET /feed?who=A` tanpa tanda tangan
   * menyingkap unggahan mana yang disukai A. Tidak ada rute lain yang
   * memperlihatkan siapa menyukai apa — hanya jumlahnya yang publik.
   */
  it("who TIDAK terbukti: sudahSuka selalu false, jumlah suka tetap terhitung", async () => {
    const posts: PostDbRow[] = [postDari(LAIN, 4)];
    const idLain = postDari(LAIN, 4).post_id;
    const post_likes = [{ post_id: idLain, address: VIEWER }];

    const hasil = await createFeedStore(dbPalsu({ posts, post_likes }, []), blokirPalsuDengan(new Set()))
      .listCandidates({ sinceMs: 0, limit: 10, viewer: VIEWER, terbukti: false });

    expect(hasil[0]?.likeCount).toBe(1);
    expect(hasil[0]?.sudahSuka).toBe(false);
  });

  it("who TERBUKTI: sudahSuka mencerminkan suka penonton itu", async () => {
    const posts: PostDbRow[] = [postDari(LAIN, 4), postDari(MEMBLOKIR, 3)];
    const idLain = postDari(LAIN, 4).post_id;
    // Huruf besar di baris suka: perbandingannya harus menormalkan huruf.
    const post_likes = [{ post_id: idLain, address: VIEWER.toUpperCase() }];

    const hasil = await createFeedStore(dbPalsu({ posts, post_likes }, []), blokirPalsuDengan(new Set()))
      .listCandidates({ sinceMs: 0, limit: 10, viewer: VIEWER, terbukti: true });

    expect(hasil.find((p) => p.author === LAIN)?.sudahSuka).toBe(true);
    expect(hasil.find((p) => p.author === MEMBLOKIR)?.sudahSuka).toBe(false);
  });
});
