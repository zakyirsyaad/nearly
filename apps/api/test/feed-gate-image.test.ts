import { describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import { lampirGambarTypedData } from "@nearly/shared";
import {
  attachImage, MAKS_GAMBAR_BYTES, objectNameOf, prosesUnggahGambar,
} from "../src/feed-gate";
import type { FeedDeps, FeedStore, GreenfieldPort, PostRecord } from "../src/ports";

const penulis = privateKeyToAccount(`0x${"55".repeat(32)}` as Hex);
const lain = privateKeyToAccount(`0x${"66".repeat(32)}` as Hex);
const KONTRAK = "0x000000000000000000000000000000000000c0de" as Address;
const NOW = 1_800_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);
const ID = `0x${"ab".repeat(32)}` as Hex;

function rekam(over: Partial<PostRecord> = {}): PostRecord {
  return {
    postId: ID, author: penulis.address, body: "halo",
    imageBucket: null, imageObject: null, imageMime: null, imageStatus: "none",
    createdAtMs: NOW, deleted: false, ...over,
  };
}

function store(over: Partial<FeedStore> = {}): FeedStore {
  return {
    createPost: vi.fn(async () => {}),
    getPost: vi.fn(async () => rekam()),
    markDeleted: vi.fn(async () => {}),
    setLike: vi.fn(async () => {}),
    addReport: vi.fn(async () => {}),
    setImagePending: vi.fn(async () => {}),
    setImageDone: vi.fn(async () => {}),
    setImageFailed: vi.fn(async () => {}),
    listCandidates: vi.fn(async () => []),
    ...over,
  };
}

function deps(feed: FeedStore, gf: Partial<GreenfieldPort> = {}): FeedDeps {
  return {
    feed,
    greenfield: {
      bucket: "nearly-feed", spEndpoint: "https://sp.example",
      upload: vi.fn(async () => {}), ...gf,
    },
    verifyingContract: KONTRAK,
    nowMs: () => NOW,
  };
}

async function masukan(over: Record<string, unknown> = {}) {
  const pesan = { postId: ID, author: penulis.address, mime: "image/jpeg", expiresAt: EXP };
  const sig = await penulis.signTypedData(lampirGambarTypedData(pesan, KONTRAK));
  return { ...pesan, sig, dataBase64: Buffer.from("halo").toString("base64"), ...over };
}

describe("objectNameOf", () => {
  it("deterministik dari postId, sehingga coba-ulang menimpa objek yang sama", () => {
    expect(objectNameOf(ID, "image/jpeg")).toBe(objectNameOf(ID, "image/jpeg"));
  });

  it("memakai ekstensi yang cocok dengan mime", () => {
    expect(objectNameOf(ID, "image/jpeg")).toMatch(/\.jpg$/);
    expect(objectNameOf(ID, "image/png")).toMatch(/\.png$/);
  });

  it("tidak memuat awalan 0x", () => {
    expect(objectNameOf(ID, "image/png").startsWith("0x")).toBe(false);
  });
});

describe("attachImage", () => {
  it("menyetel status pending dan TIDAK menyentuh jaringan", async () => {
    const s = store();
    const d = deps(s);
    const hasil = await attachImage(await masukan(), d);
    expect(hasil.ok).toBe(true);
    expect(s.setImagePending).toHaveBeenCalledWith(ID, objectNameOf(ID, "image/jpeg"), "image/jpeg");
    expect(d.greenfield!.upload).not.toHaveBeenCalled();
  });

  it("mengembalikan objectName dan bytes untuk diproses pemanggil", async () => {
    const hasil = await attachImage(await masukan(), deps(store()));
    expect(hasil.ok && hasil.value.objectName).toBe(objectNameOf(ID, "image/jpeg"));
    expect(hasil.ok && hasil.value.bytes.byteLength).toBe(4);
  });

  it("menolak tanda tangan orang lain", async () => {
    const pesan = { postId: ID, author: penulis.address, mime: "image/jpeg", expiresAt: EXP };
    const sig = await lain.signTypedData(lampirGambarTypedData(pesan, KONTRAK));
    const s = store();
    const hasil = await attachImage(
      { ...pesan, sig, dataBase64: Buffer.from("halo").toString("base64") }, deps(s),
    );
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature", httpStatus: 401 } });
    expect(s.setImagePending).not.toHaveBeenCalled();
  });

  // mime ikut ditandatangani; menukarnya setelah menandatangani harus gagal.
  it("menolak mime yang ditukar setelah ditandatangani", async () => {
    const hasil = await attachImage(await masukan({ mime: "image/png" }), deps(store()));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "bad_signature" } });
  });

  it("menolak melampirkan ke unggahan orang lain", async () => {
    const s = store({ getPost: vi.fn(async () => rekam({ author: lain.address })) });
    const hasil = await attachImage(await masukan(), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "not_author", httpStatus: 403 } });
  });

  it("menolak unggahan yang tidak ada atau sudah dihapus", async () => {
    const kosong = store({ getPost: vi.fn(async () => null) });
    expect(await attachImage(await masukan(), deps(kosong)))
      .toMatchObject({ ok: false, failure: { code: "post_not_found", httpStatus: 404 } });

    const terhapus = store({ getPost: vi.fn(async () => rekam({ deleted: true })) });
    expect(await attachImage(await masukan(), deps(terhapus)))
      .toMatchObject({ ok: false, failure: { code: "post_not_found", httpStatus: 404 } });
  });

  // Satu gambar per unggahan (spec §2). Slot yang sudah terisi tidak boleh
  // ditimpa; kalau tidak, satu orang bisa memakai satu unggahan sebagai
  // saluran unggah tanpa batas.
  it("menolak kalau slot gambar sudah terisi", async () => {
    for (const status of ["pending", "ready"] as const) {
      const s = store({ getPost: vi.fn(async () => rekam({ imageStatus: status })) });
      expect(await attachImage(await masukan(), deps(s)))
        .toMatchObject({ ok: false, failure: { code: "image_slot_taken", httpStatus: 409 } });
    }
  });

  // `failed` HARUS bisa dicoba ulang — itulah yang membuat tombol coba-ulang
  // di UI bekerja (spec §11.4).
  it("menerima percobaan ulang setelah status failed", async () => {
    const s = store({ getPost: vi.fn(async () => rekam({ imageStatus: "failed" })) });
    expect((await attachImage(await masukan(), deps(s))).ok).toBe(true);
  });

  it("menolak gambar melebihi batas ukuran", async () => {
    const besar = Buffer.alloc(MAKS_GAMBAR_BYTES + 1).toString("base64");
    const s = store();
    const hasil = await attachImage(await masukan({ dataBase64: besar }), deps(s));
    expect(hasil).toMatchObject({ ok: false, failure: { code: "image_too_large", httpStatus: 413 } });
    expect(s.setImagePending).not.toHaveBeenCalled();
  });

  it("menerima gambar tepat di batas ukuran", async () => {
    const pas = Buffer.alloc(MAKS_GAMBAR_BYTES).toString("base64");
    expect((await attachImage(await masukan({ dataBase64: pas }), deps(store()))).ok).toBe(true);
  });

  it("batasnya dua megabita", () => {
    expect(MAKS_GAMBAR_BYTES).toBe(2 * 1024 * 1024);
  });
});

describe("prosesUnggahGambar", () => {
  const bytes = new Uint8Array([1, 2, 3]);

  it("mengunggah lalu menyetel status ready dengan bucket yang dipakai", async () => {
    const s = store();
    const d = deps(s);
    await prosesUnggahGambar(d, ID, "abc.jpg", "image/jpeg", bytes);
    expect(d.greenfield!.upload).toHaveBeenCalledWith({
      objectName: "abc.jpg", mime: "image/jpeg", bytes,
    });
    expect(s.setImageDone).toHaveBeenCalledWith(ID, "nearly-feed");
  });

  /**
   * Greenfield mati TIDAK boleh mematikan feed (spec §8.2). Kegagalan
   * berhenti di sini sebagai status `failed`, tidak dilempar keluar — kalau
   * dilempar, ia menjadi unhandled rejection karena pemanggilnya tidak
   * meng-await.
   */
  it("menyetel failed dan TIDAK melempar saat unggahan gagal", async () => {
    const s = store();
    const d = deps(s, { upload: vi.fn(async () => { throw new Error("SP mati"); }) });
    await expect(prosesUnggahGambar(d, ID, "abc.jpg", "image/jpeg", bytes)).resolves.toBeUndefined();
    expect(s.setImageFailed).toHaveBeenCalledWith(ID);
    expect(s.setImageDone).not.toHaveBeenCalled();
  });

  it("tidak melempar walau penyimpanan status gagal juga", async () => {
    const s = store({ setImageFailed: vi.fn(async () => { throw new Error("db mati"); }) });
    const d = deps(s, { upload: vi.fn(async () => { throw new Error("SP mati"); }) });
    await expect(prosesUnggahGambar(d, ID, "abc.jpg", "image/jpeg", bytes)).resolves.toBeUndefined();
  });
});
