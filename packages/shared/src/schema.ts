import { z } from "zod";
import { GEOHASH_PRECISION } from "./geohash";
import { MAKS_ISI_PESAN } from "./pesan-kripto";
import { VISIBILITAS } from "./profil";

const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const bytes32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const signature = z.string().regex(/^0x[0-9a-fA-F]{130}$/);
const cell = z.string().length(GEOHASH_PRECISION).regex(/^[0-9b-hjkmnp-z]+$/);

// Satu definisi per konsep. Nama lama tetap dipakai skema Fase 1.
export const AddressSchema = address;
export const SignatureSchema = signature;

/**
 * Satuan waktu — sumber bug klasik:
 * - `expiresAt` = unix DETIK, string karena JSON tidak punya bigint
 * - `atMs`      = MILIDETIK dari Date.now()
 *
 * Setiap pihak mengirim `cell` dan `atMs` MILIKNYA SENDIRI. Tidak ada endpoint
 * yang menerima klaim lokasi atas nama orang lain.
 */
export const OfferRequestSchema = z.object({
  initiator: address,
  nonce: bytes32,
  expiresAt: z.string().regex(/^\d+$/),
  sigOffer: signature,
  cell,
  atMs: z.number().int().positive(),
});

export const AcceptRequestSchema = z
  .object({
    initiator: address,
    counterparty: address,
    nonce: bytes32,
    expiresAt: z.string().regex(/^\d+$/),
    sigAccept: signature,
    cell,
    atMs: z.number().int().positive(),
  })
  .refine((v) => v.initiator.toLowerCase() !== v.counterparty.toLowerCase(), {
    message: "tidak bisa handshake dengan diri sendiri",
    path: ["counterparty"],
  });

export type OfferRequest = z.infer<typeof OfferRequestSchema>;
export type AcceptRequest = z.infer<typeof AcceptRequestSchema>;

export const VouchRequestSchema = z.object({
  from: AddressSchema,
  to: AddressSchema,
  tags: z.array(z.string()).max(16),
  expiresAt: z.string().regex(/^\d+$/),
  sig: SignatureSchema,
});

export const RevokeRequestSchema = z.object({
  from: AddressSchema,
  to: AddressSchema,
  expiresAt: z.string().regex(/^\d+$/),
  sig: SignatureSchema,
});

export const ReportRequestSchema = z.object({
  reporter: AddressSchema,
  subject: AddressSchema,
  reason: z.string().min(10).max(1000),
  evidence: z.string().max(2000).optional(),
  expiresAt: z.string().regex(/^\d+$/),
  sig: SignatureSchema,
});

const DIGIT_RE = /^\d+$/;
const unixSeconds = z.string().regex(DIGIT_RE);

/**
 * Zod TETAP menjalankan .refine walau validasi field sudah gagal — statusnya
 * "dirty", bukan "aborted" — jadi nilai yang sampai ke sini bisa saja "besok"
 * dan BigInt() akan melempar. Yang benar bukan menelan galatnya diam-diam,
 * melainkan tidak ikut berpendapat: pesan untuk "bukan angka" sudah
 * dikeluarkan `unixSeconds` sendiri, dan refine tidak punya apa pun untuk
 * ditambahkan.
 */
function waktuTakTerbaca(...nilai: string[]): boolean {
  return nilai.some((s) => !DIGIT_RE.test(s));
}

/** Jendela acara paling lama satu hari. Lihat alasannya di bawah. */
const MAKS_DURASI_DETIK = 24n * 60n * 60n;

/** Seberapa jauh `startsAt` boleh berada di belakang `expiresAt`. */
const MAKS_MUNDUR_DETIK = 60n * 60n;

export const CreateEventRequestSchema = z
  .object({
    eventId: bytes32,
    host: address,
    title: z.string().min(1).max(120),
    venueLabel: z.string().max(160).default(""),
    cell,
    startsAt: unixSeconds,
    endsAt: unixSeconds,
    expiresAt: unixSeconds,
    sigHost: signature,
  })
  .refine((v) => waktuTakTerbaca(v.startsAt, v.endsAt)
    || BigInt(v.endsAt) > BigInt(v.startsAt), {
    message: "waktu selesai harus setelah waktu mulai",
    path: ["endsAt"],
  })
  // Jendela yang tak terbatas panjangnya membuat sebuah acara bisa menempel di
  // puncak discovery selamanya, padahal spec §8 mensyaratkan perhatian itu
  // DIPEROLEH. Ia juga memperlebar rentang waktu yang bisa dicap ulang oleh
  // eventOccasionFor di load-graph.
  .refine((v) => waktuTakTerbaca(v.startsAt, v.endsAt)
    || BigInt(v.endsAt) - BigInt(v.startsAt) <= MAKS_DURASI_DETIK, {
    message: "acara tidak boleh lebih lama dari 24 jam",
    path: ["endsAt"],
  })
  // Modul ini murni dan tidak punya jam. "Sekarang" diambil dari `expiresAt`
  // yang memang baru dibuat klien — dan gerbang server menolak `expiresAt`
  // yang sudah lewat, jadi expiresAt >= sekarang. Artinya batas ini menahan
  // startsAt mundur lebih dari satu jam dari waktu nyata; mengarang expiresAt
  // yang jauh ke depan hanya membuatnya makin ketat, bukan makin longgar.
  //
  // Yang dijaga: host yang memundurkan startsAt bisa membuat jendela acaranya
  // memuat koneksi-koneksi lama, dan eventOccasionFor akan mencap ulang koneksi
  // itu — melanggar janji spec §9 bahwa koneksi yang sudah ada tidak berubah
  // nilainya.
  .refine((v) => waktuTakTerbaca(v.startsAt, v.expiresAt)
    || BigInt(v.startsAt) + MAKS_MUNDUR_DETIK >= BigInt(v.expiresAt), {
    message: "waktu mulai tidak boleh lebih dari 1 jam di masa lalu",
    path: ["startsAt"],
  });

export const RsvpRequestSchema = z.object({
  eventId: bytes32,
  who: address,
  expiresAt: unixSeconds,
  sig: signature,
});

export const CheckInOfferRequestSchema = z.object({
  eventId: bytes32,
  nonce: bytes32,
  host: address,
  expiresAt: unixSeconds,
  sigHost: signature,
  cell,
  atMs: z.number().int().positive(),
});

export const CheckInRequestSchema = z.object({
  eventId: bytes32,
  nonce: bytes32,
  attendee: address,
  expiresAt: unixSeconds,
  sigAttendee: signature,
  cell,
  atMs: z.number().int().positive(),
});

export type CreateEventRequest = z.infer<typeof CreateEventRequestSchema>;
export type RsvpRequest = z.infer<typeof RsvpRequestSchema>;
export type CheckInOfferRequest = z.infer<typeof CheckInOfferRequestSchema>;
export type CheckInRequest = z.infer<typeof CheckInRequestSchema>;

/** Spec §2: teks 1–500 karakter. */
const postBody = z.string().min(1).max(500);

export const CreatePostRequestSchema = z.object({
  postId: bytes32,
  author: address,
  body: postBody,
  expiresAt: unixSeconds,
  sig: signature,
});

export const LikeRequestSchema = z.object({
  postId: bytes32,
  who: address,
  // Wajib boolean asli: tipe EIP-712-nya `bool`, dan "true" berupa string
  // akan menghasilkan digest yang berbeda tanpa suara.
  suka: z.boolean(),
  expiresAt: unixSeconds,
  sig: signature,
});

/**
 * Laporan BERTANDA TANGAN. `post_reports.reporter` bukan foreign key ke
 * `profiles` (migrasi 0004 hanya memeriksa format), jadi tanpa tanda tangan
 * tiga alamat karangan sudah cukup untuk menembus ambang 3 pelapor dan
 * menyembunyikan unggahan siapa pun. `reason` ikut ditandatangani.
 */
export const ReportPostRequestSchema = z.object({
  postId: bytes32,
  reporter: address,
  reason: z.string().min(10).max(1000),
  expiresAt: unixSeconds,
  sig: signature,
});

/**
 * Hapus memakai tipe EIP-712 `HapusPost` yang TERPISAH dari `Post` (spec §5).
 * Kalau memakai ulang `Post`, tanda tangan yang dibuat untuk memposting akan
 * sah sebagai perintah menghapus.
 */
export const DeletePostRequestSchema = z.object({
  postId: bytes32,
  author: address,
  expiresAt: unixSeconds,
  sig: signature,
});

/** Daftar putih mime. Tanpa ini, apa pun bisa disajikan dari domain SP. */
const imageMime = z.enum(["image/jpeg", "image/png"]);

/**
 * Batas atas panjang STRING base64-nya, bukan hanya byte hasil dekode.
 * Batas 2 MB setelah dekode (spec §9.1) ≈ 2.796.204 karakter base64
 * (`ceil(2.097.152 / 3) * 4`); 2.800.000 memberi sedikit ruang untuk padding
 * tanpa membuka celah yang berarti.
 *
 * Ini lapis KEDUA. Lapis pertamanya `bodyLimit` di rutenya, karena skema baru
 * berjalan setelah seluruh badan disangga dan diurai — terlambat untuk
 * melindungi memori.
 */
const MAKS_BASE64 = 2_800_000;

/** Memakai tipe `LampirGambar`, yang mengikat `mime` juga (spec §5). */
export const AttachImageRequestSchema = z.object({
  postId: bytes32,
  author: address,
  expiresAt: unixSeconds,
  sig: signature,
  mime: imageMime,
  dataBase64: z.string().min(1).max(MAKS_BASE64),
});

/**
 * Menandai atau mencabut. `ingin` wajib boolean asli: tipe EIP-712-nya `bool`,
 * dan "true" berupa string akan menghasilkan digest yang berbeda tanpa suara.
 *
 * Skema ini sengaja TIDAK menolak `target === who`. Penolakan menandai diri
 * sendiri ada di gerbang (spec §13.7); menaruhnya di dua tempat membuat
 * pemeriksaan gerbang tidak pernah terjangkau lewat rute.
 */
export const InginBertemuRequestSchema = z.object({
  target: address,
  who: address,
  ingin: z.boolean(),
  expiresAt: unixSeconds,
  sig: signature,
});

/** Tidak memuat `target` — ia tidak berbicara tentang orang lain. */
export const TandaiDilihatRequestSchema = z.object({
  who: address,
  expiresAt: unixSeconds,
  sig: signature,
});

/**
 * `target` boleh sama dengan `who`. Penolakan memblokir diri sendiri hidup di
 * gerbang (spec §7.1), bukan di sini — kalau skema ikut menolaknya,
 * pemeriksaan gerbang tidak akan pernah terjangkau lewat rute dan membusuk
 * jadi kode mati yang tidak ada tesnya bisa menjangkau.
 */
export const BlokirRequestSchema = z.object({
  target: address,
  who: address,
  // Wajib boolean asli: tipe EIP-712-nya `bool`, dan "true" berupa string
  // menghasilkan digest berbeda tanpa suara.
  blokir: z.boolean(),
  expiresAt: unixSeconds,
  sig: signature,
});

// ── Fase 4c: pesan ──────────────────────────────────────────────────────────

/** Huruf kecil saja: kolom basis data menuntutnya (spec 4c §3). */
const kunciPublik = z.string().regex(/^0x[0-9a-f]{64}$/);

export const DaftarKunciPesanRequestSchema = z.object({
  who: address,
  kunciEnkripsi: kunciPublik,
  kunciTanda: kunciPublik,
  expiresAt: unixSeconds,
  sig: signature,
});

export const KirimPesanRequestSchema = z.object({
  id: z.string().uuid(),
  penerima: address,
  ciphertext: z.string().min(1).max(16384).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  nonce: z.string().regex(/^0x[0-9a-f]{48}$/),
});

export const TandaiDibacaRequestSchema = z.object({
  sampaiMs: z.number().int().nonnegative(),
});

export const TokenPushRequestSchema = z.object({
  token: z.string().max(200).regex(/^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/),
});

export const LaporanPesanRequestSchema = z.object({
  laporan: ReportRequestSchema,
  bukti: z.array(z.object({
    pesanId: z.string().uuid(),
    isi: z.string().min(1).max(MAKS_ISI_PESAN),
    dikirimMs: z.number().int().nonnegative(),
    tanda: z.string().regex(/^0x[0-9a-f]{128}$/),
  })).min(1).max(5),
});

// ── Fase 4b + 5: radar dan profil ───────────────────────────────────────────

/** Badan `POST /radar/:eventId/detak`. Hanya sel geohash7 — tidak pernah koordinat. */
export const DetakRequestSchema = z.object({ cell });

/**
 * Badan `POST /profil`. `displayName` hanya dibatasi panjang MENTAH di sini,
 * sebagai penahan badan raksasa. Aturan nama yang sebenarnya (32 code point,
 * tanpa Cc/Cf) ditegakkan gerbang lewat `periksaNamaTampilan`, SETELAH tanda
 * tangan — kalau skema ikut menolaknya, 400 `nama_tidak_sah` tidak pernah
 * terjangkau dan urutan gerbang spec 4b+5 §7.2 berbohong.
 */
export const AturProfilRequestSchema = z.object({
  who: address,
  displayName: z.string().max(256),
  visibilitas: z.enum(VISIBILITAS),
  expiresAt: unixSeconds,
  sig: signature,
});

