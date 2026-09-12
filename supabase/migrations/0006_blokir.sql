-- Fase 4a: blokir. Tabel TERSENDIRI, bukan kolom di `connections`, karena dua
-- alasan yang sama-sama memaksa (spec §2.1):
--
--   1. Orang asing bisa diblokir. `connections` menurut definisi hanya memuat
--      orang yang pernah ditemui; orang yang menandaimu dari feed tidak punya
--      baris di sana.
--   2. `connections` tidak bisa menyimpan arah. Skemanya `check (addr_a <
--      addr_b)` dengan satu baris per pasangan, jadi satu boolean di sana
--      tidak bisa membedakan "A memblokir B" dari "B memblokir A".
create table if not exists blocks (
  -- Huruf kecil SAJA. Fase 3b pernah kebobolan di sini: regex
  -- case-insensitive di kolom kunci membuat satu orang masuk dua kali dengan
  -- casing berbeda dan melubangi ambang tiga pelapor. Kunci di sini juga
  -- gabungan, jadi jebakannya identik.
  blocker    text not null check (blocker ~ '^0x[0-9a-f]{40}$'),
  blocked    text not null check (blocked ~ '^0x[0-9a-f]{40}$'),
  created_at timestamptz not null default now(),
  -- Arah disimpan eksplisit. Trust meruntuhkannya jadi simetris (spec §4),
  -- tapi antarmuka butuh tahu siapa yang memulai supaya hanya pemblokir yang
  -- melihat tombol cabut.
  primary key (blocker, blocked),
  -- Lapis TERAKHIR, bukan pengganti pemeriksaan gerbang (spec §7.1). Ia
  -- menahan penulisan langsung ke tabel di luar jalur rute; gerbang tetap
  -- yang menolak lebih dulu dengan pesan yang bisa dibaca pengguna.
  constraint blocks_bukan_diri_sendiri check (blocker <> blocked)
);

-- Arah kedua butuh indeksnya sendiri: primary key melayani kueri "siapa yang
-- diblokir X", indeks ini melayani "siapa yang memblokir X". Blokir dua arah
-- berarti KEDUA kueri itu panas.
create index if not exists blocks_blocked_idx on blocks (blocked);

-- RLS menyala tanpa policy, seperti setiap tabel lain. API memakai service
-- role key; ketiadaan policy inilah yang menahan klien anonim.
alter table blocks enable row level security;
