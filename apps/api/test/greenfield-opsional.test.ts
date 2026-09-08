import { describe, expect, it, vi } from "vitest";
import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { lampirGambarTypedData } from "@nearly/shared";
import { attachImage, prosesUnggahGambar } from "../src/feed-gate";
import { bacaKonfigurasiGreenfield } from "../src/greenfield";
import { imageUrlOf } from "../src/ports";

const A = privateKeyToAccount(`0x${"a1".repeat(32)}` as Hex);
const VC = "0x0000000000000000000000000000000000000abc" as Address;
const NOW = 1_700_000_000_000;
const EXP = BigInt(Math.floor(NOW / 1000) + 300);
const ID = `0x${"11".repeat(32)}` as Hex;

const PENUH = {
  GREENFIELD_RPC: "https://rpc.example",
  GREENFIELD_CHAIN_ID: "5600",
  GREENFIELD_BUCKET: "nearly-feed",
  GREENFIELD_SP_ENDPOINT: "https://sp.example",
};

/**
 * Konfigurasi separuh dan konfigurasi kosong adalah dua hal berbeda, dan
 * inilah inti perubahannya. Kosong = penyebaran yang memang tidak memakai
 * fitur gambar. Separuh = salah ketik, dan itu harus ketahuan saat API menyala
 * — persis prinsip gagal-cepat yang sudah dianut createGreenfield.
 */
describe("bacaKonfigurasiGreenfield", () => {
  it("keempatnya terisi → aktif", () => {
    const h = bacaKonfigurasiGreenfield(PENUH);
    expect(h.mode).toBe("aktif");
    expect(h.mode === "aktif" && h.cfg.bucket).toBe("nearly-feed");
  });

  it("keempatnya kosong → nonaktif, bukan galat", () => {
    expect(bacaKonfigurasiGreenfield({}).mode).toBe("nonaktif");
  });

  it("hanya spasi juga dihitung kosong", () => {
    const h = bacaKonfigurasiGreenfield({
      GREENFIELD_RPC: "   ", GREENFIELD_CHAIN_ID: "", GREENFIELD_BUCKET: " ",
      GREENFIELD_SP_ENDPOINT: "",
    });
    expect(h.mode).toBe("nonaktif");
  });

  it("separuh terisi → MELEMPAR, dan pesannya menyebut yang kurang", () => {
    expect(() => bacaKonfigurasiGreenfield({
      GREENFIELD_RPC: PENUH.GREENFIELD_RPC,
      GREENFIELD_CHAIN_ID: PENUH.GREENFIELD_CHAIN_ID,
    })).toThrow(/GREENFIELD_BUCKET/);
  });

  it("satu saja yang kosong tetap melempar", () => {
    expect(() => bacaKonfigurasiGreenfield({ ...PENUH, GREENFIELD_SP_ENDPOINT: "" }))
      .toThrow(/GREENFIELD_SP_ENDPOINT/);
  });
});

function feedDeps(greenfield: unknown) {
  return {
    verifyingContract: VC, nowMs: () => NOW, greenfield,
    feed: {
      getPost: vi.fn(async () => ({
        postId: ID, author: A.address, body: "x", imageBucket: null, imageObject: null,
        imageMime: null, imageStatus: "none", createdAtMs: NOW, deleted: false,
      })),
      setImagePending: vi.fn(async () => {}),
      setImageDone: vi.fn(async () => {}),
      setImageFailed: vi.fn(async () => {}),
    },
  } as never;
}

async function masukan() {
  const sig = await A.signTypedData(lampirGambarTypedData(
    { postId: ID, author: A.address as Address, mime: "image/png", expiresAt: EXP }, VC) as never);
  return {
    postId: ID, author: A.address as Address, mime: "image/png",
    expiresAt: EXP, sig, dataBase64: Buffer.from("x").toString("base64"),
  } as never;
}

describe("attachImage saat Greenfield nonaktif", () => {
  it("menolak 503 image_unavailable", async () => {
    const deps = feedDeps(null);
    const r = await attachImage(await masukan(), deps);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.failure.code).toBe("image_unavailable");
    expect(!r.ok && r.failure.httpStatus).toBe(503);
  });

  it("TIDAK menyetel pending — tidak ada baris yang ditinggalkan menggantung", async () => {
    const deps = feedDeps(null);
    await attachImage(await masukan(), deps);
    expect((deps as { feed: { setImagePending: { mock: { calls: unknown[] } } } })
      .feed.setImagePending.mock.calls.length).toBe(0);
  });

  it("tetap bekerja normal saat Greenfield aktif", async () => {
    const deps = feedDeps({ bucket: "b", spEndpoint: "https://sp", upload: vi.fn(async () => {}) });
    const r = await attachImage(await masukan(), deps);
    expect(r.ok).toBe(true);
  });
});

describe("prosesUnggahGambar saat Greenfield nonaktif", () => {
  it("menyetel failed dan TIDAK melempar", async () => {
    const deps = feedDeps(null);
    await expect(prosesUnggahGambar(deps, ID, "obj.png", "image/png", new Uint8Array([1])))
      .resolves.toBeUndefined();
    expect((deps as { feed: { setImageFailed: { mock: { calls: unknown[] } } } })
      .feed.setImageFailed.mock.calls.length).toBe(1);
  });
});

describe("imageUrlOf tanpa endpoint storage provider", () => {
  it("endpoint null → URL null, bukan URL cacat", () => {
    expect(imageUrlOf(null, "nearly-feed", "obj.png")).toBeNull();
  });

  it("endpoint ada → URL utuh", () => {
    expect(imageUrlOf("https://sp.example", "nearly-feed", "obj.png"))
      .toBe("https://sp.example/view/nearly-feed/obj.png");
  });
});
