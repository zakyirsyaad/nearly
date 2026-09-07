import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createFeedStore, petaHop, potongKelompok, rowToPost, UKURAN_KELOMPOK,
  type PostDbRow,
} from "../src/feed-store";

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
    expect(petaHop(AKU, [tepi(AKU, B)], []).get(B.toLowerCase())).toBe(1);
  });

  it("koneksi dari koneksi berjarak 2 lompatan", () => {
    expect(petaHop(AKU, [tepi(AKU, B)], [tepi(B, C)]).get(C.toLowerCase())).toBe(2);
  });

  it("arah tepi tidak penting", () => {
    expect(petaHop(AKU, [tepi(B, AKU)], []).get(B.toLowerCase())).toBe(1);
  });

  // Satu lompatan menang atas dua: kalau seseorang bisa dicapai lewat kedua
  // jalur, yang lebih dekat yang berlaku.
  it("1 lompatan tidak diturunkan menjadi 2", () => {
    expect(petaHop(AKU, [tepi(AKU, B), tepi(AKU, C)], [tepi(B, C)]).get(C.toLowerCase())).toBe(1);
  });

  /**
   * Penonton memetakan DIRINYA SENDIRI ke 0. Sebelumnya ia dikeluarkan dari
   * peta, jadi unggahannya sendiri tiba dengan `hop: null` — kartunya berbunyi
   * "Di luar jaringanmu" untuk unggahan penulisnya sendiri, dan penilai
   * mengalikan skornya dengan JARAK_LUAR 0.3.
   */
  it("penonton memetakan dirinya sendiri ke 0", () => {
    expect(petaHop(AKU, [tepi(AKU, B)], [tepi(B, AKU)]).get(AKU.toLowerCase())).toBe(0);
  });

  it("0 tidak bisa diturunkan menjadi 1 atau 2 oleh tepi mana pun", () => {
    const peta = petaHop(AKU, [tepi(AKU, B), tepi(AKU, AKU)], [tepi(B, AKU)]);
    expect(peta.get(AKU.toLowerCase())).toBe(0);
  });

  it("0 dipetakan tanpa peduli besar-kecil huruf alamat penonton", () => {
    const peta = petaHop(AKU.toUpperCase() as Address, [], []);
    expect(peta.get(AKU.toLowerCase())).toBe(0);
  });

  it("orang yang tak terjangkau tidak masuk peta", () => {
    expect(petaHop(AKU, [tepi(AKU, B)], [tepi(B, C)]).has(D.toLowerCase())).toBe(false);
  });

  it("pencocokan tidak peka besar-kecil huruf", () => {
    expect(petaHop(AKU.toUpperCase() as Address, [tepi(AKU, B)], []).get(B.toLowerCase())).toBe(1);
  });

  // Hanya dirinya sendiri yang ada di dalamnya.
  it("penonton tanpa koneksi hanya memetakan dirinya sendiri", () => {
    const peta = petaHop(AKU, [], []);
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
    const store = createFeedStore(dbPalsu({ posts }, jejak));
    await store.listCandidates({ sinceMs: 0, limit: 500, viewer: null });

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
    const store = createFeedStore(dbPalsu({ posts }, jejak));
    await store.listCandidates({ sinceMs: 0, limit: 250, viewer: null });

    const idTerkirim = jejak
      .filter((p) => p.tabel === "post_likes")
      .flatMap((p) => p.in.flatMap(([, nilai]) => nilai));
    expect(idTerkirim).toHaveLength(250);
    expect(new Set(idTerkirim).size).toBe(250);
  });
});
