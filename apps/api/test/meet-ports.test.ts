import { describe, expect, it } from "vitest";
import { METODE_MEET_STORE } from "../src/ports";

/**
 * Tes bentuk, bukan perilaku. Ia ada supaya penambahan atau penghapusan
 * metode di MeetStore menjadi tindakan sadar: setiap fake di tes gerbang
 * harus ikut diperbarui, dan tanpa daftar ini yang gagal cuma typecheck di
 * berkas yang jauh dari sumber perubahan.
 *
 * Nama tes ini sengaja TIDAK menyebut jumlah metode. Versi sebelumnya
 * berbunyi "punya sembilan metode" dan tetap berbunyi begitu setelah
 * `hitungTandaBanyak` dihapus — asersinya benar, judulnya berbohong, dan
 * tidak ada yang merah. Jumlahnya sudah terbaca dari daftar di bawah;
 * menuliskannya lagi di judul cuma menambah satu tempat yang bisa basi.
 */
describe("bentuk MeetStore", () => {
  it("daftar metodenya persis seperti yang tercatat", () => {
    expect(METODE_MEET_STORE).toEqual([
      "setTanda", "hitungTanda", "adaTanda", "tandaOleh", "tandaKe",
      "cocokDilihatAtMs", "setCocokDilihat", "profilRingkas",
    ]);
  });
});
