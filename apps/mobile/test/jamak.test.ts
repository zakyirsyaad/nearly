import { describe, expect, it } from "vitest";
import { jamak, pasanganJamak } from "../src/jamak";

// Spec desain UI §7.4: n === 1 → tunggal, selainnya jamak (termasuk 0).
describe("jamak", () => {
  it("0 dan 2 memakai bentuk jamak, 1 memakai bentuk tunggal", () => {
    expect(jamak(0, "connection", "connections")).toBe("0 connections");
    expect(jamak(1, "connection", "connections")).toBe("1 connection");
    expect(jamak(2, "connection", "connections")).toBe("2 connections");
  });
});

describe("pasanganJamak (spec §7.1)", () => {
  it("memisahkan angka dan kata supaya bisa diberi gaya berbeda", () => {
    expect(pasanganJamak(12, "connection", "connections")).toEqual({ angka: "12", kata: "connections" });
    expect(pasanganJamak(1, "connection", "connections")).toEqual({ angka: "1", kata: "connection" });
    expect(pasanganJamak(0, "connection", "connections")).toEqual({ angka: "0", kata: "connections" });
  });

  it("jamak adalah gabungan angka dan kata pasanganJamak", () => {
    for (const n of [0, 1, 2, 7]) {
      const p = pasanganJamak(n, "event", "events");
      expect(jamak(n, "event", "events")).toBe(`${p.angka} ${p.kata}`);
    }
  });
});
