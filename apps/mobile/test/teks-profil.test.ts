import { describe, expect, it } from "vitest";
import {
  barisAcaraBersama,
  barisSalaman,
  ekorLencanaPertemuan,
  jumlahAcaraBersamaTotal,
  labelKirimLaporan,
  labelKirimVouch,
  pasanganKoneksi,
  pasanganTransaksi,
  teksBlokirTersimpanGagalMuat,
  teksDijaminKenalan,
  teksGagalBlokir,
  type Pertemuan,
} from "../src/teks-profil";

const KINI = new Date(2026, 8, 18, 15, 0); // 18 Sep 2026, waktu lokal
const AGUSTUS = new Date(2026, 7, 12, 19, 42).getTime();

const acara = (judul: string, venue = "Hall A") => ({ eventId: "0xabc", title: judul, venueLabel: venue });
const bersama = (judul: string, detik: number) => ({ ...acara(judul), startsAt: String(detik) });

const pertemuan = (ubah: Partial<Pertemuan> = {}): Pertemuan => ({
  salaman: { atMs: AGUSTUS, acara: null },
  acaraBersama: [],
  jumlahAcaraBersama: 0,
  ...ubah,
});

// Spec desain UI §8.1, §6.3, R8, Ruling B1-9.
describe("jumlah acara bersama", () => {
  it("acara salaman ikut dihitung — acaraBersama sengaja tidak memuatnya", () => {
    expect(jumlahAcaraBersamaTotal(pertemuan())).toBe(0);
    expect(jumlahAcaraBersamaTotal(pertemuan({ salaman: { atMs: AGUSTUS, acara: acara("BNB Hack") } }))).toBe(1);
    expect(jumlahAcaraBersamaTotal(pertemuan({ jumlahAcaraBersama: 3 }))).toBe(3);
    expect(jumlahAcaraBersamaTotal(pertemuan({
      salaman: { atMs: AGUSTUS, acara: acara("BNB Hack") },
      jumlahAcaraBersama: 3,
    }))).toBe(4);
  });
});

describe("ekor lencana '✓ met in person · N events together'", () => {
  it("tanpa pertemuan atau tanpa acara sama sekali → tidak ada ekor", () => {
    expect(ekorLencanaPertemuan(null)).toBeUndefined();
    expect(ekorLencanaPertemuan(undefined)).toBeUndefined();
    expect(ekorLencanaPertemuan(pertemuan())).toBeUndefined();
  });

  it("satu acara memakai bentuk tunggal", () => {
    expect(ekorLencanaPertemuan(pertemuan({ jumlahAcaraBersama: 1 }))).toBe(" · 1 event together");
    expect(ekorLencanaPertemuan(pertemuan({ jumlahAcaraBersama: 4 }))).toBe(" · 4 events together");
  });
});

describe("kartu Meetings (spec §6.3 butir 4, R7)", () => {
  it("salaman di acara menyebut acara dan tempatnya", () => {
    const b = barisSalaman(pertemuan({ salaman: { atMs: AGUSTUS, acara: acara("BNB Hack", "Hall A") } }), KINI);
    expect(b.judul).toBe("Handshake at BNB Hack · Hall A");
    expect(b.tanggal).toBe("Aug 12");
  });

  it("tempat kosong tidak meninggalkan pemisah menggantung", () => {
    const b = barisSalaman(pertemuan({ salaman: { atMs: AGUSTUS, acara: acara("BNB Hack", "  ") } }), KINI);
    expect(b.judul).toBe("Handshake at BNB Hack");
  });

  it("salaman di luar acara → Met in person, tanpa tempat", () => {
    const b = barisSalaman(pertemuan(), KINI);
    expect(b.judul).toBe("Met in person");
    expect(b.tanggal).toBe("Aug 12");
  });

  it("acara bersama memakai startsAt dalam DETIK unix", () => {
    const detik = Math.floor(new Date(2026, 7, 12, 9, 0).getTime() / 1000);
    expect(barisAcaraBersama(bersama("Devcon", detik), KINI)).toBe("Both attended · Devcon · Aug 12");
  });
});

describe("Vouched for by N people you know (spec §8.2)", () => {
  it("absen dan nol sama-sama tidak menampilkan baris", () => {
    expect(teksDijaminKenalan(undefined)).toBeNull();
    expect(teksDijaminKenalan(0)).toBeNull();
  });

  it("satu orang memakai bentuk tunggal", () => {
    expect(teksDijaminKenalan(1)).toBe("Vouched for by 1 person you know");
    expect(teksDijaminKenalan(5)).toBe("Vouched for by 5 people you know");
  });
});

describe("pasangan nilai/label kartu On-chain details (§7.1)", () => {
  it("angka dan kata terpisah supaya angkanya bisa lebih keras", () => {
    expect(pasanganKoneksi(1)).toEqual({ angka: "1", kata: "connection" });
    expect(pasanganKoneksi(12)).toEqual({ angka: "12", kata: "connections" });
    expect(pasanganTransaksi(1)).toEqual({ angka: "1", kata: "on-chain transaction" });
    expect(pasanganTransaksi(0)).toEqual({ angka: "0", kata: "on-chain transactions" });
  });
});

describe("kalimat aksi layar profil", () => {
  it("label sibuk tidak menjanjikan aksi", () => {
    expect(labelKirimVouch(true)).toBe("Sending…");
    expect(labelKirimVouch(false)).toBe("Send vouch");
    expect(labelKirimLaporan(true)).toBe("Sending…");
    expect(labelKirimLaporan(false)).toBe("Send report");
  });

  it("kegagalan MEMUAT ULANG tidak pernah mengaku aksinya gagal", () => {
    expect(teksGagalBlokir(true)).not.toBe(teksGagalBlokir(false));
    for (const cabut of [true, false]) {
      const t = teksBlokirTersimpanGagalMuat(cabut);
      expect(t.toLowerCase()).toContain("reload");
      expect(t.toLowerCase()).not.toContain("couldn't");
    }
  });
});
