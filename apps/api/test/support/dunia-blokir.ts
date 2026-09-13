import { vi } from "vitest";
import type { Address } from "viem";
import type { BlokirStore, MeetStore, Tanda } from "../../src/ports";

/**
 * Dunia kecil di memori: tabel `ingin_bertemu` dan `blocks` sebagai larik,
 * dengan MeetStore dan BlokirStore yang membacanya SUNGGUHAN — termasuk
 * semantik `kecuali` dan kedua arah blokir.
 *
 * Ada karena tes invarian C2 (review akhir) tidak bisa ditulis dengan fake
 * yang mengembalikan angka karangan: "X memblokir B tidak menggerakkan angka
 * X" hanya bermakna kalau fake-nya MEMBEDAKAN `himpunanUntuk` (dua arah) dari
 * `pemblokirUntuk` (satu arah). Fake yang mengembalikan himpunan yang sama
 * untuk keduanya akan meloloskan rute yang salah memilih.
 */
export function duniaBlokir(awal: {
  tanda?: { who: Address; target: Address; atMs?: number }[];
  blokir?: { blocker: Address; blocked: Address }[];
} = {}) {
  const kecil = (a: string) => a.toLowerCase();
  const tanda = (awal.tanda ?? []).map((t) => ({
    who: kecil(t.who), target: kecil(t.target), atMs: t.atMs ?? 0,
  }));
  const blocks = (awal.blokir ?? []).map((b) => ({ blocker: kecil(b.blocker), blocked: kecil(b.blocked) }));

  const blokir: BlokirStore = {
    setBlokir: vi.fn(async (blocker: Address, blocked: Address, pasang: boolean) => {
      const i = blocks.findIndex((b) => b.blocker === kecil(blocker) && b.blocked === kecil(blocked));
      if (pasang && i < 0) blocks.push({ blocker: kecil(blocker), blocked: kecil(blocked) });
      if (!pasang && i >= 0) blocks.splice(i, 1);
    }),
    adaBlokir: vi.fn(async (blocker: Address, blocked: Address) =>
      blocks.some((b) => b.blocker === kecil(blocker) && b.blocked === kecil(blocked))),
    diblokirOleh: vi.fn(async (who: Address) => blocks
      .filter((b) => b.blocker === kecil(who))
      .map((b) => ({ address: b.blocked as Address, atMs: 0 }))),
    himpunanUntuk: vi.fn(async (who: Address) => {
      const a = kecil(who);
      const s = new Set<string>();
      for (const b of blocks) {
        if (b.blocker === a && b.blocked !== a) s.add(b.blocked);
        if (b.blocked === a && b.blocker !== a) s.add(b.blocker);
      }
      return s;
    }),
    pemblokirUntuk: vi.fn(async (who: Address) => new Set(
      blocks.filter((b) => b.blocked === kecil(who) && b.blocker !== kecil(who)).map((b) => b.blocker),
    )),
  };

  const tanpa = (kecuali: readonly string[]) => {
    const k = new Set(kecuali.map(kecil));
    return (a: string) => !k.has(a);
  };

  const meet: MeetStore = {
    setTanda: vi.fn(async () => {}),
    hitungTanda: vi.fn(async (target: Address, kecuali: readonly string[]) =>
      tanda.filter((t) => t.target === kecil(target)).map((t) => t.who).filter(tanpa(kecuali)).length),
    adaTanda: vi.fn(async (target: Address, who: Address, kecuali: readonly string[]) =>
      tanpa(kecuali)(kecil(who)) && tanda.some((t) => t.target === kecil(target) && t.who === kecil(who))),
    tandaOleh: vi.fn(async (who: Address, kecuali: readonly string[]): Promise<Tanda[]> => tanda
      .filter((t) => t.who === kecil(who) && tanpa(kecuali)(t.target))
      .map((t) => ({ address: t.target as Address, atMs: t.atMs }))),
    tandaKe: vi.fn(async (target: Address, kecuali: readonly string[]): Promise<Tanda[]> => tanda
      .filter((t) => t.target === kecil(target) && tanpa(kecuali)(t.who))
      .map((t) => ({ address: t.who as Address, atMs: t.atMs }))),
    cocokDilihatAtMs: vi.fn(async () => null),
    setCocokDilihat: vi.fn(async () => {}),
    profilRingkas: vi.fn(async () => new Map()),
  };

  return {
    meet,
    blokir,
    /** Memasang blokir langsung ke tabel, seperti POST /blokir yang berhasil. */
    pasangBlokir: (blocker: Address, blocked: Address) => {
      blocks.push({ blocker: kecil(blocker), blocked: kecil(blocked) });
    },
  };
}
