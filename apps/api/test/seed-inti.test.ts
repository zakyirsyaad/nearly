import { describe, expect, it, vi } from "vitest";
import {
  bacaArgumen, jalankanSeedInti, PERINGATAN_RELAYER, uraiCsvSeedInti, type DepsSeedInti,
} from "../tools/seed-inti-logika";

const A = "0x00000000000000000000000000000000000000Aa";
const B = "0x00000000000000000000000000000000000000bb";

function deps() {
  const keluaran: string[] = [];
  const d = {
    upsertSeeds: vi.fn(async () => {}),
    hitungUlang: vi.fn(async () => ({ computed: 3, published: 1, failed: 0 })),
    cetak: vi.fn((s: string) => { keluaran.push(s); }),
    galat: vi.fn((s: string) => { keluaran.push(s); }),
  } satisfies DepsSeedInti;
  return { d, keluaran };
}

describe("uraiCsvSeedInti", () => {
  it("header, komentar, dan baris kosong diabaikan; alamat dinormalkan huruf kecil", () => {
    const hasil = uraiCsvSeedInti(`address,catatan,bobot\n# panitia\n\n${A},Ketua panitia,2\n${B}, Juri ,1.5\n`);
    expect(hasil).toEqual({
      ok: true,
      baris: [
        { address: A.toLowerCase(), catatan: "Ketua panitia", bobot: 2 },
        { address: B, catatan: "Juri", bobot: 1.5 },
      ],
    });
  });

  it("alamat tidak sah, bobot bukan angka > 0, dan kolom salah — SEMUA dilaporkan dengan nomor baris", () => {
    const hasil = uraiCsvSeedInti(`0x123,x,1\n${A},x,0\n${B},x,abc\n${A},satu,dua,1\n`);
    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.kesalahan.map((k) => k.baris)).toEqual([1, 2, 3, 4]);
  });

  it("bobot kosong dan bobot negatif ditolak", () => {
    expect(uraiCsvSeedInti(`${A},x,\n`).ok).toBe(false);
    expect(uraiCsvSeedInti(`${A},x,-1\n`).ok).toBe(false);
  });

  it("alamat berulang ditolak, termasuk beda huruf besar-kecil", () => {
    const hasil = uraiCsvSeedInti(`${A},x,1\n${A.toLowerCase()},y,1\n`);
    expect(hasil).toEqual({
      ok: false,
      kesalahan: [{ baris: 2, pesan: expect.stringContaining("alamat berulang") }],
    });
  });

  it("berkas tanpa baris seed ditolak", () => {
    expect(uraiCsvSeedInti("address,catatan,bobot\n# kosong\n").ok).toBe(false);
  });
});

describe("bacaArgumen", () => {
  it("berkas saja → uji coba; dengan --jalankan → jalankan", () => {
    expect(bacaArgumen(["seed.csv"])).toEqual({ berkas: "seed.csv", jalankan: false });
    expect(bacaArgumen(["--jalankan", "seed.csv"])).toEqual({ berkas: "seed.csv", jalankan: true });
  });

  it("salah ketik flag, dua berkas, atau tanpa berkas ditolak", () => {
    expect(bacaArgumen(["seed.csv", "--jalankn"])).toBeNull();
    expect(bacaArgumen(["a.csv", "b.csv"])).toBeNull();
    expect(bacaArgumen([])).toBeNull();
    expect(bacaArgumen(["--jalankan"])).toBeNull();
  });
});

describe("jalankanSeedInti", () => {
  it("satu baris salah → nol tulisan dan nol hitung ulang, walau --jalankan", async () => {
    const { d } = deps();
    const kode = await jalankanSeedInti(`${A},benar,1\n0xsalah,rusak,1\n${B},benar,1\n`, true, d);
    expect(kode).toBe(1);
    expect(d.upsertSeeds).not.toHaveBeenCalled();
    expect(d.hitungUlang).not.toHaveBeenCalled();
  });

  it("alamat berulang → nol tulisan", async () => {
    const { d } = deps();
    expect(await jalankanSeedInti(`${A},x,1\n${A},y,1\n`, true, d)).toBe(1);
    expect(d.upsertSeeds).not.toHaveBeenCalled();
  });

  it("tanpa --jalankan → mencetak rencana dan peringatan, nol tulisan", async () => {
    const { d, keluaran } = deps();
    expect(await jalankanSeedInti(`${A},Ketua,2\n`, false, d)).toBe(0);
    expect(d.upsertSeeds).not.toHaveBeenCalled();
    expect(d.hitungUlang).not.toHaveBeenCalled();
    expect(keluaran.join("\n")).toContain(A.toLowerCase());
    expect(keluaran).toContain(PERINGATAN_RELAYER);
  });

  it("--jalankan → upsert sekali dengan semua baris, lalu hitung ulang tepat sekali", async () => {
    const { d, keluaran } = deps();
    expect(await jalankanSeedInti(`${A},Ketua,2\n${B},Juri,1\n`, true, d)).toBe(0);
    expect(d.upsertSeeds).toHaveBeenCalledTimes(1);
    expect(d.upsertSeeds).toHaveBeenCalledWith([
      { address: A.toLowerCase(), catatan: "Ketua", bobot: 2 },
      { address: B, catatan: "Juri", bobot: 1 },
    ]);
    expect(d.hitungUlang).toHaveBeenCalledTimes(1);
    expect(d.upsertSeeds.mock.invocationCallOrder[0]!).toBeLessThan(d.hitungUlang.mock.invocationCallOrder[0]!);
    expect(keluaran).toContain(PERINGATAN_RELAYER);
  });

  it("hitung ulang dengan transaksi gagal → kode keluar bukan nol", async () => {
    const { d } = deps();
    d.hitungUlang.mockResolvedValueOnce({ computed: 3, published: 1, failed: 2 });
    expect(await jalankanSeedInti(`${A},Ketua,2\n`, true, d)).toBe(2);
  });
});
