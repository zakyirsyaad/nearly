import { describe, expect, it } from "vitest";
import { handshakeErrorMessage } from "../src/messages";

describe("handshakeErrorMessage", () => {
  it("menjelaskan bahwa keduanya terlalu jauh", () => {
    expect(handshakeErrorMessage("not_colocated", "cell_too_far"))
      .toBe("Kalian terlalu jauh. Handshake hanya berhasil kalau kalian benar-benar berdekatan.");
  });

  it("membedakan terlalu jauh dari terlalu lama", () => {
    const jauh = handshakeErrorMessage("not_colocated", "cell_too_far");
    const lama = handshakeErrorMessage("not_colocated", "time_too_far");
    expect(lama).not.toBe(jauh);
    expect(lama).toContain("terlalu lama");
  });

  it("QR kedaluwarsa menyuruh minta QR baru", () => {
    expect(handshakeErrorMessage("expired")).toContain("QR baru");
  });

  it("sudah terkoneksi bukan disajikan sebagai error", () => {
    expect(handshakeErrorMessage("already_connected")).toContain("sudah terkoneksi");
  });

  it("kuota harian dijelaskan sebagai batas, bukan kerusakan", () => {
    expect(handshakeErrorMessage("quota_exceeded")).toContain("batas");
  });

  it("kegagalan chain menyuruh mencoba lagi", () => {
    // Tidak sensitif kapitalisasi: yang diuji maksud pesannya, bukan ejaannya.
    expect(handshakeErrorMessage("chain_error").toLowerCase()).toContain("coba lagi");
  });

  it("offer_not_found dan offer_consumed punya pesan berbeda", () => {
    expect(handshakeErrorMessage("offer_not_found"))
      .not.toBe(handshakeErrorMessage("offer_consumed"));
  });

  it("kode yang tidak dikenal tetap menghasilkan pesan yang bisa dibaca manusia", () => {
    const msg = handshakeErrorMessage("kode_aneh_yang_belum_ada");
    expect(msg.length).toBeGreaterThan(10);
    expect(msg).not.toContain("kode_aneh");
  });
});
