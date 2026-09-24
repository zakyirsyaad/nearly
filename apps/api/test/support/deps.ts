// Helper bersama untuk test route API. BUKAN berkas test (tidak berakhiran
// .test.ts, lihat vitest.config.ts: hanya "test/**/*.test.ts" yang dikumpulkan)
// supaya bisa di-import dari beberapa berkas test tanpa mendaftarkan ulang
// describe/it milik trust.route.test.ts.
import { vi } from "vitest";
import type { Address, Hex } from "viem";
import type { TrustDeps } from "../../src/app";

export const A = "0x000000000000000000000000000000000000000a" as Address;
export const B = "0x000000000000000000000000000000000000000b" as Address;
export const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;
export const NOW = 1_700_000_000_000;

/**
 * TrustDeps lengkap untuk createApp, seluruh port distub sebagai vi.fn().
 *
 * `overrides.saveSnapshots` dan `overrides.setScore` menggantikan spy default
 * trust.saveSnapshots / attestor.setScore, supaya test bisa mengamati jalur
 * recompute SUNGGUHAN (lewat onChanged di app.ts), bukan spy lokal yang tidak
 * tersambung ke apa pun.
 *
 * `overrides.trust`, `overrides.reports`, `overrides.vouchChain`,
 * `overrides.vouches`, dan `overrides.adminToken` di-merge di atas nilai
 * default masing-masing — dipakai admin.route.test.ts untuk mengendalikan
 * gerbang confirmSlash (snapshot pelapor, graf koneksi, dan hasil chain), dan
 * revoke-vouch.test.ts untuk mengendalikan status vouch aktif, tanpa
 * menduplikasi seluruh helper ini.
 */
export function depsFor(overrides: {
  saveSnapshots?: ReturnType<typeof vi.fn>;
  setScore?: ReturnType<typeof vi.fn>;
  recordReport?: ReturnType<typeof vi.fn>;
  trust?: Partial<TrustDeps["trust"]>;
  reports?: Partial<TrustDeps["reports"]>;
  vouchChain?: Partial<TrustDeps["vouchChain"]>;
  vouches?: Partial<TrustDeps["vouches"]>;
  adminToken?: string;
} = {}): TrustDeps {
  return {
    verifyingContract: CONTRACT,
    nowMs: () => NOW,
    store: {
      putOffer: vi.fn(async () => {}),
      getOffer: vi.fn(async () => null),
      consumeOffer: vi.fn(async () => {}),
      // true supaya jalur vouch (submitVouch -> areConnected) bisa lewat.
      areConnected: vi.fn(async () => true),
      countConnectionsSince: vi.fn(async () => 0),
      recordConnection: vi.fn(async () => {}),
    },
    chain: { submitConnect: vi.fn(async (): Promise<Hex> => "0xtx" as Hex) },
    profiles: {
      listConnections: vi.fn(async () => []),
      countConnections: vi.fn(async () => 0),
      getDisplayName: vi.fn(async () => ""),
    },
    identity: {
      ensName: vi.fn(async () => null),
      txCount: vi.fn(async () => 0),
    },
    trust: {
      // Graf minimal berisi satu seed, cukup untuk computeTrust menghasilkan
      // satu baris tanpa melempar.
      loadGraph: vi.fn(async () => ({
        edges: [], vouches: [], seeds: [{ address: A, weight: 1 }], slashed: [], nowMs: NOW,
      })),
      saveSnapshots: overrides.saveSnapshots ?? vi.fn(async () => {}),
      getSnapshot: vi.fn(async () => null),
      listPublishedTiers: vi.fn(async () => new Map()),
      markPublished: vi.fn(async () => {}),
      ...overrides.trust,
    },
    vouches: {
      countVouchesSince: vi.fn(async () => 0),
      hasVouch: vi.fn(async () => false),
      isActiveVouch: vi.fn(async () => true),
      recordVouch: vi.fn(async () => {}),
      markRevoked: vi.fn(async () => {}),
      ...overrides.vouches,
    },
    reports: {
      recordReport: overrides.recordReport ?? vi.fn(async () => 1),
      listReports: vi.fn(async () => []),
      setReportStatus: vi.fn(async () => {}),
      recordSlash: vi.fn(async () => {}),
      ...overrides.reports,
    },
    attestor: { setScore: overrides.setScore ?? vi.fn(async (): Promise<Hex> => "0xtx" as Hex) },
    vouchChain: {
      submitVouch: vi.fn(async (): Promise<Hex> => "0xtx" as Hex),
      submitRevoke: vi.fn(async (): Promise<Hex> => "0xtx" as Hex),
      submitSlash: vi.fn(async (): Promise<Hex> => "0xtx" as Hex),
      ...overrides.vouchChain,
    },
    vouchContract: CONTRACT,
    adminToken: overrides.adminToken ?? "test-admin-token",
    events: {
      recordEvent: vi.fn(async () => {}),
      getEvent: vi.fn(async () => null),
      listDiscovery: vi.fn(async () => []),
      hasRsvp: vi.fn(async () => false),
      recordRsvp: vi.fn(async () => {}),
      putCheckInOffer: vi.fn(async () => {}),
      getCheckInOffer: vi.fn(async () => null),
      consumeCheckInOffer: vi.fn(async () => {}),
      hasCheckIn: vi.fn(async () => false),
      recordCheckIn: vi.fn(async () => {}),
      attendanceSummary: vi.fn(async () => ({ rsvps: 0, checkins: 0, rsvpBelumHadir: 0 })),
      rsvpAddresses: vi.fn(async () => []),
    },
    attendance: {
      submitCreateEvent: vi.fn(async (): Promise<Hex> => "0xtx" as Hex),
      submitCheckIn: vi.fn(async (): Promise<Hex> => "0xtx" as Hex),
    },
    attendanceContract: CONTRACT,
    // Fase 3b: rute feed tidak diuji lewat helper ini (lihat feed.route.test.ts
    // sendiri), tapi TrustDeps butuh medan ini supaya createApp bisa dibangun
    // oleh test route lain (handshake, vouch, admin, dst).
    feed: {
      createPost: vi.fn(async () => {}),
      getPost: vi.fn(async () => null),
      markDeleted: vi.fn(async () => {}),
      setLike: vi.fn(async () => {}),
      addReport: vi.fn(async () => {}),
      setImagePending: vi.fn(async () => {}),
      setImageDone: vi.fn(async () => {}),
      setImageFailed: vi.fn(async () => {}),
      listCandidates: vi.fn(async () => []), getCandidate: vi.fn(async () => null),
    },
    greenfield: {
      bucket: "nearly-feed",
      spEndpoint: "https://sp.example",
      upload: vi.fn(async () => {}),
    },
    // Fase 3c: rute meet tidak diuji lewat helper ini (lihat meet.route.test.ts
    // sendiri), tapi TrustDeps butuh medan ini supaya createApp bisa dibangun
    // oleh test route lain (handshake, vouch, admin, dst).
    meet: {
      setTanda: vi.fn(async () => {}),
      hitungTanda: vi.fn(async () => 0),
      adaTanda: vi.fn(async () => false),
      tandaOleh: vi.fn(async () => []),
      tandaKe: vi.fn(async () => []),
      cocokDilihatAtMs: vi.fn(async () => null),
      setCocokDilihat: vi.fn(async () => {}),
      profilRingkas: vi.fn(async () => new Map()),
    },
    // Fase 4a: rute blokir tidak diuji lewat helper ini (lihat
    // blokir.route.test.ts sendiri), tapi TrustDeps butuh medan ini supaya
    // createApp bisa dibangun oleh test route lain (handshake, vouch, admin,
    // dst).
    blokir: {
      setBlokir: vi.fn(async () => {}),
      adaBlokir: vi.fn(async () => false),
      diblokirOleh: vi.fn(async () => []),
      himpunanUntuk: vi.fn(async () => new Set<string>()),
      pemblokirUntuk: vi.fn(async () => new Set<string>()),
    },
    pesan: {
      simpanKunci: vi.fn(async () => {}),
      ambilKunci: vi.fn(async () => null),
      simpanPesan: vi.fn(async () => "baru" as const),
      hitungTerkirimSejak: vi.fn(async () => 0),
      pesanTerbaruUntuk: vi.fn(async () => []),
      belumDibacaPerPengirim: vi.fn(async () => new Map<string, number>()),
      riwayat: vi.fn(async () => []),
      tandaiDibaca: vi.fn(async () => {}),
      adaBelumDibacaLainDari: vi.fn(async () => false),
      simpanTokenPush: vi.fn(async () => {}),
      tokenPush: vi.fn(async () => []),
      hapusTokenPush: vi.fn(async () => {}),
      pesanBerdasarkanId: vi.fn(async () => []),
      gantiBuktiLaporan: vi.fn(async () => {}),
    },
    push: null,
    // Fase 6: rute graf diuji di graf.route.test.ts dengan dunia sendiri, tapi
    // TrustDeps butuh medan ini supaya createApp bisa dibangun oleh test route
    // lain. `webOrigins` kosong = CORS mati, sama dengan env tanpa WEB_ORIGINS.
    graf: {
      koneksiSejak: vi.fn(async () => []),
      acara: vi.fn(async () => null),
      acaraBeririsan: vi.fn(async () => []),
      checkInAcara: vi.fn(async () => []),
      koneksiDalamJendela: vi.fn(async () => []),
      daftarAcara: vi.fn(async () => []),
    },
    webOrigins: [],
    // Fase 4b + 5: rute radar dan profil diuji lewat dunia-radar.ts, tapi
    // TrustDeps butuh medan ini supaya createApp bisa dibangun.
    radar: {
      ambilKehadiran: vi.fn(async () => null),
      simpanKehadiran: vi.fn(async () => {}),
      hapusKehadiran: vi.fn(async () => {}),
      hapusSemuaKehadiran: vi.fn(async () => {}),
      hadirSejak: vi.fn(async () => []),
      terhubungDengan: vi.fn(async () => new Set<string>()),
      hitungNotifKedekatan: vi.fn(async () => 0),
      sisipNotifKedekatan: vi.fn(async () => true),
      sapuLokasi: vi.fn(async () => ({ kehadiran: 0, notifKedekatan: 0, offerSalaman: 0, offerCheckIn: 0 })),
      hitungKoneksiBersama: vi.fn(async () => new Map<string, number>()),
    },
    profilSaya: {
      profilSaya: vi.fn(async () => ({ displayName: "", visibilitas: "terlihat" as const })),
      aturProfil: vi.fn(async () => {}),
      visibilitasBanyak: vi.fn(async () => new Map()),
    },
    // Desain UI: diuji di profile-pertemuan.route.test.ts dengan dunia
    // sendiri; TrustDeps butuh medan ini supaya createApp bisa dibangun.
    pertemuan: {
      koneksiPasangan: vi.fn(async () => null),
      acaraCheckInBersama: vi.fn(async () => []),
      penjaminAktif: vi.fn(async () => []),
    },
  };
}
