import type { Address, Hex } from "viem";

export type PendingOffer = {
  nonce: Hex;
  initiator: Address;
  expiresAt: bigint;
  sigOffer: Hex;
  /** Sel geohash7 yang dikirim A sendiri. */
  cell: string;
  /** Milidetik. */
  atMs: number;
  consumed: boolean;
};

export type HandshakeStore = {
  putOffer(offer: Omit<PendingOffer, "consumed">): Promise<void>;
  getOffer(nonce: Hex): Promise<PendingOffer | null>;
  consumeOffer(nonce: Hex): Promise<void>;
  areConnected(a: Address, b: Address): Promise<boolean>;
  countConnectionsSince(addr: Address, sinceMs: number): Promise<number>;
  recordConnection(row: {
    a: Address; b: Address; nonce: Hex; txHash: Hex; atMs: number; cell: string;
  }): Promise<void>;
};

export type ChainPort = {
  submitConnect(args: {
    initiator: Address; counterparty: Address; nonce: Hex;
    expiresAt: bigint; sigOffer: Hex; sigAccept: Hex;
  }): Promise<Hex>;
};

export type GateDeps = {
  store: HandshakeStore;
  chain: ChainPort;
  profiles: ProfileStore;
  identity: IdentityPort;
  verifyingContract: Address;
  nowMs: () => number;
};

export type ConnectionRow = { address: Address; txHash: Hex; at: number };

export type ProfileStore = {
  listConnections(addr: Address, limit: number): Promise<ConnectionRow[]>;
  countConnections(addr: Address): Promise<number>;
  getDisplayName(addr: Address): Promise<string>;
};

export type IdentityPort = {
  /** ENS hidup di Ethereum mainnet, BUKAN di opBNB. */
  ensName(addr: Address): Promise<string | null>;
  txCount(addr: Address): Promise<number>;
};

import type { TrustGraph, TrustResult } from "@nearly/trust";

export type TrustStore = {
  loadGraph(nowMs: number): Promise<TrustGraph>;
  saveSnapshots(rows: TrustResult[], computedAt: number): Promise<void>;
  getSnapshot(addr: Address): Promise<TrustResult | null>;
  /** address -> tier yang terakhir benar-benar ditulis on-chain. */
  listPublishedTiers(): Promise<Map<string, number>>;
  markPublished(
    rows: { address: Address; tier: number; score: number; txHash: Hex }[],
  ): Promise<void>;
};

export type VouchStore = {
  countVouchesSince(from: Address, sinceMs: number): Promise<number>;
  /** "Pernah vouch", TERMASUK yang sudah dicabut. Dipakai untuk menolak vouch
   * kedua ke pasangan yang sama (satu vouch per pasangan, selamanya). */
  hasVouch(from: Address, to: Address): Promise<boolean>;
  /** Vouch yang MASIH berlaku (revoked_at is null). Dipakai untuk menjaga
   * revoke: tanpa ini API bisa meneruskan revoke ke pasangan yang belum
   * pernah vouch atau yang sudah dicabut, dan kontrak PASTI revert
   * NotVouched — membakar gas relayer untuk transaksi yang sudah tahu gagal. */
  isActiveVouch(from: Address, to: Address): Promise<boolean>;
  recordVouch(row: {
    from: Address; to: Address; tags: string[]; tagsHash: Hex; txHash: Hex;
  }): Promise<void>;
  markRevoked(from: Address, to: Address): Promise<void>;
};

export type ReportRow = { reporter: Address; subject: Address; atMs: number };

export type ReportStore = {
  /** Mengembalikan `reports.id` — bukti laporan pesan menaut ke sana (spec 4c §3.4). */
  recordReport(row: {
    reporter: Address; subject: Address; reason: string; evidence?: string;
  }): Promise<number>;
  listReports(subject: Address): Promise<ReportRow[]>;
  setReportStatus(subject: Address, status: string): Promise<void>;
  recordSlash(subject: Address, txHash: Hex): Promise<void>;
};

export type AttestorPort = {
  setScore(who: Address, score: number, tier: number): Promise<Hex>;
};

export type VouchChainPort = {
  submitVouch(args: {
    from: Address; to: Address; tagsHash: Hex; expiresAt: bigint; sig: Hex;
  }): Promise<Hex>;
  submitRevoke(args: {
    from: Address; to: Address; expiresAt: bigint; sig: Hex;
  }): Promise<Hex>;
  submitSlash(subject: Address): Promise<Hex>;
};

export type EventRecord = {
  eventId: Hex;
  host: Address;
  title: string;
  venueLabel: string;
  centerCell: string;
  /** unix DETIK */
  startsAt: bigint;
  /** unix DETIK */
  endsAt: bigint;
  txHash: Hex;
};

export type PendingCheckInOffer = {
  nonce: Hex;
  eventId: Hex;
  host: Address;
  expiresAt: bigint;
  sigHost: Hex;
  /** Sel geohash7 yang dikirim HOST sendiri. */
  cell: string;
  /** MILIDETIK. */
  atMs: number;
  consumed: boolean;
};

/** Satu baris kartu di halaman discovery. */
export type DiscoveryRow = EventRecord & { hostScore: number; rsvpCount: number };

export type EventStore = {
  recordEvent(row: EventRecord): Promise<void>;
  getEvent(eventId: Hex): Promise<EventRecord | null>;
  /** Sudah tersaring dan terurut (spec §8). `nowSec` unix DETIK. */
  listDiscovery(nowSec: number, limit: number): Promise<DiscoveryRow[]>;
  hasRsvp(eventId: Hex, who: Address): Promise<boolean>;
  recordRsvp(eventId: Hex, who: Address): Promise<void>;
  putCheckInOffer(offer: Omit<PendingCheckInOffer, "consumed">): Promise<void>;
  getCheckInOffer(nonce: Hex): Promise<PendingCheckInOffer | null>;
  consumeCheckInOffer(nonce: Hex): Promise<void>;
  hasCheckIn(eventId: Hex, who: Address): Promise<boolean>;
  recordCheckIn(row: {
    eventId: Hex; who: Address; nonce: Hex; cell: string; atMs: number; txHash: Hex;
  }): Promise<void>;
  attendanceSummary(eventId: Hex): Promise<{
    rsvps: number; checkins: number; rsvpBelumHadir: number;
  }>;
  /**
   * Alamat yang RSVP di satu event. Dipakai loop event (spec §4.3) untuk
   * dipotong dengan himpunan tanda. Tabel `rsvps` dimiliki fase event, jadi
   * store inilah yang membacanya.
   */
  rsvpAddresses(eventId: Hex): Promise<Address[]>;
};

export type AttendanceChainPort = {
  submitCreateEvent(a: {
    eventId: Hex; host: Address; startsAt: bigint; endsAt: bigint;
    centerCell: Hex; expiresAt: bigint; sigHost: Hex;
  }): Promise<Hex>;
  submitCheckIn(a: {
    eventId: Hex; attendee: Address; nonce: Hex; expiresAt: bigint;
    sigHost: Hex; sigAttendee: Hex;
  }): Promise<Hex>;
};

export type EventDeps = {
  events: EventStore;
  attendance: AttendanceChainPort;
  profiles: ProfileStore;
  /** Alamat AttendanceRegistry — domain EIP-712 terikat padanya. */
  attendanceContract: Address;
  nowMs: () => number;
};

export type ImageStatus = "none" | "pending" | "ready" | "failed";

export type PostRecord = {
  postId: Hex;
  author: Address;
  body: string;
  imageBucket: string | null;
  imageObject: string | null;
  imageMime: string | null;
  imageStatus: ImageStatus;
  /** MILIDETIK. */
  createdAtMs: number;
  deleted: boolean;
};

/**
 * Satu kandidat sebelum diperingkat. Semua medan turunan sudah dihidrasi di
 * store, supaya penilai tetap murni dan bisa diuji tanpa Supabase — pola yang
 * sama dengan DiscoveryCandidate di discovery.ts.
 */
export type FeedCandidate = PostRecord & {
  displayName: string;
  /** `ratio` dari trust_snapshots. 0 kalau penulis belum punya snapshot. */
  authorRatio: number;
  authorTier: number;
  authorConnections: number;
  authorSlashed: boolean;
  reportCount: number;
  likeCount: number;
  sudahSuka: boolean;
  /**
   * 0 (milikmu), 1, 2, atau null (luar jaringan / penonton anonim).
   *
   * `0` ada karena tanpanya unggahan penonton sendiri tiba dengan `hop: null`
   * dan dua hal salah sekaligus: kartunya berbunyi "Di luar jaringanmu" untuk
   * unggahan penulisnya sendiri, dan penilai mengalikan skornya dengan
   * JARAK_LUAR 0.3 seolah penulisnya orang asing bagi dirinya sendiri.
   */
  hop: 0 | 1 | 2 | null;
};

/** Satu kartu di feed, siap dikirim sebagai JSON. */
export type FeedRow = {
  postId: Hex;
  author: Address;
  displayName: string;
  tier: number;
  body: string;
  imageUrl: string | null;
  imageStatus: ImageStatus;
  likeCount: number;
  sudahSuka: boolean;
  hop: 0 | 1 | 2 | null;
  createdAtMs: number;
};

/**
 * URL baca publik Greenfield (spec §8.1). Dibangun saat baca, TIDAK disimpan —
 * endpoint storage provider bisa berubah tanpa membusukkan baris lama.
 */
export function imageUrlOf(
  spEndpoint: string | null, bucket: string | null, objectName: string | null,
): string | null {
  // `spEndpoint` null berarti Greenfield tidak dikonfigurasi. Tanpa endpoint
  // kita TIDAK TAHU di mana byte-nya bisa dibaca, jadi jawaban yang jujur
  // adalah "tidak ada URL" — bukan URL cacat tanpa host, yang akan tampil di
  // klien sebagai gambar rusak dan terbaca seperti bug penyimpanan.
  if (!spEndpoint || !bucket || !objectName) return null;
  return `${spEndpoint.replace(/\/+$/, "")}/view/${bucket}/${objectName}`;
}

export type FeedStore = {
  createPost(row: { postId: Hex; author: Address; body: string; createdAtMs: number }): Promise<void>;
  getPost(postId: Hex): Promise<PostRecord | null>;
  markDeleted(postId: Hex): Promise<void>;
  /** Idempoten: menyukai dua kali sama dengan sekali. */
  setLike(postId: Hex, who: Address, suka: boolean): Promise<void>;
  /** Idempoten lewat primary key gabungan (post_id, reporter). */
  addReport(postId: Hex, reporter: Address, reason: string): Promise<void>;
  setImagePending(postId: Hex, objectName: string, mime: string): Promise<void>;
  setImageDone(postId: Hex, bucket: string): Promise<void>;
  setImageFailed(postId: Hex): Promise<void>;
  /**
   * Sudah terhidrasi penuh dan siap diperingkat. `viewer` null berarti
   * penonton anonim: setiap `hop` null dan `sudahSuka` false (spec §6.5).
   *
   * `terbukti` memisahkan dua hal yang dulu satu (review akhir 4a, C1):
   * `viewer` dipakai untuk urutan graf seperti Fase 3b, dan boleh datang
   * tanpa bukti karena graf koneksi publik on-chain. Tapi efek BLOKIR —
   * menyaring unggahan dan memutus `hop` — hanya diterapkan kalau
   * `terbukti` true, yaitu rute sudah memverifikasi bukti LihatFeed milik
   * `viewer`. Untuk `viewer` tak terbukti, tabel `blocks` tidak dibaca sama
   * sekali; kalau dibaca, membandingkan feed dengan dan tanpa `who`
   * menyingkap hubungan blokir alamat mana pun. `sudahSuka` juga hanya
   * dihitung untuk penonton terbukti — siapa menyukai apa sama privatnya;
   * untuk `viewer` tak terbukti medan itu selalu false. `terbukti` tanpa
   * `viewer` tidak bermakna dan diperlakukan false.
   */
  listCandidates(a: {
    sinceMs: number; limit: number; viewer: Address | null; terbukti: boolean;
  }): Promise<FeedCandidate[]>;
};

export type GreenfieldPort = {
  bucket: string;
  spEndpoint: string;
  upload(a: { objectName: string; mime: string; bytes: Uint8Array }): Promise<void>;
};

export type FeedDeps = {
  feed: FeedStore;
  /**
   * `null` saat Greenfield tidak dikonfigurasi. Sengaja nullable, bukan port
   * tiruan yang selalu gagal: tipenya memaksa SETIAP pemanggil memutuskan apa
   * yang terjadi tanpa Greenfield, dan typecheck yang menangkapnya jauh lebih
   * murah daripada menemukannya lewat unggahan yang gagal diam-diam.
   */
  greenfield: GreenfieldPort | null;
  /** Alamat ConnectionRegistry — domain EIP-712 feed terikat padanya (spec §5). */
  verifyingContract: Address;
  nowMs: () => number;
};

/** Satu tanda: siapa, dan kapan tanda itu dibuat. MILIDETIK. */
export type Tanda = { address: Address; atMs: number };

/**
 * Dua orang saling menandai. `sejakMs` adalah waktu tanda KEDUA dibuat —
 * kecocokan baru ada saat yang kedua menandai.
 */
export type Kecocokan = { address: Address; sejakMs: number };

export type ProfilRingkas = { displayName: string; tier: number };

export type MeetStore = {
  /** `ingin` false berarti MENGHAPUS baris — angka publik ikut turun (spec §2.1). */
  setTanda(target: Address, who: Address, ingin: boolean): Promise<void>;
  /**
   * `kecuali` adalah alamat yang tidak boleh ikut dihitung — himpunan blokir
   * yang DIPILIH pemanggil (spec §5.2): dua arah (`himpunanUntuk`) untuk
   * kecocokan dan bendera pribadi, hanya pemblokir (`pemblokirUntuk`) untuk
   * angka publik dan `penandaHadir`. Diberikan pemanggil, bukan dibaca sendiri: store
   * ini memiliki tabel `ingin_bertemu` saja, dan store yang membaca tabel
   * orang lain adalah pola yang sudah ditolak sejak `rsvpAddresses` di
   * Fase 3c ditaruh di EventStore, bukan MeetStore.
   */
  hitungTanda(target: Address, kecuali: readonly string[]): Promise<number>;
  adaTanda(target: Address, who: Address, kecuali: readonly string[]): Promise<boolean>;
  /** Yang DITANDAI oleh `who`. */
  tandaOleh(who: Address, kecuali: readonly string[]): Promise<Tanda[]>;
  /** Yang MENANDAI `target`. */
  tandaKe(target: Address, kecuali: readonly string[]): Promise<Tanda[]>;
  cocokDilihatAtMs(who: Address): Promise<number | null>;
  setCocokDilihat(who: Address, atMs: number): Promise<void>;
  profilRingkas(addresses: Address[]): Promise<Map<string, ProfilRingkas>>;
};

/**
 * Daftar nama metode MeetStore, dipakai tes bentuk di meet-ports.test.ts.
 * Menambah metode tanpa memperbarui daftar ini membuat tes itu merah — dan
 * itulah gunanya: setiap fake di tes gerbang harus ikut diperbarui.
 *
 * Dua penjaga tipe di bawah membuat "diperbarui" bukan sekadar niat baik:
 * `satisfies` memastikan setiap nama di sini benar-benar metode MeetStore
 * (typo atau metode yang sudah dihapus akan gagal kompilasi), dan
 * `AssertNever<SisaMetodeMeetStore>` memastikan arah sebaliknya — kalau
 * MeetStore dapat metode baru yang belum disebut di sini, tipe
 * `SisaMetodeMeetStore` berhenti jadi `never` dan baris itu sendiri gagal
 * dikompilasi.
 */
export const METODE_MEET_STORE = [
  "setTanda", "hitungTanda", "adaTanda", "tandaOleh", "tandaKe",
  "cocokDilihatAtMs", "setCocokDilihat", "profilRingkas",
] as const satisfies readonly (keyof MeetStore)[];

type SisaMetodeMeetStore = Exclude<keyof MeetStore, (typeof METODE_MEET_STORE)[number]>;
type AssertNever<T extends never> = T;
type _PastikanMetodeMeetStoreLengkap = AssertNever<SisaMetodeMeetStore>;

export type MeetDeps = {
  meet: MeetStore;
  /**
   * Dibaca `setTanda` (menolak menandai saat terblokir) dan `daftarKecocokan`
   * (menyaring kecocokan dua arah) — spec §5.2.
   */
  blokir: BlokirStore;
  /** Alamat ConnectionRegistry — domain EIP-712 meet terikat padanya (spec §5). */
  verifyingContract: Address;
  nowMs: () => number;
};

/** Satu baris di daftar blokir. */
export type BarisBlokir = { address: Address; atMs: number };

/** Satu pasangan terblokir mentah, untuk memuat graf trust sekali jalan. */
export type PasanganBlokir = { blocker: string; blocked: string };

export type BlokirStore = {
  /** Idempoten. `blokir: false` menghapus barisnya. */
  setBlokir(blocker: Address, blocked: Address, blokir: boolean): Promise<void>;
  /** Hanya arah ini: apakah `blocker` memblokir `blocked`. */
  adaBlokir(blocker: Address, blocked: Address): Promise<boolean>;
  /** Yang DIBLOKIR oleh `who`, terbaru dulu. Hanya arah ini — cuma pemblokir
   * yang boleh melihat tombol cabut. */
  diblokirOleh(who: Address): Promise<BarisBlokir[]>;
  /**
   * Semua alamat yang punya hubungan blokir dengan `who` ke ARAH MANA PUN.
   * Inilah yang dipakai penyaringan feed (penonton terbukti saja), kecocokan,
   * dan bendera pribadi profil: blokir dua arah tidak peduli siapa yang
   * memulai. BUKAN untuk angka publik atau `penandaHadir` — di sana pakai
   * `pemblokirUntuk`. Set, bukan array, karena pemanggilnya menyaring daftar
   * dan array membuatnya kuadratik.
   */
  himpunanUntuk(who: Address): Promise<Set<string>>;
  /**
   * SATU arah: alamat yang MEMBLOKIR `who` (baris `blocked = who`). Dipakai
   * angka publik `inginBertemuCount` dan `penandaHadir` (spec §5.2 yang
   * diamandemen): hanya tanda dari orang yang memblokir `who` yang dibuang.
   * Himpunan dua arah di sana membuat tindakan blokir `who` sendiri
   * menggerakkan angkanya sendiri — oracle "siapa yang diam-diam menandaiku".
   */
  pemblokirUntuk(who: Address): Promise<Set<string>>;
};

export const METODE_BLOKIR_STORE = [
  "setBlokir", "adaBlokir", "diblokirOleh", "himpunanUntuk", "pemblokirUntuk",
] as const satisfies readonly (keyof BlokirStore)[];

// Arah kedua dari pengait: `satisfies` di atas menangkap nama yang salah eja
// atau dihapus; ini menangkap metode yang DITAMBAHKAN tanpa didaftarkan.
type SisaMetodeBlokirStore = Exclude<keyof BlokirStore, (typeof METODE_BLOKIR_STORE)[number]>;
type AssertNeverBlokir<T extends never> = T;
type _PastikanMetodeBlokirStoreLengkap = AssertNeverBlokir<SisaMetodeBlokirStore>;

export type BlokirDeps = {
  blokir: BlokirStore;
  /** Alamat ConnectionRegistry — domain EIP-712 blokir terikat padanya (spec §6). */
  verifyingContract: Address;
  nowMs: () => number;
};

// ── Fase 4c: pesan ──────────────────────────────────────────────────────────

export type BarisPesan = {
  id: string;
  pengirim: Address;
  penerima: Address;
  /** base64 — server tidak pernah melihat plaintext. */
  ciphertext: string;
  nonce: Hex;
  createdAtMs: number;
  dibacaAtMs: number | null;
};

export type KunciPesanTerdaftar = { kunciEnkripsi: Hex; kunciTanda: Hex };

export type BuktiTersimpan = {
  pesanId: string; isi: string; dikirimMs: number; tanda: Hex; kunciTanda: Hex;
};

export type PesanStore = {
  /** Upsert — mendaftar ulang dengan kunci yang sama tidak mengubah apa pun. */
  simpanKunci(address: Address, kunci: KunciPesanTerdaftar): Promise<void>;
  ambilKunci(address: Address): Promise<KunciPesanTerdaftar | null>;
  /** "sudah_ada" bila `id` sudah tersimpan — kirim ulang idempoten. */
  simpanPesan(row: {
    id: string; pengirim: Address; penerima: Address; ciphertext: string; nonce: Hex;
  }): Promise<"baru" | "sudah_ada">;
  /** Untuk rem laju: pesan dari `pengirim` sejak `sejakMs`. */
  hitungTerkirimSejak(pengirim: Address, sejakMs: number): Promise<number>;
  /** Pesan masuk DAN keluar `who`, terbaru dulu, paling banyak `batas`. */
  pesanTerbaruUntuk(who: Address, batas: number): Promise<BarisPesan[]>;
  /** Jumlah pesan belum dibaca per pengirim, untuk `penerima`. Berhalaman penuh. */
  belumDibacaPerPengirim(penerima: Address): Promise<Map<string, number>>;
  /** Dua arah antara `a` dan `b`, terbaru dulu. `sebelumMs` eksklusif. */
  riwayat(a: Address, b: Address, sebelumMs: number | null, batas: number): Promise<BarisPesan[]>;
  /** Pesan dari `pengirim` ke `penerima` dengan `createdAtMs <= sampaiMs`. */
  tandaiDibaca(penerima: Address, pengirim: Address, sampaiMs: number): Promise<void>;
  /** Untuk penggabungan push (spec 4c §7.1). */
  adaBelumDibacaLainDari(penerima: Address, pengirim: Address, kecualiId: string): Promise<boolean>;
  /** Satu token hanya milik satu dompet: mendaftarkannya mencabutnya dari dompet lain. */
  simpanTokenPush(address: Address, token: string): Promise<void>;
  tokenPush(address: Address): Promise<string[]>;
  hapusTokenPush(tokens: string[]): Promise<void>;
  pesanBerdasarkanId(ids: string[]): Promise<BarisPesan[]>;
  /** MENGGANTI bukti lama untuk laporan itu (spec 4c §3.4). */
  gantiBuktiLaporan(laporanId: number, bukti: BuktiTersimpan[]): Promise<void>;
};

export const METODE_PESAN_STORE = [
  "simpanKunci", "ambilKunci", "simpanPesan", "hitungTerkirimSejak",
  "pesanTerbaruUntuk", "belumDibacaPerPengirim", "riwayat", "tandaiDibaca",
  "adaBelumDibacaLainDari", "simpanTokenPush", "tokenPush", "hapusTokenPush",
  "pesanBerdasarkanId", "gantiBuktiLaporan",
] as const satisfies readonly (keyof PesanStore)[];

// Arah kedua dari pengait, sama seperti METODE_BLOKIR_STORE.
type SisaMetodePesanStore = Exclude<keyof PesanStore, (typeof METODE_PESAN_STORE)[number]>;
type AssertNeverPesan<T extends never> = T;
type _PastikanMetodePesanStoreLengkap = AssertNeverPesan<SisaMetodePesanStore>;

/** Pengirim notifikasi push. Implementasi HTTP di push.ts. */
export type PushPort = {
  kirim(p: {
    tokens: string[]; judul: string; badan: string; data: Record<string, string>;
  }): Promise<{ tokenMati: string[] }>;
};

export type PesanDeps = {
  pesan: PesanStore;
  blokir: BlokirStore;
  store: Pick<HandshakeStore, "areConnected">;
  /** Nama tampilan untuk daftar percakapan dan isi push — dipotong per kelompok. */
  meet: Pick<MeetStore, "profilRingkas">;
  reports: Pick<ReportStore, "recordReport">;
  /** null di tes dan saat push dimatikan. */
  push: PushPort | null;
  /** ConnectionRegistry — domain `DaftarKunciPesan`. */
  verifyingContract: Address;
  /** VouchRegistry — domain `Report`, sejak Fase 2. */
  vouchContract: Address;
  nowMs: () => number;
};

// ── Fase 6: graf publik ─────────────────────────────────────────────────────

/**
 * Satu koneksi seperti yang boleh dilihat endpoint graf publik. Sengaja TANPA
 * `cell` dan `nonce` (spec 6 §4.4): store graf tidak pernah memilih kolom itu,
 * jadi tidak ada yang bisa bocor lewat penyusun respons.
 */
export type KoneksiGraf = {
  id: number;
  /** Huruf kecil. */
  a: Address;
  /** Huruf kecil. */
  b: Address;
  /** MILIDETIK — `new Date(created_at).getTime()`, sama persis dengan trust. */
  atMs: number;
  txHash: Hex;
};

/** Jendela sebuah acara. Tanpa `center_cell` dan `host`, dengan sengaja. */
export type AcaraGraf = {
  /** Huruf kecil. */
  eventId: Hex;
  title: string;
  /** unix DETIK */
  startsAt: number;
  /** unix DETIK */
  endsAt: number;
};

export type CheckInGraf = { eventId: Hex; address: Address };

export type GrafStore = {
  /** Koneksi dengan `id > sejakId`, urut `id` naik, paling banyak `batas`. */
  koneksiSejak(sejakId: number, batas: number): Promise<KoneksiGraf[]>;
  acara(eventId: Hex): Promise<AcaraGraf | null>;
  /**
   * Acara yang jendelanya beririsan dengan `[mulaiDetik, akhirDetik]`,
   * termasuk acara pemilik jendela itu sendiri. BOLEH mengembalikan lebih
   * (superset): aturan acara di graf.ts yang memutuskan.
   */
  acaraBeririsan(mulaiDetik: number, akhirDetik: number): Promise<AcaraGraf[]>;
  checkInAcara(eventIds: Hex[]): Promise<CheckInGraf[]>;
  /**
   * SELURUH koneksi yang waktunya di `[mulaiMs, akhirMs]`, urut `id` naik.
   * BOLEH superset — aturan acara di graf.ts yang memutuskan.
   */
  koneksiDalamJendela(mulaiMs: number, akhirMs: number): Promise<KoneksiGraf[]>;
  /** Acara yang sudah mulai dan belum lewat 7 hari sejak berakhir, terbaru berakhir dulu. */
  daftarAcara(nowDetik: number, batas: number): Promise<AcaraGraf[]>;
};

export const METODE_GRAF_STORE = [
  "koneksiSejak", "acara", "acaraBeririsan", "checkInAcara", "koneksiDalamJendela", "daftarAcara",
] as const satisfies readonly (keyof GrafStore)[];

type SisaMetodeGrafStore = Exclude<keyof GrafStore, (typeof METODE_GRAF_STORE)[number]>;
type AssertNeverGraf<T extends never> = T;
type _PastikanMetodeGrafStoreLengkap = AssertNeverGraf<SisaMetodeGrafStore>;

export type GrafDeps = {
  graf: GrafStore;
  /** Nama tampilan + tier, dipotong per kelompok — sumber yang sama dengan feed dan pesan. */
  meet: Pick<MeetStore, "profilRingkas">;
  /** Origin web yang boleh membaca `/graf/*` lewat browser. Kosong = CORS mati. */
  webOrigins: readonly string[];
  nowMs: () => number;
};

