-- Nearly Fase 1. Hanya tiga tabel; sisanya menyusul di fase masing-masing.

create table if not exists profiles (
  address     text primary key check (address ~ '^0x[0-9a-f]{40}$'),
  -- SENGAJA TIDAK UNIK (spec §9.2): nama bukan identitas, alamat-lah identitasnya.
  -- Tanpa keunikan, handle-squatting dan impersonasi via nama menjadi mustahil.
  display_name text not null default '',
  pfp_url     text,
  created_at  timestamptz not null default now()
);

create table if not exists handshake_offers (
  nonce       text primary key check (nonce ~ '^0x[0-9a-f]{64}$'),
  initiator   text not null references profiles(address) on delete cascade,
  expires_at  bigint not null,          -- unix DETIK
  sig_offer   text not null,
  cell        char(7) not null,         -- geohash7; server tidak pernah menyimpan GPS presisi
  at_ms       bigint not null,          -- MILIDETIK
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists handshake_offers_expiry on handshake_offers (expires_at);

create table if not exists connections (
  id         bigserial primary key,
  addr_a     text not null,
  addr_b     text not null,
  nonce      text not null unique,
  tx_hash    text not null,
  created_at timestamptz not null default now(),
  -- Urutan kanonik ditegakkan DI DATABASE, bukan di aplikasi. Ini sekaligus
  -- menegakkan "satu koneksi per pasangan orang, selamanya" (spec §9.4) dan
  -- membuat koneksi ke diri sendiri mustahil.
  constraint connections_ordered check (addr_a < addr_b),
  constraint connections_unique_pair unique (addr_a, addr_b)
);

create index if not exists connections_a_time on connections (addr_a, created_at desc);
create index if not exists connections_b_time on connections (addr_b, created_at desc);

-- RLS menyala tanpa satu pun policy publik: default menolak semua.
-- API mengakses lewat service role key yang melewati RLS.
-- JANGAN PERNAH mengirim service role key ke aplikasi mobile.
alter table profiles enable row level security;
alter table handshake_offers enable row level security;
alter table connections enable row level security;
