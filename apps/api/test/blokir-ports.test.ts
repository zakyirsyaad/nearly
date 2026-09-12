import { describe, expect, it } from "vitest";
import { METODE_BLOKIR_STORE } from "../src/ports";

/**
 * Tes bentuk, bukan perilaku. Ia ada supaya penambahan atau penghapusan
 * metode di BlokirStore menjadi tindakan sadar: setiap fake di tes gerbang
 * harus ikut diperbarui.
 *
 * Nama tes ini sengaja TIDAK menyebut jumlah metode — di Fase 3c judul
 * serupa berbunyi "sembilan metode" dan tetap berbunyi begitu setelah satu
 * metode dihapus, asersinya benar dan judulnya berbohong.
 */
describe("bentuk BlokirStore", () => {
  it("daftar metodenya persis seperti yang tercatat", () => {
    expect(METODE_BLOKIR_STORE).toEqual([
      "setBlokir", "adaBlokir", "diblokirOleh", "himpunanUntuk",
    ]);
  });
});
