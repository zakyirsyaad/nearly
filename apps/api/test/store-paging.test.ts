import { describe, expect, it, vi } from "vitest";
import { fetchAllPages, PAGE_SIZE } from "../src/trust/store";

type Row = { n: number };

/**
 * Meniru PostgREST: server memotong tiap permintaan pada pageSize, berapa pun
 * rentang yang diminta. Inilah perilaku yang membuat pengambilan tanpa halaman
 * berbahaya — ia mengembalikan sebagian data tanpa error apa pun.
 */
function serverDenganBatas(total: number, pageSize = PAGE_SIZE) {
  const fetchPage = vi.fn(async (from: number, to: number) => {
    const akhir = Math.min(to + 1, from + pageSize, total);
    const data: Row[] = [];
    for (let i = from; i < akhir; i++) data.push({ n: i });
    return { data, error: null };
  });
  return { fetchPage };
}

describe("fetchAllPages", () => {
  it("GERBANG: mengambil SEMUA baris walau server memotong tiap permintaan", async () => {
    // Inti kerentanan yang ditutup: 2500 koneksi di server yang membalas
    // maksimal 1000 per permintaan. Tanpa paginasi, graf terpotong di 1000 dan
    // setiap skor diam-diam salah — tanpa satu pun error.
    const { fetchPage } = serverDenganBatas(2500);
    const rows = await fetchAllPages<Row>(fetchPage, "baca koneksi");

    expect(rows).toHaveLength(2500);
    expect(rows[0]).toEqual({ n: 0 });
    expect(rows[2499]).toEqual({ n: 2499 });
  });

  it("baris kembali berurutan, tidak teracak antar halaman", async () => {
    const { fetchPage } = serverDenganBatas(2500);
    const rows = await fetchAllPages<Row>(fetchPage, "baca koneksi");
    expect(rows.map((r) => r.n)).toEqual(rows.map((_, i) => i));
  });

  it("data lebih kecil dari satu halaman cukup satu permintaan", async () => {
    const { fetchPage } = serverDenganBatas(3);
    const rows = await fetchAllPages<Row>(fetchPage, "baca koneksi");
    expect(rows).toHaveLength(3);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it("data tepat sebesar satu halaman butuh permintaan kedua untuk tahu sudah habis", async () => {
    const { fetchPage } = serverDenganBatas(PAGE_SIZE);
    const rows = await fetchAllPages<Row>(fetchPage, "baca koneksi");
    expect(rows).toHaveLength(PAGE_SIZE);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("tabel kosong menghasilkan array kosong, bukan error", async () => {
    const { fetchPage } = serverDenganBatas(0);
    expect(await fetchAllPages<Row>(fetchPage, "baca koneksi")).toEqual([]);
  });

  it("error di halaman mana pun dilempar, tidak dikembalikan sebagian", async () => {
    // Mengembalikan sebagian data setelah kegagalan adalah kegagalan senyap
    // yang sama dengan pemotongan: grafnya salah, tapi terlihat baik-baik saja.
    const fetchPage = vi.fn(async (from: number) =>
      from === 0
        ? { data: Array.from({ length: PAGE_SIZE }, (_, i) => ({ n: i })), error: null }
        : { data: null, error: { message: "koneksi terputus" } },
    );
    await expect(fetchAllPages<Row>(fetchPage, "baca koneksi")).rejects.toThrow(
      /baca koneksi gagal: koneksi terputus/,
    );
  });

  it("data null tanpa error diperlakukan sebagai halaman kosong", async () => {
    const fetchPage = vi.fn(async () => ({ data: null, error: null }));
    expect(await fetchAllPages<Row>(fetchPage, "baca koneksi")).toEqual([]);
  });
});
