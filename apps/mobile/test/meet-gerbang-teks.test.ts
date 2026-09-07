import { describe, expect, it } from "vitest";
import {
  teksInginBertemuCount, teksKutandaiHadir, teksPenandaHadir, tombolTandaLabel,
} from "../src/messages";

/**
 * Dua gerbang "absen lawan nol" yang regresinya berkelas Critical: angka yang
 * dikarang dari kegagalan, dan tombol yang menebak keadaan yang tidak
 * diketahui. Keduanya dulu JSX sebaris di layar profil dan layar acara, dan
 * repo ini tidak punya harness render React Native — jadi keduanya diekstrak
 * jadi fungsi murni dan diuji di sini, mengikuti pola `teksLencana`,
 * `alasanMuncul`, dan `meetSuccessMessage`.
 *
 * Yang diuji SELALU tiga keadaan: absen, nol sungguhan, dan angka normal.
 * Absen dan nol yang tertukar adalah seluruh isi bug ini.
 */

describe("teksInginBertemuCount", () => {
  it("absen berarti TIDAK ada baris sama sekali", () => {
    // Server menghilangkan kuncinya kalau store gagal menjawab. "0 orang
    // ingin bertemu dia" pada saat itu adalah karangan tentang orang lain.
    expect(teksInginBertemuCount(undefined)).toBeNull();
  });

  it("nol SUNGGUHAN tetap ditampilkan sebagai nol", () => {
    expect(teksInginBertemuCount(0)).toBe("0 orang ingin bertemu dia");
  });

  it("angka biasa tampil apa adanya", () => {
    expect(teksInginBertemuCount(12)).toBe("12 orang ingin bertemu dia");
  });
});

describe("tombolTandaLabel", () => {
  const biasa = { milikSendiri: false, sibuk: false };

  /**
   * INTI gerbang ini. Absen berarti "tidak diketahui" — bukti bacanya gagal
   * atau tidak dikirim. Merendernya sebagai "belum ditandai" akan menawarkan
   * tombol "Ingin bertemu" kepada orang yang SUDAH menandai, dan ketukannya
   * justru MENCABUT tanda yang dikira sedang dibuat.
   */
  it("absen berarti TIDAK ada tombol, bukan tombol 'Ingin bertemu'", () => {
    expect(tombolTandaLabel(undefined, biasa)).toBeNull();
  });

  it("false berarti tombol menandai", () => {
    expect(tombolTandaLabel(false, biasa)).toBe("Ingin bertemu");
  });

  it("true berarti tombol mencabut", () => {
    expect(tombolTandaLabel(true, biasa)).toBe("Batal ingin bertemu");
  });

  it("profil sendiri tidak pernah punya tombol, walau bendera terbaca", () => {
    expect(tombolTandaLabel(false, { milikSendiri: true, sibuk: false })).toBeNull();
    expect(tombolTandaLabel(true, { milikSendiri: true, sibuk: false })).toBeNull();
  });

  it("sibuk mengganti judulnya, bukan menghilangkan tombolnya", () => {
    expect(tombolTandaLabel(false, { milikSendiri: false, sibuk: true })).toBe("Mengirim…");
    expect(tombolTandaLabel(true, { milikSendiri: false, sibuk: true })).toBe("Mengirim…");
  });

  it("sibuk TIDAK memunculkan tombol untuk keadaan yang tidak diketahui", () => {
    expect(tombolTandaLabel(undefined, { milikSendiri: false, sibuk: true })).toBeNull();
  });
});

describe("teksPenandaHadir", () => {
  /**
   * Di sini absen adalah penyembunyian yang DISENGAJA server (acara belum
   * melewati ambang k-anonimitas). Merendernya "0 orang" mengubah
   * penyembunyian itu jadi klaim "tidak ada yang menandaimu" — kebalikan
   * persis dari yang sedang dilindungi.
   */
  it("absen berarti tidak ada baris, bukan nol", () => {
    expect(teksPenandaHadir(undefined)).toBeNull();
  });

  it("nol sungguhan tetap nol", () => {
    expect(teksPenandaHadir(0)).toBe("0 orang yang ingin bertemu kamu sudah RSVP.");
  });

  it("angka biasa tampil apa adanya", () => {
    expect(teksPenandaHadir(3)).toBe("3 orang yang ingin bertemu kamu sudah RSVP.");
  });
});

describe("teksKutandaiHadir", () => {
  it("absen berarti tidak ada baris, bukan nol", () => {
    expect(teksKutandaiHadir(undefined)).toBeNull();
  });

  it("nol sungguhan tetap nol", () => {
    expect(teksKutandaiHadir(0)).toBe("0 orang yang saling ingin bertemu denganmu sudah RSVP.");
  });

  /**
   * Kalimatnya harus menyebut SALING: server memotong kecocokan, bukan tanda
   * sepihak. Kalimat lama ("orang yang kamu tandai") sekarang akan mengklaim
   * lebih banyak daripada yang benar-benar dihitung.
   */
  it("menyebut hubungan dua arah, bukan tanda sepihak", () => {
    const teks = teksKutandaiHadir(2);
    expect(teks).toBe("2 orang yang saling ingin bertemu denganmu sudah RSVP.");
    expect(teks).toContain("saling");
    expect(teks).not.toContain("kamu tandai");
  });
});
