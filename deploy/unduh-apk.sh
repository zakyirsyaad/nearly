#!/bin/bash
# Mengunduh APK dari tautan artefak EAS ke /srv/nearly/unduh/nearly.apk dalam
# 8 potongan paralel (CDN EAS ±40 KB/s per koneksi). Dipasang hanya bila ukuran
# cocok dan zip utuh. Pakai: unduh-apk.sh <url-artefak> <ukuran-bait>
set -e
cd /srv/nearly/unduh
rm -f nearly.apk.tmp part.*
# Setiap potongan mengikuti redirect expo.dev sendiri: tautan S3 dari
# permintaan HEAD ditandatangani untuk HEAD dan ditolak untuk GET.
U=$1
T=$2; N=8; P=$(( (T + N - 1) / N ))
for i in $(seq 0 $((N-1))); do
  a=$((i*P)); b=$((a+P-1)); [ $b -ge $T ] && b=$((T-1))
  curl -sSL --fail --retry 5 -r $a-$b -o part.$i "$U" &
done
wait
cat $(for i in $(seq 0 $((N-1))); do echo part.$i; done) > nearly.apk.tmp
rm -f part.*
S=$(stat -c %s nearly.apk.tmp)
if [ "$S" = "$T" ] && unzip -tq nearly.apk.tmp >/dev/null; then
  mv nearly.apk.tmp nearly.apk
  echo "SELESAI $(sha256sum nearly.apk)"
else
  echo "GAGAL ukuran $S dari $T"
fi
