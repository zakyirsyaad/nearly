import { describe, expect, it } from "vitest";
import { polaIdenticon, SISI_IDENTICON } from "../src/identicon";
import { baca, tanpaKomentar } from "./support/berkas";

const A = "0x7814656e4bcc5acae46099bd0238856e2a118811";
const B = "0xb8472f186725b9895231d1092e887306dbd6e751";

const jumlahHidup = (pola: boolean[][]) => pola.flat().filter(Boolean).length;

describe("pola identicon (2026-09-24)", () => {
  it("kisi 5×5", () => {
    const pola = polaIdenticon(A);
    expect(pola).toHaveLength(SISI_IDENTICON);
    for (const baris of pola) expect(baris).toHaveLength(SISI_IDENTICON);
  });

  it("simetris cermin — bentuknya terbaca, bukan derau", () => {
    for (const baris of polaIdenticon(A)) {
      expect(baris[0]).toBe(baris[4]);
      expect(baris[1]).toBe(baris[3]);
    }
  });

  it("sama untuk alamat yang sama, termasuk beda huruf besar-kecil", () => {
    expect(polaIdenticon(A)).toEqual(polaIdenticon(A));
    expect(polaIdenticon(A.toUpperCase().replace("0X", "0x"))).toEqual(polaIdenticon(A));
    expect(polaIdenticon(` ${A} `)).toEqual(polaIdenticon(A));
  });

  it("berbeda antar alamat — inilah gunanya", () => {
    expect(polaIdenticon(A)).not.toEqual(polaIdenticon(B));
  });

  it("tidak pernah kosong atau penuh: avatar polos tidak membedakan siapa pun", () => {
    // Sampel alamat berurutan: pola yang selalu penuh/kosong berarti hash-nya
    // tidak menyebar, dan semua orang kembali terlihat sama.
    for (let i = 0; i < 64; i += 1) {
      const alamat = `0x${i.toString(16).padStart(40, "0")}`;
      const hidup = jumlahHidup(polaIdenticon(alamat));
      expect(hidup, alamat).toBeGreaterThan(0);
      expect(hidup, alamat).toBeLessThan(SISI_IDENTICON * SISI_IDENTICON);
    }
  });

  it("sebaran cukup lebar: 64 alamat menghasilkan banyak pola berbeda", () => {
    const unik = new Set(
      Array.from({ length: 64 }, (_, i) =>
        JSON.stringify(polaIdenticon(`0x${(i * 7919).toString(16).padStart(40, "0")}`))),
    );
    expect(unik.size).toBeGreaterThan(32);
  });
});

describe("pola dipakai di avatar dan alamat dibuat terbaca", () => {
  it("Avatar menggambar pola dari alamat, di bawah huruf", () => {
    const isi = tanpaKomentar(baca("components/avatar.tsx"));
    expect(isi).toContain("polaIdenticon(alamat)");
    expect(isi).toContain("hurufAvatar(nama, alamat)");
  });

  it("pola memakai token tema, bukan warna baru", () => {
    const isi = tanpaKomentar(baca("components/avatar.tsx"));
    expect(isi).toContain('useColor("mutedForeground")');
    expect(isi).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it("alamat di kartu orang seterang nama", () => {
    const isi = tanpaKomentar(baca("components/kartu-orang.tsx"));
    expect(isi).toContain('useColor("text")');
    expect(isi).toContain("{ color: teks }");
  });
});

describe("avatar ENS (2026-09-24)", () => {
  it("dimuat lewat proksi API, bukan URL host asing", async () => {
    const { urlAvatarEns } = await import("../src/avatar-ens");
    const url = urlAvatarEns("0xAbC0000000000000000000000000000000000001");
    expect(url).toContain("/avatar/0xabc0000000000000000000000000000000000001");
    expect(url.startsWith("http")).toBe(true);
  });

  it("komponen jatuh kembali ke pola saat avatar tidak ada", () => {
    const isi = tanpaKomentar(baca("components/avatar.tsx"));
    expect(isi).toContain("urlAvatarEns(alamat)");
    expect(isi).toContain("onError={() => setGagalEns(true)}");
    // 404 adalah keadaan NORMAL: tidak pernah jadi pesan galat di layar.
    expect(isi).not.toContain("setPesan");
  });

  it("huruf awal disembunyikan begitu foto ENS termuat", () => {
    const isi = tanpaKomentar(baca("components/avatar.tsx"));
    expect(isi).toContain("onLoad={() => setAdaEns(true)}");
    expect(isi).toContain("{adaEns ? null : <Text");
  });
});
