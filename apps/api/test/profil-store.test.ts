import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { createProfilSayaStore, keVisibilitas } from "../src/profil-store";

const A = "0x00000000000000000000000000000000000000AA" as Address;
const B = "0x00000000000000000000000000000000000000BB" as Address;

describe("keVisibilitas", () => {
  it("hanya tersembunyi yang menyembunyikan; tanpa baris berarti terlihat", () => {
    expect(keVisibilitas("tersembunyi")).toBe("tersembunyi");
    expect(keVisibilitas("terlihat")).toBe("terlihat");
    expect(keVisibilitas(undefined)).toBe("terlihat");
    expect(keVisibilitas(null)).toBe("terlihat");
  });
});

describe("createProfilSayaStore", () => {
  it("visibilitasBanyak: setiap alamat diminta punya entri huruf kecil; tanpa baris → terlihat", async () => {
    const panggilan: unknown[][] = [];
    const db = {
      from: () => ({
        select: () => ({
          in: (k: string, v: string[]) => {
            panggilan.push([k, v]);
            return Promise.resolve({ data: [{ address: B.toLowerCase(), visibilitas: "tersembunyi" }], error: null });
          },
        }),
      }),
    } as never;
    const peta = await createProfilSayaStore(db).visibilitasBanyak([A, B, A]);
    expect([...peta.entries()]).toEqual([[A.toLowerCase(), "terlihat"], [B.toLowerCase(), "tersembunyi"]]);
    expect(panggilan).toEqual([["address", [A.toLowerCase(), B.toLowerCase()]]]);
  });

  it("visibilitasBanyak tanpa alamat tidak mengirim kueri", async () => {
    const db = { from: () => { throw new Error("tidak boleh dipanggil"); } } as never;
    expect(await createProfilSayaStore(db).visibilitasBanyak([])).toEqual(new Map());
  });

  it("profilSaya: baris tidak ada → nama kosong, terlihat", async () => {
    const db = {
      from: () => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }) }),
    } as never;
    expect(await createProfilSayaStore(db).profilSaya(A)).toEqual({ displayName: "", visibilitas: "terlihat" });
  });

  it("aturProfil meng-upsert hanya address, display_name, visibilitas", async () => {
    const rekam: unknown[] = [];
    const db = {
      from: (t: string) => ({ upsert: (v: unknown, o: unknown) => { rekam.push([t, v, o]); return Promise.resolve({ error: null }); } }),
    } as never;
    await createProfilSayaStore(db).aturProfil(A, { displayName: "Budi", visibilitas: "tersembunyi" });
    expect(rekam).toEqual([["profiles", { address: A.toLowerCase(), display_name: "Budi", visibilitas: "tersembunyi" }, { onConflict: "address" }]]);
  });
});
