import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { decodeCheckInQr, encodeCheckInQr } from "../src/event";
import { decodeQr } from "../src/qr";

const payload = {
  v: 1 as const,
  k: "checkin" as const,
  eventId: `0x${"1".repeat(64)}` as Hex,
  nonce: `0x${"2".repeat(64)}` as Hex,
  expiresAt: 1_700_000_030n,
  sigHost: `0x${"3".repeat(130)}` as Hex,
};

describe("QR check-in", () => {
  it("bolak-balik menghasilkan payload yang sama", () => {
    expect(decodeCheckInQr(encodeCheckInQr(payload))).toEqual(payload);
  });

  it("mengembalikan null untuk teks yang bukan JSON", () => {
    expect(decodeCheckInQr("bukan json")).toBeNull();
  });

  it("mengembalikan null untuk JSON tanpa penanda checkin", () => {
    expect(decodeCheckInQr(JSON.stringify({ v: 1, e: "x" }))).toBeNull();
  });

  it("mengembalikan null untuk tanda tangan yang panjangnya salah", () => {
    const rusak = JSON.parse(encodeCheckInQr(payload));
    rusak.s = "0x00";
    expect(decodeCheckInQr(JSON.stringify(rusak))).toBeNull();
  });

  // Dua jenis QR hidup berdampingan di satu pemindai. Kalau salah satu bisa
  // dibaca sebagai yang lain, pemindai akan menjalankan alur yang salah.
  it("QR check-in tidak terbaca sebagai QR handshake", () => {
    expect(decodeQr(encodeCheckInQr(payload))).toBeNull();
  });
});
