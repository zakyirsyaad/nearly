import { describe, expect, it } from "vitest";
import type { Address } from "viem";
import {
  MIN_REPORTERS, reportGate, VOUCHER_PENALTY, voucherPenalties,
} from "../src/index";
import type { GateContext, Report, Vouch } from "../src/index";

const NOW = 1_700_000_000_000;
const addr = (n: number): Address => (`0x${n.toString(16).padStart(40, "0")}`) as Address;
const SUBJECT = addr(666);

function reports(who: Address[]): Report[] {
  return who.map((reporter) => ({ reporter, subject: SUBJECT, atMs: NOW }));
}

/** Semua pelapor tepercaya dan saling asing, kecuali yang disebut di `connected`. */
function ctx(over: Partial<GateContext> = {}): GateContext {
  return {
    ratioOf: () => 0.5,
    areConnected: () => false,
    clusterOf: () => null,
    ...over,
  };
}

describe("reportGate", () => {
  it("GERBANG: 20 pelapor yang saling terkoneksi TIDAK memicu apa pun", () => {
    const brigade = Array.from({ length: 20 }, (_, i) => addr(700 + i));
    const verdict = reportGate(SUBJECT, reports(brigade), ctx({ areConnected: () => true }));
    expect(verdict.passes).toBe(false);
    expect(verdict.reason).toBe("pelapor_tidak_independen");
    expect(verdict.independent).toHaveLength(1);
  });

  it("GERBANG: 3 pelapor tepercaya yang saling asing memicu peninjauan", () => {
    const verdict = reportGate(SUBJECT, reports([addr(1), addr(2), addr(3)]), ctx());
    expect(verdict.passes).toBe(true);
    expect(verdict.reason).toBe("cukup");
  });

  it("dua pelapor saja belum cukup", () => {
    const verdict = reportGate(SUBJECT, reports([addr(1), addr(2)]), ctx());
    expect(verdict.passes).toBe(false);
    expect(verdict.reason).toBe("pelapor_kurang");
  });

  it("pelapor ber-trust di bawah Terpercaya tidak dihitung", () => {
    const verdict = reportGate(
      SUBJECT,
      reports([addr(1), addr(2), addr(3)]),
      ctx({ ratioOf: (a) => (a === addr(1).toLowerCase() ? 0.5 : 0.01) }),
    );
    expect(verdict.passes).toBe(false);
    expect(verdict.reason).toBe("trust_pelapor_rendah");
  });

  it("pelapor dalam satu klaster operator hanya terhitung satu suara", () => {
    const verdict = reportGate(
      SUBJECT,
      reports([addr(1), addr(2), addr(3)]),
      ctx({ clusterOf: () => "operator-x" }),
    );
    expect(verdict.passes).toBe(false);
    expect(verdict.independent).toHaveLength(1);
  });

  it("gerombolan berisi 3 orang luar tetap lolos lewat orang-orang luar itu", () => {
    const brigade = Array.from({ length: 10 }, (_, i) => addr(700 + i));
    const luar = [addr(1), addr(2), addr(3)];
    const brigadeSet = new Set(brigade.map((b) => b.toLowerCase()));
    const verdict = reportGate(
      SUBJECT,
      reports([...brigade, ...luar]),
      ctx({ areConnected: (x, y) => brigadeSet.has(x) && brigadeSet.has(y) }),
    );
    expect(verdict.passes).toBe(true);
    expect(verdict.independent).toHaveLength(1 + luar.length);
  });

  it("laporan ganda dari orang yang sama hanya dihitung sekali", () => {
    const dobel = [...reports([addr(1)]), ...reports([addr(1)]), ...reports([addr(1)])];
    const verdict = reportGate(SUBJECT, dobel, ctx());
    expect(verdict.passes).toBe(false);
    expect(verdict.independent).toHaveLength(1);
  });

  it("laporan untuk subjek lain diabaikan", () => {
    const lain: Report[] = [{ reporter: addr(9), subject: addr(5), atMs: NOW }];
    const verdict = reportGate(SUBJECT, [...reports([addr(1), addr(2)]), ...lain], ctx());
    expect(verdict.independent).toHaveLength(2);
  });

  it("MIN_REPORTERS memang 3", () => {
    expect(MIN_REPORTERS).toBe(3);
  });
});

describe("voucherPenalties", () => {
  it("penjamin satu pelaku terkonfirmasi dikali 0.7", () => {
    const vouches: Vouch[] = [{ from: addr(1), to: SUBJECT, atMs: NOW }];
    expect(voucherPenalties([SUBJECT], vouches).get(addr(1).toLowerCase())).toBeCloseTo(VOUCHER_PENALTY, 9);
  });

  it("menjamin dua pelaku menumpuk jadi 0.7 x 0.7", () => {
    const s2 = addr(667);
    const vouches: Vouch[] = [
      { from: addr(1), to: SUBJECT, atMs: NOW },
      { from: addr(1), to: s2, atMs: NOW },
    ];
    expect(voucherPenalties([SUBJECT, s2], vouches).get(addr(1).toLowerCase()))
      .toBeCloseTo(VOUCHER_PENALTY * VOUCHER_PENALTY, 9);
  });

  it("BERHENTI SATU LOMPATAN: penjamin dari penjamin tidak kena", () => {
    const vouches: Vouch[] = [
      { from: addr(1), to: SUBJECT, atMs: NOW },  // menjamin pelaku
      { from: addr(2), to: addr(1), atMs: NOW },  // menjamin si penjamin
    ];
    const p = voucherPenalties([SUBJECT], vouches);
    expect(p.get(addr(1).toLowerCase())).toBeCloseTo(VOUCHER_PENALTY, 9);
    expect(p.has(addr(2).toLowerCase())).toBe(false);
  });

  it("orang yang tidak menjamin siapa pun tidak kena apa-apa", () => {
    expect(voucherPenalties([SUBJECT], []).size).toBe(0);
  });

  it("vouch KE arah lain tidak menghukum: dijamin pelaku bukan menjamin pelaku", () => {
    const vouches: Vouch[] = [{ from: SUBJECT, to: addr(1), atMs: NOW }];
    expect(voucherPenalties([SUBJECT], vouches).size).toBe(0);
  });
});
