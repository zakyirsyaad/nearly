import { describe, expect, it } from "vitest";
import { baca, tanpaKomentar } from "./support/berkas";

const isi = () => tanpaKomentar(baca("components/ui/input.tsx"));

/**
 * Setiap blok elemen JSX `<TextInput ... />`, dari kemunculannya sampai `/>`
 * berikutnya. `<TextInput\s` (bukan sekadar "<TextInput") supaya tidak salah
 * menangkap `Omit<TextInputProps, …>` di deklarasi tipe.
 */
function blokTextInput(kode: string): string[] {
  const blok: string[] = [];
  const pola = /<TextInput\s/g;
  let m: RegExpExecArray | null;
  while ((m = pola.exec(kode)) !== null) {
    const akhir = kode.indexOf("/>", m.index);
    blok.push(kode.slice(m.index, akhir));
  }
  return blok;
}

describe("Input BNA: {...props} selalu atribut TERAKHIR sebelum /> (T14b)", () => {
  it("setiap <TextInput> di components/ui/input.tsx diakhiri {...props} — 12 kata dan kunci dev bergantung pada urutan ini menimpa default", () => {
    const blok = blokTextInput(isi());
    // Input (dua cabang: textarea dan baris) + GroupedInputItem (dua cabang).
    expect(blok.length).toBeGreaterThanOrEqual(2);
    for (const b of blok) {
      expect(b.trimEnd().endsWith("{...props}")).toBe(true);
    }
  });
});
