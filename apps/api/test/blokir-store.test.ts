import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { createBlokirStore } from "../src/blokir-store";
import { PAGE_SIZE } from "../src/trust/store";

const A = "0x00000000000000000000000000000000000000aa" as Address;
const B = "0x00000000000000000000000000000000000000bb" as Address;

/** Alamat unik ke-i, huruf kecil. Digeser jauh supaya tidak pernah
 * bertabrakan dengan A (0x…aa) atau B (0x…bb). */
const alamatKe = (i: number) => `0x${(0x1000000 + i).toString(16).padStart(40, "0")}`;

type Opsi = {
  /** Kalau diisi, SETIAP jalur resolusi mengembalikan `{ error }`. */
  galat?: string | null;
  /** Kalau diisi, hanya permintaan ber-`range` yang mulai di/sesudah indeks
   * ini yang gagal — untuk membuktikan galat di halaman KEDUA ikut melempar. */
  galatMulaiDari?: number;
};

/**
 * Klien palsu yang MEREKAM panggilan, supaya bentuk kuerinya bisa diasersi.
 *
 * `galat`, kalau diisi, membuat SETIAP jalur resolusi (select, upsert,
 * delete) mengembalikan `{ error }` alih-alih sukses — supaya setiap titik
 * `if (error) throw` di blokir-store.ts punya jalur tes yang benar-benar
 * menjalankannya, bukan cuma jalur bahagia.
 *
 * Meniru PostgREST dalam hal yang paling berbahaya: SETIAP select dipotong
 * di PAGE_SIZE baris tanpa galat apa pun. Select tanpa `.range()` hanya
 * pernah melihat 1000 baris pertama; select dengan `.range(f, t)` melihat
 * irisan itu. Tanpa peniruan ini, tes ">1000 baris" akan lolos juga untuk
 * pembacaan satu halaman.
 */
function dbPalsu(hasil: Record<string, unknown>[] = [], opsi: Opsi = {}) {
  const { galat = null, galatMulaiDari } = opsi;
  const panggilan: { tabel: string; op: string; arg: unknown }[] = [];
  const hasilError = { error: { message: galat ?? "halaman gagal" } };
  const rantai = (tabel: string, rentang: [number, number] | null = null): Record<string, unknown> => ({
    select: () => rantai(tabel, rentang),
    eq: (kolom: string, nilai: unknown) => {
      panggilan.push({ tabel, op: `eq:${kolom}`, arg: nilai });
      return rantai(tabel, rentang);
    },
    or: (klausa: string) => {
      panggilan.push({ tabel, op: "or", arg: klausa });
      return rantai(tabel, rentang);
    },
    order: (kolom: string, o?: { ascending?: boolean }) => {
      panggilan.push({ tabel, op: `order:${kolom}`, arg: o?.ascending ?? true });
      return rantai(tabel, rentang);
    },
    range: (dari: number, sampai: number) => {
      panggilan.push({ tabel, op: "range", arg: [dari, sampai] });
      return rantai(tabel, [dari, sampai]);
    },
    limit: () => rantai(tabel, rentang),
    then: (r: (v: unknown) => unknown) => {
      if (galat) return r({ data: null, ...hasilError });
      if (galatMulaiDari !== undefined && rentang && rentang[0] >= galatMulaiDari) {
        return r({ data: null, ...hasilError });
      }
      const [dari, sampai] = rentang ?? [0, Number.MAX_SAFE_INTEGER];
      const akhir = Math.min(sampai + 1, dari + PAGE_SIZE, hasil.length);
      return r({ data: hasil.slice(dari, akhir), error: null });
    },
    upsert: (baris: unknown) => {
      panggilan.push({ tabel, op: "upsert", arg: baris });
      return { then: (r: (v: unknown) => unknown) => r(galat ? hasilError : { error: null }) };
    },
    delete: () => ({
      eq: (kolom: string, nilai: unknown) => {
        panggilan.push({ tabel, op: `delete-eq:${kolom}`, arg: nilai });
        return {
          eq: (k2: string, v2: unknown) => {
            panggilan.push({ tabel, op: `delete-eq:${k2}`, arg: v2 });
            return { then: (r: (v: unknown) => unknown) => r(galat ? hasilError : { error: null }) };
          },
        };
      },
    }),
  });
  return { db: { from: (t: string) => rantai(t) } as never, panggilan };
}

describe("createBlokirStore", () => {
  it("setBlokir(true) menulis baris huruf kecil", async () => {
    const { db, panggilan } = dbPalsu();
    await createBlokirStore(db).setBlokir(A, B, true);
    const up = panggilan.find((p) => p.op === "upsert");
    expect(up?.tabel).toBe("blocks");
    expect(up?.arg).toEqual({ blocker: A.toLowerCase(), blocked: B.toLowerCase() });
  });

  it("setBlokir(false) MENGHAPUS baris, bukan menulis bendera", async () => {
    const { db, panggilan } = dbPalsu();
    await createBlokirStore(db).setBlokir(A, B, false);
    expect(panggilan.some((p) => p.op.startsWith("delete-eq:blocker"))).toBe(true);
    expect(panggilan.some((p) => p.op === "upsert")).toBe(false);
  });

  // Blokir DUA ARAH: himpunan penyaring tidak peduli siapa yang memulai.
  // Kalau hanya satu arah yang dibaca, orang yang memblokirmu tetap muncul di
  // feedmu — separuh fitur ini bocor tanpa satu galat pun.
  it("himpunanUntuk membaca KEDUA arah", async () => {
    const { db, panggilan } = dbPalsu([
      { blocker: A.toLowerCase(), blocked: B.toLowerCase() },
      { blocker: "0x00000000000000000000000000000000000000cc", blocked: A.toLowerCase() },
    ]);
    const set = await createBlokirStore(db).himpunanUntuk(A);
    const klausa = panggilan.find((p) => p.op === "or")?.arg as string;
    expect(klausa).toContain("blocker.eq.");
    expect(klausa).toContain("blocked.eq.");
    // Alamat SENDIRI tidak boleh ikut masuk himpunan — kalau ikut, penonton
    // menyaring unggahannya sendiri dari feednya sendiri.
    expect(set.has(A.toLowerCase())).toBe(false);
    expect(set.has(B.toLowerCase())).toBe(true);
    expect(set.has("0x00000000000000000000000000000000000000cc")).toBe(true);
  });

  it("diblokirOleh hanya arah pemblokir", async () => {
    const { db, panggilan } = dbPalsu([
      { blocked: B.toLowerCase(), created_at: "2026-09-08T00:00:00.000Z" },
    ]);
    const baris = await createBlokirStore(db).diblokirOleh(A);
    expect(panggilan.some((p) => p.op === "eq:blocker")).toBe(true);
    expect(panggilan.some((p) => p.op === "or")).toBe(false);
    expect(baris[0]?.address).toBe(B.toLowerCase());
    expect(baris[0]?.atMs).toBe(Date.parse("2026-09-08T00:00:00.000Z"));
  });

  it("adaBlokir memeriksa tepat satu arah", async () => {
    const { db, panggilan } = dbPalsu([{ blocker: A.toLowerCase(), blocked: B.toLowerCase() }]);
    expect(await createBlokirStore(db).adaBlokir(A, B)).toBe(true);
    expect(panggilan.filter((p) => p.op.startsWith("eq:")).length).toBe(2);
  });

  // Galat basis data harus MELEMPAR di setiap titik, bukan diserap jadi
  // hasil kosong/default — persis kegagalan yang bisa membuat blokir diam-
  // diam berhenti berlaku tanpa satu error pun yang terlihat.
  it("setBlokir(true) melempar saat upsert gagal", async () => {
    const { db } = dbPalsu([], { galat: "db mati" });
    await expect(createBlokirStore(db).setBlokir(A, B, true)).rejects.toThrow("db mati");
  });

  it("setBlokir(false) melempar saat delete gagal", async () => {
    const { db } = dbPalsu([], { galat: "db mati" });
    await expect(createBlokirStore(db).setBlokir(A, B, false)).rejects.toThrow("db mati");
  });

  it("adaBlokir melempar, bukan diam-diam mengembalikan false", async () => {
    const { db } = dbPalsu([], { galat: "db mati" });
    await expect(createBlokirStore(db).adaBlokir(A, B)).rejects.toThrow("db mati");
  });

  it("diblokirOleh melempar, bukan diam-diam mengembalikan larik kosong", async () => {
    const { db } = dbPalsu([], { galat: "db mati" });
    await expect(createBlokirStore(db).diblokirOleh(A)).rejects.toThrow("db mati");
  });

  // Titik PALING kritis: himpunanUntuk yang diam-diam mengembalikan himpunan
  // kosong saat basis data gagal berarti semua orang tampak tak-terblokir di
  // feed siapa pun — persis kegagalan yang disebut aturan global tugas ini.
  it("himpunanUntuk melempar, bukan diam-diam mengembalikan himpunan kosong", async () => {
    const { db } = dbPalsu([], { galat: "db mati" });
    await expect(createBlokirStore(db).himpunanUntuk(A)).rejects.toThrow("db mati");
  });
});

/**
 * SATU ARAH: hanya orang yang MEMBLOKIR `who`. Dipakai angka publik dan
 * `penandaHadir` (spec §5.2 yang diamandemen): tanda dari pemblokir T tidak
 * dihitung di angka T, tapi tindakan blokir T sendiri tidak pernah
 * menggerakkan angka T. Kalau metode ini diam-diam membaca dua arah, oracle
 * selisih-angka yang ditutupnya terbuka lagi.
 */
describe("pemblokirUntuk", () => {
  it("hanya membaca baris `blocked = who`, tidak pernah arah sebaliknya", async () => {
    const C = "0x00000000000000000000000000000000000000cc";
    const { db, panggilan } = dbPalsu([{ blocker: C, blocked: A.toLowerCase() }]);
    const set = await createBlokirStore(db).pemblokirUntuk(A);
    expect(panggilan.filter((p) => p.op === "eq:blocked").map((p) => p.arg))
      .toEqual([A.toLowerCase()]);
    expect(panggilan.some((p) => p.op === "eq:blocker")).toBe(false);
    expect(panggilan.some((p) => p.op === "or")).toBe(false);
    expect([...set]).toEqual([C]);
  });

  it("alamat huruf besar di masukan dan baris tetap jadi himpunan huruf kecil", async () => {
    const C = "0x00000000000000000000000000000000000000CC";
    const { db, panggilan } = dbPalsu([{ blocker: C, blocked: A.toLowerCase() }]);
    const set = await createBlokirStore(db).pemblokirUntuk(A.toUpperCase().replace("0X", "0x") as Address);
    expect(panggilan.find((p) => p.op === "eq:blocked")?.arg).toBe(A.toLowerCase());
    expect(set.has(C.toLowerCase())).toBe(true);
  });

  it("alamat sendiri tidak pernah masuk", async () => {
    const { db } = dbPalsu([{ blocker: A.toLowerCase(), blocked: A.toLowerCase() }]);
    expect((await createBlokirStore(db).pemblokirUntuk(A)).size).toBe(0);
  });

  it("melempar, bukan diam-diam mengembalikan himpunan kosong", async () => {
    const { db } = dbPalsu([], { galat: "db mati" });
    await expect(createBlokirStore(db).pemblokirUntuk(A)).rejects.toThrow("db mati");
  });
});

/**
 * I1 review akhir. PostgREST memotong setiap select di 1000 baris TANPA
 * galat, dalam urutan arbitrer. Penyerang yang membuat 1000 kunci sekali
 * pakai yang semuanya memblokir korban V bisa mendorong blokir V terhadap
 * penyerang keluar dari himpunan V — dan unggahan penyerang kembali muncul
 * di feed V. Setiap pembaca himpunan wajib membaca SEMUA halaman, dengan
 * urutan total yang stabil (PK `(blocker, blocked)` unik) supaya batas
 * halaman tidak melewatkan atau menggandakan baris.
 */
describe("pembacaan blokir melewati 1000 baris", () => {
  const JUMLAH = PAGE_SIZE * 2 + 500;

  function banjir(korban: string) {
    // 2000+ kunci sekali pakai memblokir korban, lalu SATU baris yang
    // penting — korban memblokir penyerang — di posisi terakhir.
    const baris: Record<string, string>[] = [];
    for (let i = 1; i < JUMLAH; i++) baris.push({ blocker: alamatKe(i), blocked: korban });
    baris.push({ blocker: korban, blocked: alamatKe(0xdead) });
    return baris;
  }

  it("himpunanUntuk mengembalikan SEMUA baris, termasuk yang di halaman terakhir", async () => {
    const { db } = dbPalsu(banjir(A.toLowerCase()));
    const set = await createBlokirStore(db).himpunanUntuk(A);
    expect(set.size).toBe(JUMLAH);
    expect(set.has(alamatKe(0xdead))).toBe(true);
  });

  it("himpunanUntuk berurutan total (blocker, blocked) dan berhalaman", async () => {
    const { db, panggilan } = dbPalsu(banjir(A.toLowerCase()));
    await createBlokirStore(db).himpunanUntuk(A);
    const urutan = panggilan.filter((p) => p.op.startsWith("order:")).map((p) => p.op);
    expect(urutan.slice(0, 2)).toEqual(["order:blocker", "order:blocked"]);
    expect(panggilan.filter((p) => p.op === "range").length).toBe(3);
  });

  it("himpunanUntuk melempar kalau halaman KEDUA gagal, bukan mengembalikan sebagian", async () => {
    const { db } = dbPalsu(banjir(A.toLowerCase()), { galatMulaiDari: PAGE_SIZE });
    await expect(createBlokirStore(db).himpunanUntuk(A)).rejects.toThrow("halaman gagal");
  });

  it("pemblokirUntuk mengembalikan SEMUA pemblokir melewati 1000", async () => {
    const baris = [];
    for (let i = 1; i <= JUMLAH; i++) baris.push({ blocker: alamatKe(i), blocked: A.toLowerCase() });
    const { db, panggilan } = dbPalsu(baris);
    const set = await createBlokirStore(db).pemblokirUntuk(A);
    expect(set.size).toBe(JUMLAH);
    expect(set.has(alamatKe(JUMLAH))).toBe(true);
    const urutan = panggilan.filter((p) => p.op.startsWith("order:")).map((p) => p.op);
    expect(urutan.slice(0, 2)).toEqual(["order:blocker", "order:blocked"]);
  });

  it("pemblokirUntuk melempar kalau halaman kedua gagal", async () => {
    const baris = [];
    for (let i = 1; i <= JUMLAH; i++) baris.push({ blocker: alamatKe(i), blocked: A.toLowerCase() });
    const { db } = dbPalsu(baris, { galatMulaiDari: PAGE_SIZE });
    await expect(createBlokirStore(db).pemblokirUntuk(A)).rejects.toThrow("halaman gagal");
  });

  // M4: yang terlihat/tercabut di layar daftar blokir. Orang yang memblokir
  // lebih dari 1000 alamat tidak boleh kehilangan tombol cabut untuk sisanya.
  it("diblokirOleh mengembalikan SEMUA baris, terbaru dulu dengan pemecah seri stabil", async () => {
    const baris = [];
    for (let i = 1; i <= JUMLAH; i++) {
      baris.push({ blocked: alamatKe(i), created_at: "2026-09-08T00:00:00.000Z" });
    }
    const { db, panggilan } = dbPalsu(baris);
    const hasil = await createBlokirStore(db).diblokirOleh(A);
    expect(hasil).toHaveLength(JUMLAH);
    expect(hasil[JUMLAH - 1]?.address).toBe(alamatKe(JUMLAH));
    const urutan = panggilan.filter((p) => p.op.startsWith("order:"));
    expect(urutan.slice(0, 2).map((p) => [p.op, p.arg]))
      .toEqual([["order:created_at", false], ["order:blocked", true]]);
  });

  it("diblokirOleh melempar kalau halaman kedua gagal", async () => {
    const baris = [];
    for (let i = 1; i <= JUMLAH; i++) {
      baris.push({ blocked: alamatKe(i), created_at: "2026-09-08T00:00:00.000Z" });
    }
    const { db } = dbPalsu(baris, { galatMulaiDari: PAGE_SIZE });
    await expect(createBlokirStore(db).diblokirOleh(A)).rejects.toThrow("halaman gagal");
  });
});
