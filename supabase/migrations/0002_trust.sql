-- Nearly Fase 2. Enam tabel trust. RLS menyala tanpa policy publik, sama
-- seperti 0001: API mengaksesnya lewat service role key.

-- Satu-satunya kepercayaan yang disuntik manusia ke seluruh sistem. Semua
-- angka lain dihitung. Ubah isi tabel ini, dan seluruh papan skor berubah.
create table if not exists trust_seeds (
  address    text primary key check (address ~ '^0x[0-9a-f]{40}$'),
  weight     numeric not null default 1 check (weight > 0),
  note       text not null default '',
  added_at   timestamptz not null default now()
);

-- BERARAH: primary key (from_addr, to_addr), bukan pasangan kanonik seperti
-- connections. A menjamin B bukan hal yang sama dengan B menjamin A.
create table if not exists vouches (
  from_addr  text not null check (from_addr ~ '^0x[0-9a-f]{40}$'),
  to_addr    text not null check (to_addr ~ '^0x[0-9a-f]{40}$'),
  tags       text[] not null default '{}',
  tags_hash  text not null,
  tx_hash    text not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (from_addr, to_addr),
  constraint vouches_no_self check (from_addr <> to_addr)
);

create index if not exists vouches_to on vouches (to_addr) where revoked_at is null;

-- Isi laporan TIDAK PERNAH naik on-chain: ini tuduhan terhadap orang (spec §9.3).
create table if not exists reports (
  id         bigserial primary key,
  reporter   text not null check (reporter ~ '^0x[0-9a-f]{40}$'),
  subject    text not null check (subject ~ '^0x[0-9a-f]{40}$'),
  reason     text not null,
  evidence   text,
  status     text not null default 'baru'
             check (status in ('baru', 'layak_ditinjau', 'ditolak', 'terkonfirmasi')),
  created_at timestamptz not null default now(),
  -- Menutup cara paling murah menembus gerbang: satu orang mengirim laporan
  -- yang sama berkali-kali supaya terhitung sebagai beberapa pelapor.
  constraint reports_one_vote unique (reporter, subject),
  constraint reports_no_self check (reporter <> subject)
);

create index if not exists reports_subject on reports (subject);

create table if not exists slashes (
  subject      text primary key check (subject ~ '^0x[0-9a-f]{40}$'),
  confirmed_at timestamptz not null default now(),
  tx_hash      text not null
);

create table if not exists trust_snapshots (
  address          text primary key check (address ~ '^0x[0-9a-f]{40}$'),
  score            double precision not null,
  ratio            double precision not null,
  tier             smallint not null check (tier between 0 and 3),
  connections      integer not null default 0,
  occasions        integer not null default 0,
  regions          integer not null default 0,
  vouches          integer not null default 0,
  operator_cluster text,
  computed_at      timestamptz not null default now()
);

-- Menjawab satu pertanyaan: apakah tier alamat ini sudah berubah sejak terakhir
-- dipublikasi? Tanpa tabel ini tidak ada cara tahu transaksi mana yang layak
-- dikirim, dan penghematan gas di spec fase §7.1 tidak bisa ditegakkan.
create table if not exists trust_published (
  address      text primary key check (address ~ '^0x[0-9a-f]{40}$'),
  tier         smallint not null check (tier between 0 and 3),
  score        integer not null,
  tx_hash      text not null,
  published_at timestamptz not null default now()
);

-- Diversitas butuh tahu koneksi ini terjadi di sel mana (spec fase §4.3).
-- Fase 1 hanya menyimpan sel di handshake_offers, yang boleh dibersihkan;
-- koneksi harus membawa selnya sendiri karena ia permanen.
alter table connections add column if not exists cell char(7);

alter table trust_seeds enable row level security;
alter table vouches enable row level security;
alter table reports enable row level security;
alter table slashes enable row level security;
alter table trust_snapshots enable row level security;
alter table trust_published enable row level security;
