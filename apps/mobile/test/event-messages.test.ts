import { describe, expect, it } from "vitest";
import { eventErrorMessage } from "../src/messages";

describe("eventErrorMessage", () => {
  it("menjelaskan syarat RSVP tanpa menyalahkan pengguna", () => {
    expect(eventErrorMessage("not_rsvped")).toContain("RSVP");
  });

  it("menjelaskan geofence dalam bahasa manusia", () => {
    const m = eventErrorMessage("outside_geofence");
    expect(m).toMatch(/venue/i);
    expect(m).not.toContain("geofence");
  });

  it("membedakan sel terlalu jauh dari waktu terlalu jauh", () => {
    expect(eventErrorMessage("not_colocated", "cell_too_far"))
      .not.toBe(eventErrorMessage("not_colocated", "time_too_far"));
  });

  it("kode yang tidak dikenal tetap menghasilkan kalimat, bukan undefined", () => {
    expect(typeof eventErrorMessage("entah_apa")).toBe("string");
    expect(eventErrorMessage("entah_apa").length).toBeGreaterThan(0);
  });
});
