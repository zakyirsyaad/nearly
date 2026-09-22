import { describe, expect, it } from "vitest";
import { bolehMuatLencana, JEDA_LENCANA_MS, LENCANA_KOSONG } from "../src/lencana/lencana-tab";
import { baca } from "./support/berkas";

describe("bolehMuatLencana (spec desain UI §4.4)", () => {
  it("pemuatan pertama selalu boleh", () => {
    expect(bolehMuatLencana(null, 0, false)).toBe(true);
  });

  it("paling sering sekali per 30 detik", () => {
    expect(JEDA_LENCANA_MS).toBe(30_000);
    expect(bolehMuatLencana(1_000, 1_000 + JEDA_LENCANA_MS - 1, false)).toBe(false);
    expect(bolehMuatLencana(1_000, 1_000 + JEDA_LENCANA_MS, false)).toBe(true);
  });

  it("paksa (setelah menandai dibaca/dilihat) melewati batas", () => {
    expect(bolehMuatLencana(1_000, 1_001, true)).toBe(true);
  });

  it("angka awal nol", () => {
    expect(LENCANA_KOSONG).toEqual({ belumDibaca: 0, kecocokanBaru: 0 });
  });
});

describe("pemasangan lencana tab", () => {
  it("layout tab memasang useLencanaTab di isi dan membagikannya lewat konteks", () => {
    const isi = baca("app/(tabs)/_layout.tsx");
    expect(isi).toContain("const lencana = useLencanaTab(signer);");
    expect(isi).toContain("<PenyediaLencana nilai={lencana}>");
    expect(isi).toContain("screenListeners={{ focus: () => lencana.muatBilaPerlu() }}");
    expect(isi).toContain('tab.grup === "(pesan)" ? teksLencana(lencana.belumDibaca) : null');
    expect(isi).toContain('tab.grup === "(profil)" && lencana.kecocokanBaru > 0');
  });

  it("kegagalan masing-masing angka menjadi 0 tanpa galat", () => {
    const isi = baca("src/lencana/konteks-lencana.tsx");
    expect(isi.match(/\.catch\(\(\) => 0\)/g)?.length).toBe(2);
    expect(isi).toContain('AppState.addEventListener("change"');
  });

  it("Kecocokan dan Percakapan memuat ulang lencana setelah menandai", () => {
    expect(baca("app/(tabs)/(profil)/kecocokan.tsx"))
      .toMatch(/await tandaiKecocokanDilihat\(signer\)\.catch\(\(\) => \{\}\);[\s\S]{0,200}?muatUlangLencana\(\);/);
    expect(baca("app/(tabs)/(pesan)/pesan/[address].tsx"))
      .toMatch(/await postDibaca\(sesi, lawan, masukTerbaru\.createdAtMs\);[\s\S]{0,300}?muatUlangLencana\(\);/);
  });

  it("Beranda tidak lagi menandatangani bukti sendiri untuk lencana", () => {
    const isi = baca("app/(tabs)/(beranda)/index.tsx");
    expect(isi).not.toMatch(/getBelumDibaca|kueriBuktiKecocokan|sesiPesan/);
  });
});
