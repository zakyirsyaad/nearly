-- Fase 3b — Feed. Tidak ada bagian fase ini yang menyentuh chain BSC.

create table if not exists posts (
  post_id      text primary key check (post_id ~ '^0x[0-9a-f]{64}$'),
  author       text not null references profiles(address) on delete cascade,
  body         text not null check (char_length(body) between 1 and 500),
  -- Greenfield disimpan sebagai bucket + object, BUKAN URL jadi: endpoint
  -- storage provider bisa berubah tanpa membusukkan baris lama.
  image_bucket text,
  image_object text,
  image_mime   text,
  image_status text not null default 'none'
               check (image_status in ('none', 'pending', 'ready', 'failed')),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- Kandidat feed selalu diambil per jendela waktu terbaru (spec §11.6).
create index if not exists posts_created_at_idx on posts (created_at desc);
create index if not exists posts_author_idx on posts (author);

create table if not exists post_likes (
  post_id    text not null references posts(post_id) on delete cascade,
  address    text not null references profiles(address) on delete cascade,
  created_at timestamptz not null default now(),
  -- Satu suka per alamat per unggahan. Membatalkan suka = menghapus baris.
  primary key (post_id, address)
);

create table if not exists post_reports (
  post_id    text not null references posts(post_id) on delete cascade,
  reporter   text not null check (reporter ~ '^0x[0-9a-f]{40}$'),
  reason     text not null,
  created_at timestamptz not null default now(),
  -- Menutup cara termurah menembus ambang: satu orang melapor berkali-kali
  -- supaya terhitung beberapa pelapor. Sama seperti reports_one_vote.
  primary key (post_id, reporter)
);

-- RLS menyala tanpa policy, sama seperti setiap tabel lain di proyek ini.
-- API mengakses lewat service role key yang melewati RLS; tidak ada satu pun
-- jalur baca anonim langsung ke Postgres.
alter table posts enable row level security;
alter table post_likes enable row level security;
alter table post_reports enable row level security;
