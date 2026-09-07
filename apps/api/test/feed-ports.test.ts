import { describe, expect, it } from "vitest";
import type { Address, Hex } from "viem";
import { imageUrlOf } from "../src/ports";

const SP = "https://gnfd-testnet-sp-2.bnbchain.org";

describe("imageUrlOf", () => {
  it("membangun URL /view/ dari bucket dan object", () => {
    expect(imageUrlOf(SP, "nearly-feed", "abc.jpg"))
      .toBe("https://gnfd-testnet-sp-2.bnbchain.org/view/nearly-feed/abc.jpg");
  });

  it("tidak menggandakan garis miring kalau endpoint diakhiri /", () => {
    expect(imageUrlOf(`${SP}/`, "nearly-feed", "abc.jpg"))
      .toBe("https://gnfd-testnet-sp-2.bnbchain.org/view/nearly-feed/abc.jpg");
  });

  // Disimpan sebagai bucket+object, bukan URL jadi (spec §8.1). Kalau salah
  // satunya belum ada, tidak ada URL yang bisa dibangun.
  it("mengembalikan null kalau bucket atau object kosong", () => {
    expect(imageUrlOf(SP, null, "abc.jpg")).toBeNull();
    expect(imageUrlOf(SP, "nearly-feed", null)).toBeNull();
  });
});
