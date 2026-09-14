import { afterEach, describe, expect, it, vi } from "vitest";
import { buatPenyapuLokasi, JEDA_SAPU_MS, sapuLokasiAman } from "../src/penyapu-lokasi";

const tunggu = () => new Promise((r) => setTimeout(r, 0));
const HASIL = { kehadiran: 0, notifKedekatan: 0, offerSalaman: 0, offerCheckIn: 0 };

afterEach(() => vi.restoreAllMocks());

describe("buatPenyapuLokasi", () => {
  it("menyapu pada panggilan pertama, lalu paling sering sekali per JEDA_SAPU_MS", async () => {
    const jam = { sekarang: 1_700_000_000_000 };
    const radar = { sapuLokasi: vi.fn(async () => HASIL) };
    const p = buatPenyapuLokasi({ radar, nowMs: () => jam.sekarang });

    p.mungkinSapu();
    jam.sekarang += JEDA_SAPU_MS - 1;
    p.mungkinSapu();
    await tunggu();
    expect(radar.sapuLokasi).toHaveBeenCalledTimes(1);
    expect(radar.sapuLokasi).toHaveBeenCalledWith(1_700_000_000_000);

    jam.sekarang += 1;
    p.mungkinSapu();
    await tunggu();
    expect(radar.sapuLokasi).toHaveBeenCalledTimes(2);
  });

  it("sapuan yang gagal tidak melempar dan dicatat", async () => {
    const galat = vi.spyOn(console, "error").mockImplementation(() => {});
    const radar = { sapuLokasi: vi.fn(async () => { throw new Error("supabase mati"); }) };
    const p = buatPenyapuLokasi({ radar, nowMs: () => 1 });
    expect(() => p.mungkinSapu()).not.toThrow();
    await tunggu();
    expect(galat).toHaveBeenCalledWith("sapu lokasi gagal:", "supabase mati");
  });
});

describe("sapuLokasiAman", () => {
  it("meneruskan jam pemanggil dan menelan galat", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const radar = { sapuLokasi: vi.fn(async () => { throw new Error("x"); }) };
    await expect(sapuLokasiAman(radar, 42)).resolves.toBeUndefined();
    expect(radar.sapuLokasi).toHaveBeenCalledWith(42);
  });
});
