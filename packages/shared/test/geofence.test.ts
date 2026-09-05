import { describe, expect, it } from "vitest";
import { geofenceCells, isInsideGeofence, isEventLive } from "../src/geofence";
import { neighborCells } from "../src/geohash";

const CENTER = "qqguv1r";

describe("geofenceCells", () => {
  it("berisi sel pusat dan kedelapan tetangganya", () => {
    const cells = geofenceCells(CENTER);
    expect(cells).toHaveLength(9);
    expect(cells).toContain(CENTER);
    for (const n of neighborCells(CENTER)) expect(cells).toContain(n);
  });

  it("tidak mengandung duplikat", () => {
    expect(new Set(geofenceCells(CENTER)).size).toBe(9);
  });
});

describe("isInsideGeofence", () => {
  it("sel pusat ada di dalam", () => {
    expect(isInsideGeofence(CENTER, CENTER)).toBe(true);
  });

  it("kedelapan tetangga ada di dalam", () => {
    for (const n of neighborCells(CENTER)) {
      expect(isInsideGeofence(CENTER, n)).toBe(true);
    }
  });

  it("sel yang jauh ada di luar", () => {
    expect(isInsideGeofence(CENTER, "w1xyz00")).toBe(false);
  });

  // Batas yang paling mudah salah: geofence berhenti di cincin PERTAMA.
  // Tetangga-dari-tetangga sudah di luar, dan kalau ini lolos berarti
  // areanya diam-diam jadi 3x lebih lebar dari yang ditulis spec.
  it("tetangga dari tetangga sudah di luar", () => {
    const ring1 = neighborCells(CENTER);
    const ring2 = ring1
      .flatMap((c) => neighborCells(c))
      .filter((c) => c !== CENTER && !ring1.includes(c));
    expect(ring2.length).toBeGreaterThan(0);
    for (const c of ring2) expect(isInsideGeofence(CENTER, c)).toBe(false);
  });
});

describe("isEventLive", () => {
  const starts = 1_700_000_000n;
  const ends = 1_700_003_600n;

  it("detik pertama termasuk", () => {
    expect(isEventLive(starts, ends, Number(starts) * 1000)).toBe(true);
  });

  it("detik terakhir termasuk", () => {
    expect(isEventLive(starts, ends, Number(ends) * 1000)).toBe(true);
  });

  it("satu detik sebelum mulai belum termasuk", () => {
    expect(isEventLive(starts, ends, (Number(starts) - 1) * 1000)).toBe(false);
  });

  it("satu detik setelah selesai sudah tidak termasuk", () => {
    expect(isEventLive(starts, ends, (Number(ends) + 1) * 1000)).toBe(false);
  });

  // atMs MILIDETIK, startsAt DETIK. Kalau konversinya lupa, milidetik akan
  // selalu jauh lebih besar dari detik dan SEMUA event tampak sudah selesai.
  it("milidetik di tengah detik mulai tetap dihitung sudah mulai", () => {
    expect(isEventLive(starts, ends, Number(starts) * 1000 + 999)).toBe(true);
  });
});
