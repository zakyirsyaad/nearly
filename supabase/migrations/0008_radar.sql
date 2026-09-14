-- Nearly Fase 4b + 5: radar, visibilitas, notifikasi kedekatan
-- (docs/superpowers/specs/2026-09-14-nearly-fase-4b5-radar-design.md §4).
--
-- Diterapkan PEMILIK PROJECT, bukan sesi eksekusi. Semua kolom alamat huruf
-- kecil saja, dengan `~` bukan operator case-insensitive (pelajaran Fase 3b).
-- RLS menyala tanpa policy di setiap tabel baru: API memakai service role.

-- §4.1 Satu saklar per akun. Default `terlihat` (keputusan #2).
alter table profiles
  add column if not exists visibilitas text not null default 'terlihat'
    check (visibilitas in ('terlihat', 'tersembunyi'));

-- §4.2 Satu baris per (acara, orang), di-upsert setiap detak. BUKAN riwayat:
-- detak baru menimpa yang lama, jadi tabel ini tidak pernah bisa
-- merekonstruksi jalur gerak seseorang. `cell` hanya untuk memeriksa geofence
-- detak berikutnya, dan ikut terhapus bersama barisnya ≤ 24 jam.
create table if not exists kehadiran (
  event_id text not null references events(event_id) on delete cascade,
  address  text not null check (address ~ '^0x[0-9a-f]{40}$'),
  cell     char(7) not null,
  seen_at  timestamptz not null default now(),
  primary key (event_id, address)
);
create index if not exists kehadiran_event_seen on kehadiran (event_id, seen_at);
-- Pindah ke Tersembunyi menghapus SEMUA baris milik satu alamat.
create index if not exists kehadiran_address on kehadiran (address);
alter table kehadiran enable row level security;

-- §4.3 Dasar "sekali per pasangan per acara" dan batas 5 per orang per acara.
-- Setiap baris membuktikan dua orang berada di acara yang sama pada jam itu,
-- jadi tabel ini data lokasi dan ikut dihapus ≤ 24 jam.
create table if not exists notif_kedekatan (
  event_id text not null references events(event_id) on delete cascade,
  penerima text not null check (penerima ~ '^0x[0-9a-f]{40}$'),
  subjek   text not null check (subjek ~ '^0x[0-9a-f]{40}$'),
  sent_at  timestamptz not null default now(),
  primary key (event_id, penerima, subjek)
);
create index if not exists notif_kedekatan_penerima on notif_kedekatan (event_id, penerima);
alter table notif_kedekatan enable row level security;

-- §4.4 Barisnya TIDAK dihapus — hanya selnya dikosongkan. Keberadaan baris QR
-- yang menolak nonce dipakai ulang (handshake-gate.ts `nonce_used`,
-- event-gate.ts). Menghapus baris membuka replay; mengosongkan sel tidak.
alter table handshake_offers alter column cell drop not null;
alter table checkin_offers   alter column cell drop not null;

-- Penyapuan (§4.5) mencari `seen_at` / `sent_at` / `expires_at` lama.
create index if not exists kehadiran_seen on kehadiran (seen_at);
create index if not exists notif_kedekatan_sent on notif_kedekatan (sent_at);
-- `handshake_offers_expiry` dan `checkin_offers_expiry` sudah ada sejak 0001/0003.
