import { describe, expect, it, vi } from "vitest";
import {
  BATAS_BOBOT_SEED, bacaArgumen, jalankanSeedInti, PERINGATAN_RELAYER, uraiCsvSeedInti, type DepsSeedInti,
} from "../tools/seed-inti-logika";

// Vektor uji EIP-55: huruf campur dengan checksum yang BENAR.
const A = "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed";
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

  it("bobot hanya desimal biasa: heksadesimal, eksponen, dan notasi lain ditolak (M-7)", () => {
    // Number("0x10") = 16 dan Number("1e3") = 1000 — dulu lolos diam-diam.
    for (const bobot of ["0x10", "1e3", "1E2", "Infinity", "1.", ".5", "+1", "1_000", "1,5", "0b1", "0o7"]) {
      expect(uraiCsvSeedInti(`${B},x,${bobot}\n`).ok, bobot).toBe(false);
    }
    for (const [bobot, nilai] of [["2", 2], ["1.5", 1.5], ["0.25", 0.25], ["007", 7]] as const) {
      expect(uraiCsvSeedInti(`${B},x,${bobot}\n`), bobot).toEqual({ ok: true, baris: [{ address: B, catatan: "x", bobot: nilai }] });
    }
  });

  it("bobot nol dan di atas batas atas ditolak; tepat batas atas boleh", () => {
    expect(uraiCsvSeedInti(`${B},x,0\n`).ok).toBe(false);
    expect(uraiCsvSeedInti(`${B},x,0.0\n`).ok).toBe(false);
    expect(uraiCsvSeedInti(`${B},x,${BATAS_BOBOT_SEED}\n`).ok).toBe(true);
    expect(uraiCsvSeedInti(`${B},x,${BATAS_BOBOT_SEED}.5\n`).ok).toBe(false);
    expect(uraiCsvSeedInti(`${B},x,10000\n`).ok).toBe(false);
  });

  it("alamat huruf campur wajib lolos checksum EIP-55; huruf kecil semua atau besar semua tanpa checksum", () => {
    // Satu huruf salah kapital = salah ketik yang dulu lolos.
    const rusak = `${A.slice(0, -1)}D`;
    const hasil = uraiCsvSeedInti(`${rusak},x,1\n`);
    expect(hasil).toEqual({ ok: false, kesalahan: [{ baris: 1, pesan: expect.stringContaining("checksum") }] });
    expect(uraiCsvSeedInti(`${A},x,1\n`).ok).toBe(true);
    expect(uraiCsvSeedInti(`${A.toLowerCase()},x,1\n`).ok).toBe(true);
    expect(uraiCsvSeedInti(`0x${A.slice(2).toUpperCase()},x,1\n`).ok).toBe(true);
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
