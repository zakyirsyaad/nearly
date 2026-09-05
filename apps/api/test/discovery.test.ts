import { describe, expect, it } from "vitest";
import type { Hex } from "viem";
import { rankDiscovery, type DiscoveryCandidate } from "../src/discovery";

const NOW_SEC = 1_700_000_000;

function candidate(over: Partial<DiscoveryCandidate> = {}): DiscoveryCandidate {
  return {
    eventId: `0x${"1".repeat(64)}` as Hex,
    host: "0x000000000000000000000000000000000000aaaa",
    title: "Meetup", venueLabel: "Jakarta", centerCell: "qqguv1r",
    startsAt: BigInt(NOW_SEC + 3600), endsAt: BigInt(NOW_SEC + 7200),
    txHash: "0xtx" as Hex,
    hostScore: 0.1, rsvpCount: 0, hostConnections: 3, hostSlashed: false,
    ...over,
  } as DiscoveryCandidate;
}

describe("rankDiscovery", () => {
  it("menyembunyikan event dari host yang ter-slash", () => {
    const rows = rankDiscovery([candidate({ hostSlashed: true })], NOW_SEC);
    expect(rows).toHaveLength(0);
  });

  // Bot bisa menekan tombol, tapi bot tidak bisa membangun graf. Nol koneksi
  // berarti belum pernah bertemu siapa pun.
  it("menyembunyikan event dari host tanpa satu pun koneksi", () => {
    const rows = rankDiscovery([candidate({ hostConnections: 0 })], NOW_SEC);
    expect(rows).toHaveLength(0);
  });

  it("menyembunyikan event yang sudah selesai", () => {
    const rows = rankDiscovery([candidate({ endsAt: BigInt(NOW_SEC - 1) })], NOW_SEC);
    expect(rows).toHaveLength(0);
  });

  it("event yang sedang berlangsung tetap tampil", () => {
    const rows = rankDiscovery(
      [candidate({ startsAt: BigInt(NOW_SEC - 600), endsAt: BigInt(NOW_SEC + 600) })],
      NOW_SEC,
    );
    expect(rows).toHaveLength(1);
  });

  // Inti keputusan spec §8: host bertier Baru TIDAK disembunyikan, hanya
  // diletakkan di bawah. Kalau test ini berubah jadi "disembunyikan", halaman
  // discovery akan kosong di graf kecil.
  it("host ber-skor nol tetap tampil, hanya di bawah", () => {
    const kuat = candidate({ eventId: `0x${"a".repeat(64)}` as Hex, hostScore: 0.9 });
    const baru = candidate({ eventId: `0x${"b".repeat(64)}` as Hex, hostScore: 0 });
    const rows = rankDiscovery([baru, kuat], NOW_SEC);
    expect(rows.map((r) => r.eventId)).toEqual([kuat.eventId, baru.eventId]);
  });

  it("skor sama diurutkan yang paling dekat waktunya lebih dulu", () => {
    const nanti = candidate({
      eventId: `0x${"c".repeat(64)}` as Hex, startsAt: BigInt(NOW_SEC + 7200),
      endsAt: BigInt(NOW_SEC + 10800),
    });
    const segera = candidate({
      eventId: `0x${"d".repeat(64)}` as Hex, startsAt: BigInt(NOW_SEC + 60),
      endsAt: BigInt(NOW_SEC + 3600),
    });
    const rows = rankDiscovery([nanti, segera], NOW_SEC);
    expect(rows.map((r) => r.eventId)).toEqual([segera.eventId, nanti.eventId]);
  });

  it("tidak membocorkan kolom penyaring ke hasil", () => {
    const rows = rankDiscovery([candidate()], NOW_SEC);
    expect(rows[0]).not.toHaveProperty("hostSlashed");
    expect(rows[0]).not.toHaveProperty("hostConnections");
  });
});
