-- Fase 4c: pesan (spec 4c §3). Relay sendiri + E2E: server hanya menyimpan
-- ciphertext dan kunci PUBLIK. Kunci privat dan tanda tangan KunciPesan tidak
-- pernah sampai ke sini.
--
-- Semua kolom alamat huruf kecil SAJA, dengan `~` bukan operator case-insensitive. Fase 3b pernah
-- kebobolan: regex case-insensitive di kolom kunci membuat satu orang masuk
-- dua kali dengan casing berbeda.

create table if not exists kunci_pesan (
  address        text primary key check (address ~ '^0x[0-9a-f]{40}$'),
  kunci_enkripsi text not null check (kunci_enkripsi ~ '^0x[0-9a-f]{64}$'),
  kunci_tanda    text not null check (kunci_tanda ~ '^0x[0-9a-f]{64}$'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists pesan (
  -- Dibuat HP (uuid v4), supaya kirim ulang setelah jaringan putus idempoten.
  id         uuid primary key,
  pengirim   text not null check (pengirim ~ '^0x[0-9a-f]{40}$'),
  penerima   text not null check (penerima ~ '^0x[0-9a-f]{40}$'),
  ciphertext text not null check (char_length(ciphertext) between 1 and 16384),
  nonce      text not null check (nonce ~ '^0x[0-9a-f]{48}$'),
  created_at timestamptz not null default now(),
  dibaca_at  timestamptz,
  -- Lapis TERAKHIR. Gerbang menolak lebih dulu dengan `pesan_diri`.
  constraint pesan_bukan_diri_sendiri check (pengirim <> penerima)
);
-- Pesan TIDAK PERNAH dihapus di 4c, termasuk saat blokir: bukti laporan tidak
-- bisa dihilangkan pengirimnya, dan cabut blokir mengembalikan riwayat.

-- Daftar percakapan dan jumlah belum-dibaca.
create index if not exists pesan_penerima_idx on pesan (penerima, created_at desc);
-- Riwayat per pasangan (setiap arah) dan rem laju per pengirim.
create index if not exists pesan_pasangan_idx on pesan (pengirim, penerima, created_at desc);

create table if not exists token_push (
  address    text not null check (address ~ '^0x[0-9a-f]{40}$'),
  token      text not null check (char_length(token) between 1 and 200),
  created_at timestamptz not null default now(),
  -- Satu dompet bisa punya lebih dari satu HP.
  primary key (address, token)
);
-- Mencabut token dari dompet lain saat didaftarkan ulang (Task 6).
create index if not exists token_push_token_idx on token_push (token);

create table if not exists bukti_laporan_pesan (
  id          bigserial primary key,
  laporan_id  bigint not null references reports (id) on delete cascade,
  pesan_id    uuid not null references pesan (id),
  -- Plaintext yang DIBUKA pelapor untuk peninjau. Pesan lain tetap terenkripsi.
  isi         text not null check (char_length(isi) between 1 and 2000),
  dikirim_ms  bigint not null check (dikirim_ms >= 0),
  tanda       text not null check (tanda ~ '^0x[0-9a-f]{128}$'),
  -- Salinan kunci tanda terlapor SAAT diverifikasi, supaya bukti tetap bisa
  -- diperiksa ulang walau kunci kelak berganti versi.
  kunci_tanda text not null check (kunci_tanda ~ '^0x[0-9a-f]{64}$'),
  created_at  timestamptz not null default now()
);
create index if not exists bukti_laporan_pesan_laporan_idx on bukti_laporan_pesan (laporan_id);

alter table kunci_pesan enable row level security;
alter table pesan enable row level security;
alter table token_push enable row level security;
alter table bukti_laporan_pesan enable row level security;
