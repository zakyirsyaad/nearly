import { describe, expect, it } from "vitest";
import { encodeCell, neighborCells } from "../src/geohash";
import { verifyColocation, COLOCATION_WINDOW_MS } from "../src/colocation";

const JAKARTA = encodeCell(-6.2088, 106.8456);
const BANDUNG = encodeCell(-6.9175, 107.6191);
const T = 1_700_000_000_000;

describe("verifyColocation", () => {
  it("menerima sel yang sama pada waktu yang sama", () => {
    expect(verifyColocation({ cell: JAKARTA, at: T }, { cell: JAKARTA, at: T }))
      .toEqual({ ok: true });
  });

  it("menerima sel yang bertetangga — orang di batas sel", () => {
    const tetangga = neighborCells(JAKARTA)[0]!;
    expect(verifyColocation({ cell: JAKARTA, at: T }, { cell: tetangga, at: T }))
      .toEqual({ ok: true });
  });

  it("MENOLAK sel yang berjauhan — inti seluruh premis produk", () => {
    expect(verifyColocation({ cell: JAKARTA, at: T }, { cell: BANDUNG, at: T }))
      .toEqual({ ok: false, reason: "cell_too_far" });
  });

  it("menerima selisih waktu tepat di batas jendela", () => {
    expect(verifyColocation(
      { cell: JAKARTA, at: T },
      { cell: JAKARTA, at: T + COLOCATION_WINDOW_MS },
    )).toEqual({ ok: true });
  });

  it("MENOLAK selisih waktu satu milidetik di luar jendela", () => {
    expect(verifyColocation(
      { cell: JAKARTA, at: T },
      { cell: JAKARTA, at: T + COLOCATION_WINDOW_MS + 1 },
    )).toEqual({ ok: false, reason: "time_too_far" });
  });

  it("MENOLAK selisih waktu di luar jendela ke arah negatif", () => {
    expect(verifyColocation(
      { cell: JAKARTA, at: T },
      { cell: JAKARTA, at: T - COLOCATION_WINDOW_MS - 1 },
    )).toEqual({ ok: false, reason: "time_too_far" });
  });

  it("memeriksa sel lebih dulu daripada waktu, supaya alasan penolakan tidak ambigu", () => {
    expect(verifyColocation(
      { cell: JAKARTA, at: T },
      { cell: BANDUNG, at: T + 999_999 },
    )).toEqual({ ok: false, reason: "cell_too_far" });
  });

  it("simetris — urutan argumen tidak mengubah hasil", () => {
    const a = { cell: JAKARTA, at: T };
    const b = { cell: BANDUNG, at: T };
    expect(verifyColocation(a, b)).toEqual(verifyColocation(b, a));
  });
});
