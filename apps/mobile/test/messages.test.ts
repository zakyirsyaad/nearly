import { describe, expect, it } from "vitest";
import { handshakeErrorMessage } from "../src/messages";

describe("handshakeErrorMessage", () => {
  it("menjelaskan bahwa keduanya terlalu jauh", () => {
    expect(handshakeErrorMessage("not_colocated", "cell_too_far"))
      .toBe("You're too far apart. A handshake only works when you're really next to each other.");
  });

  it("membedakan terlalu jauh dari terlalu lama", () => {
    const jauh = handshakeErrorMessage("not_colocated", "cell_too_far");
    const lama = handshakeErrorMessage("not_colocated", "time_too_far");
    expect(lama).not.toBe(jauh);
    expect(lama).toContain("too much time");
  });

  it("QR kedaluwarsa menyuruh minta QR baru", () => {
    expect(handshakeErrorMessage("expired")).toContain("a new one");
  });

  it("sudah terkoneksi bukan disajikan sebagai error", () => {
    expect(handshakeErrorMessage("already_connected")).toContain("already connected");
  });

  it("kuota harian dijelaskan sebagai batas, bukan kerusakan", () => {
    expect(handshakeErrorMessage("quota_exceeded")).toContain("limit");
  });

  it("kegagalan chain menyuruh mencoba lagi", () => {
    // Tidak sensitif kapitalisasi: yang diuji maksud pesannya, bukan ejaannya.
    expect(handshakeErrorMessage("chain_error").toLowerCase()).toContain("try again");
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
