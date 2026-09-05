-- Nearly Fase 3a. Empat tabel event. RLS menyala tanpa policy publik, sama
-- seperti 0001 dan 0002: API mengaksesnya lewat service role key.

create table if not exists events (
  event_id    text primary key check (event_id ~ '^0x[0-9a-f]{64}$'),
  host        text not null references profiles(address) on delete cascade,
  title       text not null,
  -- Nama tempat yang ditulis host. TIDAK diverifikasi siapa pun (spec §13.3).
  venue_label text not null default '',
  -- Hanya sel pusat. Kedelapan tetangga DIHITUNG saat verifikasi, tidak
  -- disimpan: menyimpan turunan yang bisa dihitung ulang cuma menciptakan dua
  -- sumber kebenaran yang bisa berselisih.
  center_cell char(7) not null,
  starts_at   bigint not null,          -- unix DETIK, satuan yang sama dgn kontrak
  ends_at     bigint not null,          -- unix DETIK
  tx_hash     text not null,
  created_at  timestamptz not null default now(),
  constraint events_window check (ends_at > starts_at)
);

create index if not exists events_center_cell on events (center_cell);
create index if not exists events_ends_at on events (ends_at desc);

-- Keunikan pasangan inilah yang menegakkan satu RSVP per orang per event.
create table if not exists rsvps (
  event_id   text not null references events(event_id) on delete cascade,
  address    text not null check (address ~ '^0x[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  primary key (event_id, address)
);

-- Cermin handshake_offers dari Fase 1, dan alasannya sama: menahan pemutaran
-- ulang QR yang sudah dipakai.
create table if not exists checkin_offers (
  nonce       text primary key check (nonce ~ '^0x[0-9a-f]{64}$'),
  event_id    text not null references events(event_id) on delete cascade,
  host        text not null check (host ~ '^0x[0-9a-f]{40}$'),
  expires_at  bigint not null,          -- unix DETIK
  sig_host    text not null,
  cell        char(7) not null,         -- sel yang dikirim HOST sendiri
  at_ms       bigint not null,          -- MILIDETIK
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists checkin_offers_expiry on checkin_offers (expires_at);

-- Primary key (event_id, address) menegakkan "check-in sekali, selamanya" —
-- aturan yang sama ditegakkan lagi di kontrak. Dua lapis, sengaja.
create table if not exists checkins (
  event_id   text not null references events(event_id) on delete cascade,
  address    text not null check (address ~ '^0x[0-9a-f]{40}$'),
  nonce      text not null unique,
  cell       char(7) not null,
  at_ms      bigint not null,
  tx_hash    text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, address)
);

-- load-graph menanyakan check-in PER ORANG saat menetapkan occasion.
create index if not exists checkins_address on checkins (address);

alter table events enable row level security;
alter table rsvps enable row level security;
alter table checkin_offers enable row level security;
alter table checkins enable row level security;
