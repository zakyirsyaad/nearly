import { describe, expect, it } from "vitest";
import { TIER_LABELS } from "@nearly/trust";
import {
  JUMLAH_RUAS_TRUST, LABEL_TIER_EN, labelAksesTrust, labelTier, ruasTerisiTrust, SUGGESTED_TAGS,
  tierDariLabel, tierView,
} from "../src/tier";
import { baca, semuaBerkas } from "./support/berkas";

const bukti = { connections: 47, occasions: 6, regions: 3, vouches: 12 };

describe("tierView", () => {
  it("menyusun label dan baris bukti sesuai spec §8", () => {
    const v = tierView(2, bukti);
    expect(v.label).toBe("Trusted");
    expect(v.evidenceLine).toBe("47 connections · 6 occasions · 3 regions · 12 vouches");
  });

  it("pengguna baru tanpa apa pun tetap punya baris bukti yang jujur", () => {
    const v = tierView(0, { connections: 0, occasions: 0, regions: 0, vouches: 0 });
    expect(v.label).toBe("New");
    expect(v.evidenceLine).toBe("no connections yet");
  });

  it("menghilangkan bagian yang bernilai nol dan memakai bentuk tunggal untuk 1", () => {
    const v = tierView(1, { connections: 3, occasions: 1, regions: 1, vouches: 0 });
    expect(v.evidenceLine).toBe("3 connections · 1 occasion · 1 region");
    expect(tierView(1, { connections: 1, occasions: 0, regions: 0, vouches: 1 }).evidenceLine)
      .toBe("1 connection · 1 vouch");
  });

  it("tier di luar rentang jatuh ke New, bukan undefined", () => {
    expect(tierView(9, bukti).label).toBe("New");
    expect(tierView(-1, bukti).label).toBe("New");
  });

  it("tag saran berbahasa Inggris dan tanpa spasi tepi", () => {
    expect([...SUGGESTED_TAGS]).toEqual(["real builder", "solid dev", "knows zk", "designer", "research"]);
    for (const t of SUGGESTED_TAGS) expect(t.trim()).toBe(t);
  });
});

describe("label tier Inggris (spec desain UI §7.4)", () => {
  it("LABEL_TIER_EN sepanjang TIER_LABELS", () => {
    expect(LABEL_TIER_EN.length).toBe(TIER_LABELS.length);
  });

  it("labelTier 0–3 → New/Known/Trusted/Core; di luar jangkauan → New", () => {
    expect([0, 1, 2, 3].map(labelTier)).toEqual(["New", "Known", "Trusted", "Core"]);
    for (const t of [4, -1, 1.5, Number.NaN]) expect(labelTier(t), String(t)).toBe("New");
  });

  it("tierDariLabel mengurai label kawat Indonesia; tak dikenal → 0", () => {
    expect(["Baru", "Dikenal", "Terpercaya", "Inti"].map(tierDariLabel)).toEqual([0, 1, 2, 3]);
    expect(tierDariLabel("Trusted")).toBe(0);
    expect(tierDariLabel("")).toBe(0);
  });

  it("labelAksesTrust 0–3 → Trust: New … Trust: Core", () => {
    expect([0, 1, 2, 3].map(labelAksesTrust)).toEqual(["Trust: New", "Trust: Known", "Trust: Trusted", "Trust: Core"]);
  });

  it("ruas batang terisi = tier + 1; di luar jangkauan satu ruas", () => {
    expect(JUMLAH_RUAS_TRUST).toBe(4);
    expect([0, 1, 2, 3].map(ruasTerisiTrust)).toEqual([1, 2, 3, 4]);
    expect(ruasTerisiTrust(9)).toBe(1);
  });
});

// Label kawat Indonesia tidak pernah tampil (spec §7.4, §10.1): hanya
// src/tier.ts yang boleh menyentuh TIER_LABELS.
describe("TIER_LABELS hanya diimpor src/tier.ts", () => {
  it("tidak ada berkas lain di app/, components/, src/ yang memakai TIER_LABELS", () => {
    const berkas = ["app", "components", "src"].flatMap((d) => semuaBerkas(d)).filter((b) => b !== "src/tier.ts");
    expect(berkas.filter((b) => baca(b).includes("TIER_LABELS"))).toEqual([]);
  });
});
