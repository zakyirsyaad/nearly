import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { decodeCheckInQr, encodeCheckInQr } from "../src/event";
import { decodeQr, encodeQr } from "../src/qr";

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

  // Arah sebaliknya justru yang lebih berbahaya secara operasional:
  // decodeCheckInQr dijalankan LEBIH DULU di pemindai. Kalau ia menerima
  // payload handshake, memindai untuk koneksi akan diam-diam menjalankan
  // alur check-in alih-alih handshake.
  it("QR handshake tidak terbaca sebagai QR check-in", () => {
    const handshake = {
      v: 1 as const,
      initiator: `0x${"4".repeat(40)}` as Hex,
      nonce: `0x${"2".repeat(64)}` as Hex,
      expiresAt: 1_700_000_030n,
      sigOffer: `0x${"3".repeat(130)}` as Hex,
    };
    expect(decodeCheckInQr(encodeQr(handshake))).toBeNull();
  });
});
