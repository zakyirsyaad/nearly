# Catatan Minor dari review Rencana B1 — masukan untuk Rencana B2

Review menyeluruh independen atas `037886a..5fe3fc5` (2026-09-21) menemukan
5 Important (sudah diperbaiki: `a51aa51`, `c1a7153`, `9414497`, `e301f66`,
dijaga `apps/mobile/test/review-b1.test.ts`) dan 11 Minor. Eksekutor B1
mencatat 3 Minor lain. Keempat belas Minor di bawah **belum** dikerjakan,
atas keputusan pemilik: direncanakan bersama layar B2.

Penulis Rencana B2: periksa ulang tiap butir terhadap kode saat itu — nomor
baris di bawah berlaku di `5fe3fc5`.

## Dari review independen

| # | Berkas | Masalah | Arah perbaikan |
|---|---|---|---|
| M1 | `(profil)/kecocokan.tsx:46-48`, `(profil)/blokir.tsx:50-53` | Muat ulang saat fokus yang gagal mengosongkan daftar yang sudah tampil; tidak ada Try again (§7.2), padahal kalimat `butuh_bukti` menyuruh "Reload this screen". | Pertahankan baris lama, tampilkan galat di atasnya; tambah Try again. Pola sama dengan perbaikan #I3 di `connections.tsx`. |
| M2 | `profile/[address].tsx:184`, `:204` | `handleVouch` / `handleReport` tanpa penjaga masuk ulang; ketuk ganda cepat mengirim dua vouch (yang kedua gagal "already vouched" di bawah toast berhasil). | Salin penjaga dari `toggleTanda` / `toggleBlokir` (ref, bukan state). |
| M3 | `(profil)/dompet.tsx:23, 102-107` | 12 kata tetap terbuka saat pindah tab (tab tetap terpasang) dan ikut tertangkap cuplikan app switcher. | Kosongkan `kata` di cleanup `useFocusEffect` dan saat `AppState` ke background. Keamanan — dahulukan di B2. |
| M4 | `(profil)/profil-saya.tsx` kepala | Kepala menampilkan nama yang sedang diketik (sebelum Save), dan "Unnamed" setelah gagal muat. | Simpan "nama tersimpan" terpisah dari isian. |
| M5 | `profile/[address].tsx:337-352`, `components/ui/button.tsx:97` | `Button` BNA bertinggi tetap; "Undo want to meet" di setengah lebar terpotong pada Dynamic Type besar. | `minHeight` di salinan Button, atau susun baris ke bawah saat `fontScale` besar. |
| M6 | `profile/[address].tsx:458` | Target sentuh "Done" ≈38 pt (<44). | Pakai `hitSlopSampai` seperti tombol Copy. |
| M7 | `(beranda)/index.tsx:180-188` | Batas 30 detik Beranda mulai berjalan walau semua pemuatan gagal; setelah salaman, Recently met bisa basi sampai 30 detik. | Setel `terakhir` hanya saat berhasil, atau paksa muat ulang Beranda setelah `postAccept` berhasil. |
| M8 | `components/salaman/sheet-bertemu.tsx:49-51` | Pemeriksaan `alamatKini` praktis tak terjangkau (bukan bug); tesnya hanya memeriksa keberadaan string. | Sederhanakan, atau jadikan tesnya bermakna. |
| M9 | `test/profil-orang.test.ts` ("kartu Meetings hanya muncul bila pertemuan ada") | Asersi selalu benar — `p.pertemuan ?` sudah muncul lebih awal. | Potong ke blok kartu Meetings sebelum mencocokkan. |
| M10 | `test/dompet-blokir-layar.test.ts`, `test/koneksi-kecocokan.test.ts` | Hanya `import` berkas tes lain, jadi suite yang sama berjalan dua kali dan menggelembungkan hitungan. | Hapus, atau jelaskan alasannya. |
| M11 | tes Beranda / Koneksi / Profil | Tidak ada tes percabangan galat-vs-kosong atau muat ulang saat fokus. | Sebagian sudah ditutup `test/review-b1.test.ts` (#I3, #I4); sisanya untuk Kecocokan dan Diblokir bersama M1. |

## Dari eksekutor B1 (laporan PR #5)

| # | Berkas | Saran |
|---|---|---|
| E1 | `(profil)/dompet.tsx` | Tombol "Copy address" terpisah di samping "Share address" (simulator/desktop). |
| E2 | `(profil)/profil-saya.tsx` `BarisTautan` | Ikon `ChevronRight` pada baris navigasi. |
| E3 | `(profil)/blokir.tsx` | Konfirmasi `Alert.alert` sebelum mencabut blokir. |
