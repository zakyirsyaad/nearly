import { Link } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { CONFIG } from "../../../src/config";
import type { NearlySigner } from "../../../src/signer";
import { useDompet, useNearlySigner } from "../../../src/dompet/konteks-dompet";
import { perluPengingatCadangan, TEKS_PENGINGAT_CADANGAN } from "../../../src/dompet/teks-dompet";
import { useLencana } from "../../../src/lencana/konteks-lencana";
import { teksLencana } from "../../../src/messages";

export default function Home() {
  const signer = useNearlySigner(CONFIG.verifyingContract);
  const { punyaMnemonik, sudahDicadangkan } = useDompet();
  // Dompet belum siap — mis. sesaat setelah Ganti dompet, selagi layar ini
  // masih di tumpukan. Isi layar tidak dirender, supaya hook di dalamnya tidak
  // pernah berjalan tanpa signer (Ruling D4).
  if (!signer) return null;
  return (
    <HomeIsi
      key={signer.address}
      signer={signer}
      pengingatCadangan={perluPengingatCadangan({ punyaMnemonik, sudahDicadangkan })}
    />
  );
}

function HomeIsi({ signer, pengingatCadangan }: { signer: NearlySigner; pengingatCadangan: boolean }) {
  // Angka lencana dari (tabs)/_layout.tsx (spec desain UI §4.4, Ruling A11):
  // beranda tidak lagi menandatangani bukti sendiri hanya untuk lencana.
  const { belumDibaca, kecocokanBaru } = useLencana();
  const lencana = teksLencana(kecocokanBaru);
  const lencanaPesan = teksLencana(belumDibaca);

  return (
    <View style={s.root}>
      <Text style={s.h1}>Nearly</Text>
      {/* Alamat SELALU tampil — nama bukan identitas, alamat-lah identitasnya (spec §9.2). */}
      <Text style={s.addr} selectable>{signer.address}</Text>
      {pengingatCadangan && (
        <Link href="/dompet" style={s.spanduk}>{TEKS_PENGINGAT_CADANGAN}</Link>
      )}
      <Link href="/salaman" style={s.link}>Tampilkan QR-ku</Link>
      <Link href="/salaman?mode=pindai" style={s.link}>Pindai QR orang lain</Link>
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
      <Link href="/profil-saya" style={s.link}>Profil saya</Link>
      <Link href="/dompet" style={s.link}>Dompet</Link>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
  h1: { fontSize: 32, fontWeight: "700" },
  addr: { fontFamily: "Courier", fontSize: 13, opacity: 0.6 },
  spanduk: {
    fontSize: 14, lineHeight: 20, padding: 12, borderRadius: 8,
    backgroundColor: "#fff4d6", color: "#6b4a00", overflow: "hidden",
  },
  link: { fontSize: 17, paddingVertical: 12 },
});
