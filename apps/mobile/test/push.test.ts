import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Address, Hex } from "viem";
import { turunkanKunciPesan } from "@nearly/shared";
import type { SesiPesan } from "../src/pesan/sesi";

const mockGetPermissionsAsync = vi.fn();
const mockRequestPermissionsAsync = vi.fn();
const mockGetExpoPushTokenAsync = vi.fn();

vi.mock("expo-notifications", () => ({
  getPermissionsAsync: () => mockGetPermissionsAsync(),
  requestPermissionsAsync: () => mockRequestPermissionsAsync(),
  getExpoPushTokenAsync: (args: unknown) => mockGetExpoPushTokenAsync(args),
}));

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      extra: {
        eas: {
          projectId: "test-project-id",
        },
      },
    },
  },
}));

import { daftarkanPush, lupakanPendaftaranPush } from "../src/pesan/push";

const aslinya = globalThis.fetch;

function buatSesi(who: Address): SesiPesan {
  const kunci = turunkanKunciPesan(`0x${"77".repeat(65)}` as Hex);
  return { address: who, kunci };
}

describe("push", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lupakanPendaftaranPush();
  });

  afterEach(() => {
    globalThis.fetch = aslinya;
    lupakanPendaftaranPush();
  });

  it("daftarkanPush mendaftarkan token push dan hanya mencoba sekali per sesi", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: true });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[dummy-token-1]" });

    const rekaman: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
      rekaman.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as never;

    const sesiA = buatSesi("0x1111111111111111111111111111111111111111");

    await daftarkanPush(sesiA);
    expect(mockGetPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(mockGetExpoPushTokenAsync).toHaveBeenCalledTimes(1);
    expect(rekaman.length).toBe(1);
    expect(rekaman[0]!.url).toContain("/pesan/token-push");

    // Pemanggilan kedua tanpa lupakanPendaftaranPush diabaikan (sudahDicoba = true)
    await daftarkanPush(sesiA);
    expect(mockGetPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(rekaman.length).toBe(1);
  });

  it("lupakanPendaftaranPush mereset flag sehingga pendaftaran push dapat dicoba lagi", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: true });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[dummy-token-2]" });

    const rekaman: { url: string; init: RequestInit }[] = [];
    globalThis.fetch = vi.fn(async (url: string, init: RequestInit = {}) => {
      rekaman.push({ url, init });
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as never;

    const sesiA = buatSesi("0x1111111111111111111111111111111111111111");
    const sesiB = buatSesi("0x2222222222222222222222222222222222222222");

    // Pendaftaran pertama untuk dompet A
    await daftarkanPush(sesiA);
    expect(rekaman.length).toBe(1);

    // Sebelum reset, dompet B memanggil daftarkanPush tapi diabaikan
    await daftarkanPush(sesiB);
    expect(rekaman.length).toBe(1);

    // Reset dipanggil (misal saat ganti dompet / lupakanDompet)
    lupakanPendaftaranPush();

    // Sekarang dompet B dapat mendaftarkan token push
    await daftarkanPush(sesiB);
    expect(rekaman.length).toBe(2);
    expect(rekaman[1]!.url).toContain("/pesan/token-push");
  });
});
