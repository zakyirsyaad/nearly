-- Fase 3c — Penanda "ingin bertemu". Tidak ada bagian fase ini yang menyentuh
-- blockchain: apa pun yang naik ke chain publik selamanya, dan penanda ini
-- WAJIB anonim (spec §2.3).

create table if not exists ingin_bertemu (
  target     text not null references profiles(address) on delete cascade,
  who        text not null references profiles(address) on delete cascade,
  created_at timestamptz not null default now(),
  -- Satu tanda per pasangan. Mencabut adalah PENGHAPUSAN baris, dan angka
  -- publiknya adalah hitungan baris untuk satu target (spec §2.1).
  primary key (target, who),
  -- Menandai diri sendiri tidak berarti apa-apa dan akan mengotori angka.
  -- Lapis kedua; lapis pertamanya ada di gerbang (spec §13.7).
  constraint ingin_bertemu_bukan_diri check (target <> who)
);

-- Kecocokan dan loop event membaca dari KEDUA arah: "siapa yang menandaiku"
-- memakai primary key, "siapa yang kutandai" memakai indeks ini.
create index if not exists ingin_bertemu_who_idx on ingin_bertemu (who);

-- Kecocokan tidak disimpan (spec §4.1), jadi "sudah dilihat" tidak bisa
-- ditempelkan padanya. Satu kolom nullable cukup: lencana menghitung
-- kecocokan yang lebih baru dari nilai ini, dan null berarti semuanya baru.
alter table profiles add column if not exists cocok_dilihat_at timestamptz;

-- RLS menyala tanpa policy, sama seperti setiap tabel lain di proyek ini.
alter table ingin_bertemu enable row level security;
