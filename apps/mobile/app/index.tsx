import { useEffect, useMemo, useState } from "react";
import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { CONFIG } from "../src/config";
import { createDevSigner } from "../src/signer";
import { getKecocokan, kueriBuktiKecocokan } from "../src/meet-api";
import { teksLencana } from "../src/messages";
import { sesiPesan } from "../src/pesan/sesi";
import { getBelumDibaca } from "../src/pesan/pesan-api";

export default function Home() {
  // Signer null kalau kunci pengembangan belum diisi — layar bantuan di bawah
  // yang menanganinya. Kondisinya SENGAJA tidak dicabang sebelum titik ini:
  // hook tidak boleh dilewati secara kondisional. `CONFIG` memang konstanta
  // modul sehingga cabangnya stabil hari ini, tapi layar ini sekarang punya
  // tiga hook sungguhan di belakangnya, dan `return` lebih awal menjadikan
  // urutan hook bergantung pada nilai konfigurasi — persis kelas bug yang
  // aturan hook ada untuk mencegahnya.
  const signer = useMemo(
    // Tanpa useMemo, createDevSigner mengembalikan objek baru tiap render —
    // referensi signer berubah, efek di bawah jadi dianggap punya dependensi
    // baru dan menembak ulang, dobel tanda tangan & fetch (lihat komentar di
    // dalam useEffect). Sama seperti kecocokan.tsx.
    () => (CONFIG.devPrivateKey
      ? createDevSigner(CONFIG.devPrivateKey, CONFIG.verifyingContract)
      : null),
    [],
  );

  const [baru, setBaru] = useState(0);
  const [belumDibaca, setBelumDibaca] = useState(0);

  useEffect(() => {
    if (!signer) return;
    // Satu tanda tangan per pembukaan beranda, hanya untuk angka lencana.
    // Ongkos yang dipilih sadar (spec §6.2): endpoint hitung tanpa autentikasi
    // akan membocorkan berapa kecocokan dimiliki sebuah alamat.
    //
    // Fungsi async DI DALAM useEffect, bukan useEffect yang async —
    // useEffect yang mengembalikan Promise merusak jalur pembersihannya.
    void (async () => {
      try {
        const { baru } = await getKecocokan(await kueriBuktiKecocokan(signer));
        setBaru(baru);
      } catch {
        // Beranda tidak boleh gagal hanya karena lencana gagal dimuat.
        setBaru(0);
      }
    })();

    // Lencana pesan, dengan kegagalannya sendiri: beranda tidak boleh gagal
    // hanya karena lencana. Membuka beranda memulai sesi kunci pesan — dengan
    // signer pengembangan tanpa jendela konfirmasi; dompet sungguhan kelak
    // akan meminta satu konfirmasi per kali buka aplikasi (spec 4c §5.1).
    void (async () => {
      try {
        const { total } = await getBelumDibaca(await sesiPesan(signer));
        setBelumDibaca(total);
      } catch {
        setBelumDibaca(0);
      }
    })();
  }, [signer]);

  const lencana = teksLencana(baru);
  const lencanaPesan = teksLencana(belumDibaca);

  if (!signer) {
    return (
      <View style={s.root}>
        <Text style={s.h1}>Nearly</Text>
        <Text style={s.p}>
          Isi EXPO_PUBLIC_DEV_PRIVATE_KEY untuk mode pengembangan. Connect wallet sungguhan
          menyusul setelah alur handshake terbukti jalan.
        </Text>
      </View>
    );
  }

  return (
    <View style={s.root}>
      <Text style={s.h1}>Nearly</Text>
      {/* Alamat SELALU tampil — nama bukan identitas, alamat-lah identitasnya (spec §9.2). */}
      <Text style={s.addr} selectable>{signer.address}</Text>
      <Link href="/qr" style={s.link}>Tampilkan QR-ku</Link>
      <Link href="/scan" style={s.link}>Pindai QR orang lain</Link>
      <Link href="/connections" style={s.link}>Koneksiku</Link>
      <Link href="/events" style={s.link}>Acara</Link>
      <Link href="/feed" style={s.link}>Feed</Link>
      <Link href="/kecocokan" style={s.link}>
        Saling ingin bertemu{lencana ? `  ${lencana}` : ""}
      </Link>
      <Link href="/pesan" style={s.link}>
        Pesan{lencanaPesan ? `  ${lencanaPesan}` : ""}
      </Link>
      <Link href="/blokir" style={s.link}>Daftar blokir</Link>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
  h1: { fontSize: 32, fontWeight: "700" },
  p: { fontSize: 15, lineHeight: 22, opacity: 0.7 },
  addr: { fontFamily: "Courier", fontSize: 13, opacity: 0.6 },
  link: { fontSize: 17, paddingVertical: 12 },
});
