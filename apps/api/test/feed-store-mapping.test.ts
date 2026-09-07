import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import { petaHop, rowToPost, type PostDbRow } from "../src/feed-store";

const AKU = "0x00000000000000000000000000000000000000a1" as Address;
const B = "0x00000000000000000000000000000000000000b2";
const C = "0x00000000000000000000000000000000000000c3";
const D = "0x00000000000000000000000000000000000000d4";

function row(over: Partial<PostDbRow> = {}): PostDbRow {
  return {
    post_id: `0x${"1".repeat(64)}`,
    author: AKU,
    body: "halo",
    image_bucket: null, image_object: null, image_mime: null, image_status: "none",
    created_at: "2026-09-07T10:00:00.000Z",
    deleted_at: null,
    ...over,
  };
}

describe("rowToPost", () => {
  it("mengubah created_at menjadi milidetik epoch", () => {
    expect(rowToPost(row()).createdAtMs).toBe(Date.parse("2026-09-07T10:00:00.000Z"));
  });

  it("deleted_at yang terisi menjadi deleted true", () => {
    expect(rowToPost(row({ deleted_at: "2026-09-07T11:00:00.000Z" })).deleted).toBe(true);
    expect(rowToPost(row()).deleted).toBe(false);
  });

  it("meneruskan medan gambar apa adanya", () => {
    const p = rowToPost(row({
      image_bucket: "nearly-feed", image_object: "x.jpg",
      image_mime: "image/jpeg", image_status: "ready",
    }));
    expect(p.imageBucket).toBe("nearly-feed");
    expect(p.imageObject).toBe("x.jpg");
    expect(p.imageStatus).toBe("ready");
  });
});

describe("petaHop", () => {
  const tepi = (a: string, b: string) => ({ addr_a: a, addr_b: b });

  it("koneksi langsung berjarak 1 lompatan", () => {
    expect(petaHop(AKU, [tepi(AKU, B)], []).get(B.toLowerCase())).toBe(1);
  });

  it("koneksi dari koneksi berjarak 2 lompatan", () => {
    expect(petaHop(AKU, [tepi(AKU, B)], [tepi(B, C)]).get(C.toLowerCase())).toBe(2);
  });

  it("arah tepi tidak penting", () => {
    expect(petaHop(AKU, [tepi(B, AKU)], []).get(B.toLowerCase())).toBe(1);
  });

  // Satu lompatan menang atas dua: kalau seseorang bisa dicapai lewat kedua
  // jalur, yang lebih dekat yang berlaku.
  it("1 lompatan tidak diturunkan menjadi 2", () => {
    expect(petaHop(AKU, [tepi(AKU, B), tepi(AKU, C)], [tepi(B, C)]).get(C.toLowerCase())).toBe(1);
  });

  it("penonton sendiri tidak masuk peta", () => {
    expect(petaHop(AKU, [tepi(AKU, B)], [tepi(B, AKU)]).has(AKU.toLowerCase())).toBe(false);
  });

  it("orang yang tak terjangkau tidak masuk peta", () => {
    expect(petaHop(AKU, [tepi(AKU, B)], [tepi(B, C)]).has(D.toLowerCase())).toBe(false);
  });

  it("pencocokan tidak peka besar-kecil huruf", () => {
    expect(petaHop(AKU.toUpperCase() as Address, [tepi(AKU, B)], []).get(B.toLowerCase())).toBe(1);
  });

  it("penonton tanpa koneksi menghasilkan peta kosong", () => {
    expect(petaHop(AKU, [], []).size).toBe(0);
  });
});
