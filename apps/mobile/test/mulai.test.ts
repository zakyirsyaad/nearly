import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { opsiTampilan } from "../theme/navigasi";
import {
  KALIMAT_MULAI, TEKS_BUAT_DOMPET, TEKS_MENYIAPKAN_DOMPET, TEKS_PAKAI_DOMPET,
} from "../src/teks-mulai";
import { baca, MOBILE, semuaBerkas, tanpaKomentar } from "./support/berkas";

const mulai = () => tanpaKomentar(baca("app/mulai.tsx"));

describe("Mulai (spec §7.1, keputusan #11, #15)", () => {
  it("kalimat dan tombol persis istilah terkunci #15", () => {
    expect(KALIMAT_MULAI).toBe("Know the people you've actually met");
    expect(TEKS_BUAT_DOMPET).toBe("Create a new wallet");
    expect(TEKS_PAKAI_DOMPET).toBe("Use an existing wallet");
    expect(TEKS_MENYIAPKAN_DOMPET).toBe("Setting up wallet…");
  });

  it("tanpa header, isi di dalam SafeAreaView (Ruling B2-17)", () => {
    expect(opsiTampilan("mulai")).toMatchObject({ headerShown: false });
    expect(mulai()).toContain("<SafeAreaView");
  });

  it("logo n besar dari path yang sama, lalu kalimat dan dua tombol", () => {
    const x = mulai();
    expect(x).toContain("<LogoN ukuran={UKURAN.logoMulai} />");
    expect(x).toContain("{KALIMAT_MULAI}");
    expect(x).toContain("{sibuk ? TEKS_MENYIAPKAN_DOMPET : TEKS_BUAT_DOMPET}");
    expect(x).toContain("{TEKS_PAKAI_DOMPET}");
  });

  it("kalimat pembuka lama di bawah judul 'Nearly' digantikan", () => {
    expect(baca("app/mulai.tsx")).not.toContain("Identitasmu");
  });

  it("tidak ada lagi TextInput mentah atau WARNA di app/, dan src/warna.ts terhapus (Ruling A3)", () => {
    const salah = semuaBerkas("app").filter((b) => /<TextInput\b|src\/warna/.test(baca(b)));
    expect(salah).toEqual([]);
    expect(existsSync(join(MOBILE, "src/warna.ts"))).toBe(false);
  });

  it("T14a: kedua isian dikunci SECARA VISUAL (disabled) saat sibuk, bukan cuma editable", () => {
    const x = mulai();
    const blokIsian = x.split("<Input").slice(1).map((b) => b.slice(0, b.indexOf("/>") + 2));
    expect(blokIsian.length).toBe(2);
    for (const isian of blokIsian) {
      expect(isian).toContain("disabled={sibuk}");
      expect(isian).toContain("editable={!sibuk}");
    }
  });
});
