import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import {
  AMBANG_LAPORAN, FEED_LIMIT, rankFeed, SLOT_PENDATANG, sisipkanPendatang, terlihat,
} from "../src/feed-rank";
import type { FeedCandidate } from "../src/ports";

const NOW = 1_800_000_000_000;
const JAM = 3_600_000;
const SP = "https://sp.example";
// KOREKSI dari brief: "...me" bukan heksadesimal sah (m bukan digit heksa).
// feed-rank hanya membandingkan string lowercase jadi ini "kebetulan" jalan,
// tapi alamat tidak sah di fixture bisa menyesatkan saat tes gagal karena
// alasan lain. Diganti jadi heksadesimal sah.
const AKU = "0x00000000000000000000000000000000000000ae" as Address;

let urut = 0;
function kandidat(over: Partial<FeedCandidate> = {}): FeedCandidate {
  urut += 1;
  return {
    postId: `0x${String(urut).padStart(64, "0")}` as Hex,
    author: "0x000000000000000000000000000000000000aaaa" as Address,
    displayName: "Andi",
    body: "halo", imageBucket: null, imageObject: null, imageMime: null,
    imageStatus: "none", createdAtMs: NOW, deleted: false,
    authorRatio: 0.01, authorTier: 1, authorConnections: 5, authorSlashed: false,
    reportCount: 0, likeCount: 0, sudahSuka: false, hop: 1,
    ...over,
  };
}

const peringkat = (c: FeedCandidate[], viewer: Address | null = AKU) =>
  rankFeed(c, { nowMs: NOW, viewer, spEndpoint: SP });

describe("terlihat — penyaring visibilitas (spec §7)", () => {
  it("membuang unggahan penulis yang ter-slash", () => {
    expect(terlihat(kandidat({ authorSlashed: true }), AKU)).toBe(false);
  });

  it("membuang unggahan yang mencapai ambang laporan", () => {
    expect(terlihat(kandidat({ reportCount: AMBANG_LAPORAN }), AKU)).toBe(false);
  });

  it("mempertahankan unggahan satu laporan di bawah ambang", () => {
    expect(terlihat(kandidat({ reportCount: AMBANG_LAPORAN - 1 }), AKU)).toBe(true);
  });

  it("membuang unggahan yang sudah dihapus", () => {
    expect(terlihat(kandidat({ deleted: true }), AKU)).toBe(false);
  });

  // Spec §7: dua sebab pertama tidak berlaku untuk unggahan sendiri.
  it("penulis tetap melihat unggahannya sendiri walau ter-slash", () => {
    expect(terlihat(kandidat({ author: AKU, authorSlashed: true }), AKU)).toBe(true);
  });

  it("penulis tetap melihat unggahannya sendiri walau melewati ambang laporan", () => {
    expect(terlihat(kandidat({ author: AKU, reportCount: 99 }), AKU)).toBe(true);
  });

  // Batas pengecualian itu. Menghapus harus berarti menghapus.
  it("unggahan yang DIHAPUS tidak terlihat bahkan oleh penulisnya", () => {
    expect(terlihat(kandidat({ author: AKU, deleted: true }), AKU)).toBe(false);
  });

  it("pencocokan penulis tidak peka besar-kecil huruf", () => {
    const c = kandidat({ author: AKU.toUpperCase() as Address, authorSlashed: true });
    expect(terlihat(c, AKU)).toBe(true);
  });

  // Status gambar BUKAN sebab penyaringan (spec §7).
  it("gambar pending atau failed tidak menyembunyikan unggahan dari siapa pun", () => {
    expect(terlihat(kandidat({ imageStatus: "pending" }), AKU)).toBe(true);
    expect(terlihat(kandidat({ imageStatus: "failed" }), null)).toBe(true);
  });
});

describe("rankFeed — urutan", () => {
  it("unggahan 1 hop di atas unggahan luar jaringan yang identik", () => {
    const dekat = kandidat({ hop: 1, author: "0x1111111111111111111111111111111111111111" as Address });
    const jauh = kandidat({ hop: null, author: "0x2222222222222222222222222222222222222222" as Address });
    expect(peringkat([jauh, dekat])[0]!.postId).toBe(dekat.postId);
  });

  it("membuang seluruh unggahan yang tidak lolos penyaring", () => {
    expect(peringkat([kandidat({ deleted: true }), kandidat({ authorSlashed: true })]))
      .toHaveLength(0);
  });

  /**
   * Inti spec §6.3 dan §3.1: tanpa kompresi log, satu penulis ber-rasio
   * sangat tinggi akan menguasai seluruh feed karena peluruhan diversitas
   * tidak menggigit. Dengan kompresi, ia tidak boleh mengisi seluruh 5 besar.
   */
  it("satu penulis ber-rasio tertinggi tidak menguasai lima besar", () => {
    const raja = "0x000000000000000000000000000000000000ffff" as Address;
    const banyak = Array.from({ length: 10 }, () =>
      kandidat({ author: raja, authorRatio: 1 }));
    const lain = Array.from({ length: 10 }, (_, i) =>
      kandidat({
        author: `0x${String(i + 1).repeat(40).slice(0, 40)}` as Address,
        authorRatio: 0.001,
      }));
    const limaBesar = peringkat([...banyak, ...lain]).slice(0, 5);
    const dariRaja = limaBesar.filter((r) => r.author.toLowerCase() === raja.toLowerCase());
    expect(dariRaja.length).toBeLessThan(5);
  });

  it("urutan deterministik untuk skor yang sama", () => {
    const a = kandidat({ postId: `0x${"a".repeat(64)}` as Hex });
    const b = kandidat({ postId: `0x${"b".repeat(64)}` as Hex });
    expect(peringkat([a, b]).map((r) => r.postId))
      .toEqual(peringkat([b, a]).map((r) => r.postId));
  });

  it("tidak pernah mengembalikan lebih dari FEED_LIMIT baris", () => {
    const banyak = Array.from({ length: FEED_LIMIT + 40 }, (_, i) =>
      kandidat({ author: `0x${String(i).padStart(40, "0")}` as Address }));
    expect(peringkat(banyak)).toHaveLength(FEED_LIMIT);
  });
});

describe("rankFeed — penonton anonim (spec §6.5)", () => {
  it("hop selalu null dan sudahSuka selalu false", () => {
    const rows = rankFeed([kandidat({ hop: 1, sudahSuka: true })],
      { nowMs: NOW, viewer: null, spEndpoint: SP });
    expect(rows[0]!.hop).toBeNull();
    expect(rows[0]!.sudahSuka).toBe(false);
  });

  // Pengali seragam tidak mengubah urutan — karena itu tidak ada cabang khusus.
  it("urutan anonim sama dengan urutan penonton nol koneksi", () => {
    const bahan = [
      kandidat({ authorRatio: 0.5, author: "0x1111111111111111111111111111111111111111" as Address }),
      kandidat({ authorRatio: 0.01, author: "0x2222222222222222222222222222222222222222" as Address }),
    ];
    const anonim = rankFeed(bahan.map((c) => ({ ...c, hop: null })),
      { nowMs: NOW, viewer: null, spEndpoint: SP });
    const nolKoneksi = rankFeed(bahan.map((c) => ({ ...c, hop: null })),
      { nowMs: NOW, viewer: AKU, spEndpoint: SP });
    expect(anonim.map((r) => r.postId)).toEqual(nolKoneksi.map((r) => r.postId));
  });
});

describe("sisipkanPendatang (spec §6.6)", () => {
  const utama = () => Array.from({ length: FEED_LIMIT }, (_, i) =>
    kandidat({ author: `0x${String(i).padStart(40, "0")}` as Address, authorConnections: 9 }));

  it("menyisipkan pendatang layak di posisi yang disediakan", () => {
    const baru = kandidat({ authorConnections: 1, createdAtMs: NOW - JAM });
    const hasil = sisipkanPendatang(utama(), [baru], NOW);
    expect(hasil[SLOT_PENDATANG[0]!]!.postId).toBe(baru.postId);
  });

  it("panjang hasil tidak berubah — pendatang menggeser yang terbawah", () => {
    const baru = kandidat({ authorConnections: 2, createdAtMs: NOW });
    expect(sisipkanPendatang(utama(), [baru], NOW)).toHaveLength(FEED_LIMIT);
  });

  /**
   * Batas bawah 1 koneksi, dan ini bukan kosmetik: posting terbuka untuk
   * siapa pun, dan akun bot punya NOL koneksi. Tanpa batas bawah, setiap bot
   * memenuhi syarat "kurang dari 3" dan slot ini berubah jadi jalur cepat
   * bagi bot ke posisi tetap di feed.
   */
  it("penulis NOL koneksi tidak pernah mendapat slot", () => {
    const bot = kandidat({ authorConnections: 0, createdAtMs: NOW });
    const hasil = sisipkanPendatang(utama(), [bot], NOW);
    expect(hasil.map((c) => c.postId)).not.toContain(bot.postId);
  });

  it("penulis dengan 3 koneksi atau lebih tidak mendapat slot", () => {
    const mapan = kandidat({ authorConnections: 3, createdAtMs: NOW });
    const hasil = sisipkanPendatang(utama(), [mapan], NOW);
    expect(hasil.map((c) => c.postId)).not.toContain(mapan.postId);
  });

  it("unggahan lebih tua dari 48 jam tidak mendapat slot", () => {
    const basi = kandidat({ authorConnections: 1, createdAtMs: NOW - 49 * JAM });
    const hasil = sisipkanPendatang(utama(), [basi], NOW);
    expect(hasil.map((c) => c.postId)).not.toContain(basi.postId);
  });

  it("tanpa kandidat layak, hasilnya tidak berubah sama sekali", () => {
    const asal = utama();
    expect(sisipkanPendatang(asal, [], NOW).map((c) => c.postId))
      .toEqual(asal.map((c) => c.postId));
  });
});

describe("rankFeed — pemetaan baris", () => {
  it("membangun imageUrl hanya saat status ready", () => {
    const siap = kandidat({
      imageStatus: "ready", imageBucket: "nearly-feed", imageObject: "x.jpg",
    });
    expect(peringkat([siap])[0]!.imageUrl).toBe(`${SP}/view/nearly-feed/x.jpg`);
  });

  it("imageUrl null selama status masih pending", () => {
    const menunggu = kandidat({
      imageStatus: "pending", imageBucket: "nearly-feed", imageObject: "x.jpg",
    });
    expect(peringkat([menunggu])[0]!.imageUrl).toBeNull();
  });

  it("meneruskan displayName, tier, likeCount, dan hop", () => {
    const c = kandidat({ displayName: "Budi", authorTier: 2, likeCount: 7, hop: 2 });
    const row = peringkat([c])[0]!;
    expect(row.displayName).toBe("Budi");
    expect(row.tier).toBe(2);
    expect(row.likeCount).toBe(7);
    expect(row.hop).toBe(2);
  });
});
