import { describe, expect, it } from "vitest";
import { teksLencana } from "../src/messages";

describe("teksLencana", () => {
  // Nol BUKAN "0" — lencana kosong harus hilang, bukan memamerkan nol.
  it("nol menghasilkan null", () => {
    expect(teksLencana(0)).toBeNull();
  });

  it("satu sampai sembilan menghasilkan angkanya", () => {
    expect(teksLencana(1)).toBe("1");
    expect(teksLencana(9)).toBe("9");
  });

  // Angka besar tidak boleh merusak lebar lencana.
  it("sepuluh ke atas dipotong menjadi 9+", () => {
    expect(teksLencana(10)).toBe("9+");
    expect(teksLencana(500)).toBe("9+");
  });

  it("angka negatif diperlakukan sebagai nol", () => {
    expect(teksLencana(-1)).toBeNull();
  });
});
