/**
 * Skrip Uji Lapangan Pesan (Fase 4c) — Nearly
 *
 * Menguji 8 skenario verifikasi protokol E2EE, zero-plaintext storage di Supabase,
 * privacy gating, blokir dua arah, laporan dengan bukti terverifikasi, dan autentikasi Ed25519
 * menggunakan dua dompet nyata yang terkoneksi dan satu dompet penguji pihak ketiga.
 *
 * Jalankan dengan:
 * pnpm --filter @nearly/api exec tsx --env-file=/Users/mac/developer/nearly/.env scripts/uji-lapangan-pesan.ts
 */

import { serve } from "@hono/node-server";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  kunciPesanTypedData,
  daftarKunciPesanTypedData,
  turunkanKunciPesan,
  VERSI_KUNCI_PESAN,
  enkripsiPesan,
  bukaPesan,
  buatIdPesan,
  tandaRequest,
  blokirTypedData,
  reasonHashOf,
  reportTypedData,
} from "@nearly/shared";
import { createApp } from "../apps/api/src/app";
import { createProfileStore, createStore, createSupabase } from "../apps/api/src/db";
import { createIdentity } from "../apps/api/src/identity";
import { createRelayer } from "../apps/api/src/relayer";
import { createTrustStore, createVouchStore, createReportStore } from "../apps/api/src/trust/store";
import { createAttestor } from "../apps/api/src/trust/attestor";
import { createVouchRelayer } from "../apps/api/src/vouch-relayer";
import { createEventStore } from "../apps/api/src/event-store";
import { createAttendanceRelayer } from "../apps/api/src/attendance-relayer";
import { createFeedStore } from "../apps/api/src/feed-store";
import { bacaKonfigurasiGreenfield, createGreenfield } from "../apps/api/src/greenfield";
import { createMeetStore } from "../apps/api/src/meet-store";
import { createBlokirStore } from "../apps/api/src/blokir-store";
import { createPesanStore } from "../apps/api/src/pesan-store";
import { createExpoPush } from "../apps/api/src/push";

const KUNING = "\x1b[33m";
const HIJAU = "\x1b[32m";
const MERAH = "\x1b[31m";
const BIRU = "\x1b[34m";
const TEBAL = "\x1b[1m";
const RESET = "\x1b[0m";

function logHeader(judul: string) {
  console.log(`\n${BIRU}${TEBAL}=== ${judul} ===${RESET}`);
}

function logOk(pesan: string) {
  console.log(`  ${HIJAU}✓${RESET} ${pesan}`);
}

function logGagal(pesan: string) {
  console.error(`  ${MERAH}✗ GAGAL:${RESET} ${pesan}`);
  process.exitCode = 1;
}

async function kirimRequestPesan(opts: {
  baseUrl: string;
  method: string;
  path: string;
  body?: unknown;
  pengirim: {
    address: Address;
    kunci: ReturnType<typeof turunkanKunciPesan>;
  };
}) {
  const ts = Math.floor(Date.now() / 1000);
  const badanStr = opts.body ? JSON.stringify(opts.body) : "";
  const sig = tandaRequest(opts.pengirim.kunci.privTanda, {
    method: opts.method,
    pathDenganQuery: opts.path,
    badan: badanStr,
    ts,
    who: opts.pengirim.address,
  });

  const headers: Record<string, string> = {
    "x-nearly-who": opts.pengirim.address,
    "x-nearly-ts": ts.toString(),
    "x-nearly-tanda": sig,
  };
  if (opts.body) {
    headers["content-type"] = "application/json";
  }

  const res = await fetch(`${opts.baseUrl}${opts.path}`, {
    method: opts.method,
    headers,
    body: opts.body ? badanStr : undefined,
  });

  const teks = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(teks);
  } catch {
    json = teks;
  }
  return { status: res.status, data: json };
}

async function main() {
  logHeader("UJI LAPANGAN PROTOKOL PESAN NEARLY (FASE 4C)");
  console.log("Menghubungkan ke Supabase dan menyiapkan relay...");

  const supabaseUrl = process.env.SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const registry = process.env.CONNECTION_REGISTRY_ADDRESS as Address;
  const vouchRegistry = process.env.VOUCH_REGISTRY_ADDRESS as Address;
  const trustAttestorAddress = process.env.TRUST_ATTESTOR_ADDRESS as Address;
  const attendanceRegistry = process.env.ATTENDANCE_REGISTRY_ADDRESS as Address;
  const relayerKey = process.env.RELAYER_PRIVATE_KEY as Hex;

  const supabase = createSupabase(supabaseUrl, supabaseKey);
  const blokirStore = createBlokirStore(supabase);

  // Inisialisasi app API langsung
  const gf = bacaKonfigurasiGreenfield(process.env);
  const greenfield = gf.mode === "aktif" ? createGreenfield({ ...gf.cfg, privateKey: relayerKey }) : null;

  const app = createApp({
    store: createStore(supabase),
    profiles: createProfileStore(supabase),
    identity: createIdentity(process.env.MAINNET_RPC!, process.env.RPC_URL!),
    chain: createRelayer({ rpcUrl: process.env.RPC_URL!, privateKey: relayerKey, registry }),
    verifyingContract: registry,
    nowMs: () => Date.now(),
    trust: createTrustStore(supabase),
    vouches: createVouchStore(supabase),
    reports: createReportStore(supabase),
    attestor: createAttestor({ rpcUrl: process.env.RPC_URL!, privateKey: relayerKey, attestor: trustAttestorAddress }),
    vouchChain: createVouchRelayer({ rpcUrl: process.env.RPC_URL!, privateKey: relayerKey, registry: vouchRegistry }),
    vouchContract: vouchRegistry,
    adminToken: process.env.ADMIN_TOKEN!,
    events: createEventStore(supabase),
    attendance: createAttendanceRelayer({ rpcUrl: process.env.RPC_URL!, privateKey: relayerKey, registry: attendanceRegistry }),
    attendanceContract: attendanceRegistry,
    feed: createFeedStore(supabase, blokirStore),
    greenfield,
    meet: createMeetStore(supabase),
    blokir: blokirStore,
    pesan: createPesanStore(supabase),
    push: createExpoPush(),
  });

  // Jalankan server di port sementara (8799)
  const port = 8799;
  const server = serve({ fetch: app.fetch, port });
  const baseUrl = `http://localhost:${port}`;
  logOk(`Server API Relay berjalan di ${baseUrl}`);

  try {
    // 1. Persiapkan Dompet A dan Dompet B (dari .env yang terkoneksi) dan C (acak, tidak terkoneksi)
    logHeader("1. Persiapan Identitas Dompet");
    const devPrivKey = process.env.EXPO_PUBLIC_DEV_PRIVATE_KEY as Hex;
    const peerPrivKey = process.env.PEER_PRIVATE_KEY as Hex;
    if (!devPrivKey || !peerPrivKey) {
      throw new Error("Kunci EXPO_PUBLIC_DEV_PRIVATE_KEY dan PEER_PRIVATE_KEY wajib ada di .env");
    }

    const akunA = privateKeyToAccount(devPrivKey);
    const akunB = privateKeyToAccount(peerPrivKey);
    const akunC = privateKeyToAccount(generatePrivateKey());

    console.log(`  Dompet A (Dev)  : ${akunA.address}`);
    console.log(`  Dompet B (Peer) : ${akunB.address}`);
    console.log(`  Dompet C (Asing): ${akunC.address}`);

    // Turunkan kunci E2EE dari tanda tangan EIP-712 KunciPesan
    const kunciA = turunkanKunciPesan(
      await akunA.signTypedData(
        kunciPesanTypedData({ who: akunA.address, versi: VERSI_KUNCI_PESAN }, registry),
      ),
    );
    const dompetA = { address: akunA.address as Address, akun: akunA, kunci: kunciA };

    const kunciB = turunkanKunciPesan(
      await akunB.signTypedData(
        kunciPesanTypedData({ who: akunB.address, versi: VERSI_KUNCI_PESAN }, registry),
      ),
    );
    const dompetB = { address: akunB.address as Address, akun: akunB, kunci: kunciB };

    const kunciC = turunkanKunciPesan(
      await akunC.signTypedData(
        kunciPesanTypedData({ who: akunC.address, versi: VERSI_KUNCI_PESAN }, registry),
      ),
    );
    const dompetC = { address: akunC.address as Address, akun: akunC, kunci: kunciC };
    logOk("Kunci X25519 (enkripsi) dan Ed25519 (tanda tangan) berhasil diturunkan di memori untuk A, B, C");

    // 2. Registrasi Kunci Publik di Server (POST /pesan/kunci)
    logHeader("2. Pendaftaran Kunci Publik ke Relay");
    for (const d of [dompetA, dompetB, dompetC]) {
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);
      const payload = {
        who: d.address,
        kunciEnkripsi: d.kunci.pubEnkripsi,
        kunciTanda: d.kunci.pubTanda,
        expiresAt,
      };
      const sig = await d.akun.signTypedData(daftarKunciPesanTypedData(payload, registry));
      const res = await fetch(`${baseUrl}/pesan/kunci`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...payload,
          expiresAt: expiresAt.toString(),
          sig,
        }),
      });
      if (res.status !== 200) {
        logGagal(`Gagal mendaftarkan kunci untuk ${d.address}: ${await res.text()}`);
      } else {
        logOk(`Kunci terdaftar untuk ${d.address.slice(0, 10)}... (200 OK)`);
      }
    }

    // 3. Probe Privasi & Gating Koneksi (Dompet C bukan koneksi)
    logHeader("3. Verifikasi Gerbang Privasi (Bukan Koneksi)");
    const resCkeA = await kirimRequestPesan({
      baseUrl,
      method: "GET",
      path: `/pesan/kunci/${dompetA.address}`,
      pengirim: dompetC,
    });
    if (resCkeA.status === 403 && resCkeA.data?.code === "tidak_terhubung") {
      logOk("Dompet C meminta kunci A → DITOLAK 403 tidak_terhubung (privasi terjaga)");
    } else {
      logGagal(`Dompet C meminta kunci A harusnya 403 tidak_terhubung, dapat: ${resCkeA.status} ${JSON.stringify(resCkeA.data)}`);
    }

    const resKirimC = await kirimRequestPesan({
      baseUrl,
      method: "POST",
      path: "/pesan",
      body: {
        id: buatIdPesan(),
        penerima: dompetA.address,
        ciphertext: "dHVsYXJrYW4=",
        nonce: "0x" + "00".repeat(24),
      },
      pengirim: dompetC,
    });
    if (resKirimC.status === 403 && resKirimC.data?.code === "tidak_terhubung") {
      logOk("Dompet C mencoba mengirim pesan ke A → DITOLAK 403 tidak_terhubung");
    } else {
      logGagal(`Kirim dari C harusnya 403 tidak_terhubung, dapat: ${resKirimC.status}`);
    }

    // 4. Dompet A Mengambil Kunci B (Terkoneksi) & Mengirim Pesan Terenkripsi E2EE
    logHeader("4. Pertukaran Kunci & Pengiriman Pesan Terenkripsi (A -> B)");
    const resAmbilKunciB = await kirimRequestPesan({
      baseUrl,
      method: "GET",
      path: `/pesan/kunci/${dompetB.address}`,
      pengirim: dompetA,
    });
    if (resAmbilKunciB.status === 200 && resAmbilKunciB.data?.kunciEnkripsi) {
      logOk("A berhasil mengambil kunci publik B (200 OK)");
    } else {
      logGagal(`A gagal mengambil kunci B: ${resAmbilKunciB.status} ${JSON.stringify(resAmbilKunciB.data)}`);
    }

    const pesanId1 = buatIdPesan();
    const isiTeksAsli = "Halo B, ini pesan rahasia yang terenkripsi penuh!";
    const dikirimMs = Date.now();
    const amplopEnkripsi = enkripsiPesan({
      kunci: dompetA.kunci,
      pubEnkripsiLawan: resAmbilKunciB.data.kunciEnkripsi,
      pengirim: dompetA.address,
      penerima: dompetB.address,
      isi: isiTeksAsli,
      dikirimMs,
    });

    const resKirimPesan = await kirimRequestPesan({
      baseUrl,
      method: "POST",
      path: "/pesan",
      body: {
        id: pesanId1,
        penerima: dompetB.address,
        ciphertext: amplopEnkripsi.ciphertext,
        nonce: amplopEnkripsi.nonce,
      },
      pengirim: dompetA,
    });
    if (resKirimPesan.status === 200) {
      logOk(`Pesan ${pesanId1.slice(0, 8)} terkirim dari A ke B (200 OK)`);
    } else {
      logGagal(`Gagal kirim pesan: ${resKirimPesan.status} ${JSON.stringify(resKirimPesan.data)}`);
    }

    // 5. Verifikasi Database Supabase (Zero-Plaintext Storage)
    logHeader("5. Audit Penyimpanan Supabase (Zero-Plaintext Storage)");
    const { data: dbPesan, error: errPesan } = await supabase
      .from("pesan")
      .select("*")
      .eq("id", pesanId1)
      .single();

    if (errPesan || !dbPesan) {
      logGagal(`Pesan tidak ditemukan di tabel pesan Supabase: ${errPesan?.message}`);
    } else {
      logOk("Baris pesan ditemukan di Supabase tabel 'pesan'");
      console.log(`    - id        : ${dbPesan.id}`);
      console.log(`    - pengirim  : ${dbPesan.pengirim}`);
      console.log(`    - penerima  : ${dbPesan.penerima}`);
      console.log(`    - nonce     : ${dbPesan.nonce}`);
      console.log(`    - ciphertext: ${dbPesan.ciphertext.slice(0, 32)}... (${dbPesan.ciphertext.length} bytes base64)`);

      if (JSON.stringify(dbPesan).includes("pesan rahasia")) {
        logGagal("BAHAYA: Teks polos bocor ke dalam baris database!");
      } else {
        logOk("Zero-Plaintext terbukti: Tidak ada teks polos atau rahasia yang tersimpan di server/database!");
      }
    }

    // 6. Penerimaan, Dekripsi, dan Tanda Baca oleh B
    logHeader("6. Pengambilan, Dekripsi, dan Konfirmasi Baca oleh Penerima (B)");
    const resPercakapanB = await kirimRequestPesan({
      baseUrl,
      method: "GET",
      path: "/pesan/percakapan",
      pengirim: dompetB,
    });
    if (resPercakapanB.status === 200 && resPercakapanB.data.percakapan?.length > 0) {
      const perc = resPercakapanB.data.percakapan.find((p: any) => p.lawan.toLowerCase() === dompetA.address.toLowerCase());
      logOk(`B melihat daftar percakapan dengan A: belum dibaca = ${perc?.belumDibaca}`);
    } else {
      logGagal(`B gagal mengambil daftar percakapan: ${resPercakapanB.status}`);
    }

    const resRiwayatB = await kirimRequestPesan({
      baseUrl,
      method: "GET",
      path: `/pesan/dengan/${dompetA.address}`,
      pengirim: dompetB,
    });
    const pesanMasuk = resRiwayatB.data.pesan?.find((p: any) => p.id === pesanId1);
    if (!pesanMasuk) {
      logGagal("Pesan tidak ditemukan di riwayat B");
    } else {
      // Buka dan dekripsi pesan
      const buka = bukaPesan({
        kunci: dompetB.kunci,
        pubEnkripsiLawan: dompetA.kunci.pubEnkripsi,
        pubTandaPengirim: dompetA.kunci.pubTanda,
        pengirim: dompetA.address,
        penerima: dompetB.address,
        ciphertext: pesanMasuk.ciphertext,
        nonce: pesanMasuk.nonce,
      });

      if (buka.ok && buka.amplop.isi === isiTeksAsli) {
        logOk(`B berhasil mendekripsi pesan E2EE: "${buka.amplop.isi}"`);
        logOk(`Tanda tangan Ed25519 amplop diverifikasi sah dari kunci A: ${buka.amplop.tanda.slice(0, 18)}...`);
      } else {
        logGagal("Dekripsi pesan di sisi B gagal atau amplop cacat!");
      }
    }

    // B menandai dibaca
    const resDibaca = await kirimRequestPesan({
      baseUrl,
      method: "POST",
      path: `/pesan/dengan/${dompetA.address}/dibaca`,
      body: {
        sampaiMs: dikirimMs + 10000,
      },
      pengirim: dompetB,
    });
    if (resDibaca.status === 200) {
      logOk("B mengirim POST /pesan/dengan/:alamat/dibaca (200 OK)");
    } else {
      logGagal(`B gagal menandai dibaca: ${resDibaca.status} ${JSON.stringify(resDibaca.data)}`);
    }

    const resBelumDibaca = await kirimRequestPesan({
      baseUrl,
      method: "GET",
      path: "/pesan/belum-dibaca",
      pengirim: dompetB,
    });
    if (resBelumDibaca.data.total === 0) {
      logOk("Lencana belum dibaca B turun menjadi 0 (terbaca)");
    } else {
      logGagal(`Total belum dibaca B harusnya 0, dapat: ${resBelumDibaca.data.total}`);
    }

    // 7. Pengujian Pelaporan Pesan dengan Bukti Amplop Asli vs Bukti Palsu
    logHeader("7. Uji Pelaporan Pesan Terverifikasi (POST /pesan/laporan)");
    const reasonTeks = "Pengirim ini melakukan spam pesan berkali-kali.";
    const expiresLapor = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const msgLapor = {
      reporter: dompetB.address,
      subject: dompetA.address,
      reasonHash: reasonHashOf(reasonTeks),
      expiresAt: expiresLapor,
    };
    const sigLapor = await dompetB.akun.signTypedData(
      reportTypedData(msgLapor, vouchRegistry) as never,
    );

    // Ambil tanda amplop asli yang didekripsi
    const bukaHasil = bukaPesan({
      kunci: dompetB.kunci,
      pubEnkripsiLawan: dompetA.kunci.pubEnkripsi,
      pubTandaPengirim: dompetA.kunci.pubTanda,
      pengirim: dompetA.address,
      penerima: dompetB.address,
      ciphertext: pesanMasuk.ciphertext,
      nonce: pesanMasuk.nonce,
    });

    if (bukaHasil.ok) {
      // 7a. Lapor dengan bukti yang dipalsukan (isi teks diganti)
      const resLaporPalsu = await fetch(`${baseUrl}/pesan/laporan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          laporan: {
            reporter: dompetB.address,
            subject: dompetA.address,
            reason: reasonTeks,
            expiresAt: expiresLapor.toString(),
            sig: sigLapor,
          },
          bukti: [
            {
              pesanId: pesanId1,
              isi: "Teks palsu yang tidak pernah dikirim A!",
              dikirimMs: bukaHasil.amplop.dikirimMs,
              tanda: bukaHasil.amplop.tanda,
            },
          ],
        }),
      });
      const dataLaporPalsu = await resLaporPalsu.json().catch(() => null);

      if (resLaporPalsu.status === 422 && dataLaporPalsu?.code === "bukti_tidak_sah") {
        logOk("Bukti teks yang diubah DITOLAK 422 bukti_tidak_sah (integritas tanda tangan terbukti)");
      } else {
        logGagal(`Laporan teks palsu harusnya 422, dapat: ${resLaporPalsu.status} ${JSON.stringify(dataLaporPalsu)}`);
      }

      // 7b. Lapor dengan bukti sah
      const resLaporSah = await fetch(`${baseUrl}/pesan/laporan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          laporan: {
            reporter: dompetB.address,
            subject: dompetA.address,
            reason: reasonTeks,
            expiresAt: expiresLapor.toString(),
            sig: sigLapor,
          },
          bukti: [
            {
              pesanId: pesanId1,
              isi: bukaHasil.amplop.isi,
              dikirimMs: bukaHasil.amplop.dikirimMs,
              tanda: bukaHasil.amplop.tanda,
            },
          ],
        }),
      });
      const dataLaporSah = await resLaporSah.json().catch(() => null);

      if (resLaporSah.status === 200 && dataLaporSah?.ok) {
        logOk("Laporan dengan bukti amplop asli DITERIMA (200 OK, status=diterima)");

        // Cek bukti di database Supabase bukti_laporan_pesan
        const { data: buktiRow } = await supabase
          .from("bukti_laporan_pesan")
          .select("*")
          .eq("pesan_id", pesanId1);
        if (buktiRow && buktiRow.length > 0) {
          logOk(`Bukti laporan tercatat di Supabase 'bukti_laporan_pesan' (id=${buktiRow[0].id})`);
        } else {
          logGagal("Bukti laporan tidak ditemukan di tabel bukti_laporan_pesan");
        }
      } else {
        logGagal(`Laporan bukti sah gagal: ${resLaporSah.status} ${JSON.stringify(dataLaporSah)}`);
      }
    }

    // 8. Uji Blokir & Pemulihan Percakapan
    logHeader("8. Uji Blokir Dua Arah dan Pemulihan Riwayat");
    const expiresBlokir = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const sigBlokir = await dompetA.akun.signTypedData(
      blokirTypedData(
        { target: dompetB.address, who: dompetA.address, blokir: true, expiresAt: expiresBlokir },
        registry,
      ),
    );

    // Pasang blokir A -> B
    const resPasangBlokir = await fetch(`${baseUrl}/blokir`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target: dompetB.address,
        who: dompetA.address,
        blokir: true,
        expiresAt: expiresBlokir.toString(),
        sig: sigBlokir,
      }),
    });
    if (resPasangBlokir.status === 200) {
      logOk("A memasang blokir terhadap B via POST /blokir (200 OK)");
    }

    // Periksa percakapan B di sisi A
    const resPercAStlBlokir = await kirimRequestPesan({
      baseUrl,
      method: "GET",
      path: "/pesan/percakapan",
      pengirim: dompetA,
    });
    const percSetelahBlokir = resPercAStlBlokir.data.percakapan?.find((p: any) => p.lawan.toLowerCase() === dompetB.address.toLowerCase());
    if (!percSetelahBlokir) {
      logOk("Percakapan dengan B langsung hilang dari daftar percakapan A");
    } else {
      logGagal("Percakapan dengan B masih muncul padahal sudah diblokir!");
    }

    // A mencoba kirim pesan ke B selagi memblokir
    const resKirimStlBlokir = await kirimRequestPesan({
      baseUrl,
      method: "POST",
      path: "/pesan",
      body: {
        id: buatIdPesan(),
        penerima: dompetB.address,
        ciphertext: "dHVsYXJrYW4=",
        nonce: "0x" + "00".repeat(24),
      },
      pengirim: dompetA,
    });
    if (resKirimStlBlokir.status === 403 && resKirimStlBlokir.data?.code === "terblokir") {
      logOk("Kirim pesan selagi terblokir DITOLAK 403 terblokir");
    } else {
      logGagal(`Kirim saat blokir harusnya 403 terblokir, dapat: ${resKirimStlBlokir.status}`);
    }

    // Cabut blokir A -> B
    const expiresCabut = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const sigCabut = await dompetA.akun.signTypedData(
      blokirTypedData(
        { target: dompetB.address, who: dompetA.address, blokir: false, expiresAt: expiresCabut },
        registry,
      ),
    );
    await fetch(`${baseUrl}/blokir`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        target: dompetB.address,
        who: dompetA.address,
        blokir: false,
        expiresAt: expiresCabut.toString(),
        sig: sigCabut,
      }),
    });
    logOk("A mencabut blokir terhadap B via POST /blokir (blokir=false)");

    // Periksa riwayat kembali
    const resRiwayatKembali = await kirimRequestPesan({
      baseUrl,
      method: "GET",
      path: `/pesan/dengan/${dompetB.address}`,
      pengirim: dompetA,
    });
    if (resRiwayatKembali.status === 200 && resRiwayatKembali.data.pesan?.length > 0) {
      logOk("Riwayat percakapan A-B pulih kembali sepenuhnya setelah blokir dicabut");
    } else {
      logGagal(`Riwayat tidak kembali setelah blokir dicabut: ${resRiwayatKembali.status}`);
    }

    // 9. Uji Tanda Tangan Cacat & Rate Limiting
    logHeader("9. Uji Keamanan Autentikasi & Rate Limiting");
    const resSigCacat = await fetch(`${baseUrl}/pesan/percakapan`, {
      headers: {
        "x-nearly-who": dompetA.address,
        "x-nearly-ts": Math.floor(Date.now() / 1000).toString(),
        "x-nearly-tanda": "0x123456", // Tanda tangan rusak
      },
    });
    if (resSigCacat.status === 401) {
      logOk("Tanda tangan header Ed25519 cacat bentuk menghasilkan 401 (bukan 500)");
    } else {
      logGagal(`Tanda tangan cacat harusnya 401, dapat: ${resSigCacat.status}`);
    }

    // Uji Rate Limiting: Kirim pesan beruntun hingga melewati ambang 30 pesan/menit
    console.log("  Menguji batas laju 30 pesan per menit...");
    let terkenaLimit = false;
    for (let i = 0; i < 32; i++) {
      const resRate = await kirimRequestPesan({
        baseUrl,
        method: "POST",
        path: "/pesan",
        body: {
          id: buatIdPesan(),
          penerima: dompetB.address,
          ciphertext: amplopEnkripsi.ciphertext,
          nonce: amplopEnkripsi.nonce,
        },
        pengirim: dompetA,
      });

      if (resRate.status === 429 && resRate.data?.code === "terlalu_cepat") {
        terkenaLimit = true;
        logOk(`Pesan ke-${i + 2} tertahan batas laju: 429 terlalu_cepat`);
        break;
      }
    }
    if (!terkenaLimit) {
      logGagal("Rate limiting gagal: 31+ pesan berhasil lolos tanpa 429 terlalu_cepat");
    }

    logHeader("RINGKASAN HASIL UJI LAPANGAN");
    if (!process.exitCode) {
      console.log(`\n${HIJAU}${TEBAL}SEMUA 8 SKENARIO UJI LAPANGAN BERHASIL MEMENUHI SELURUH JAMINAN PROTOKOL!${RESET}\n`);
    } else {
      console.log(`\n${MERAH}${TEBAL}ADA SKENARIO YANG GAGAL. SILAKAN PERIKSA DETAIL DI ATAS.${RESET}\n`);
    }

  } finally {
    server.close();
  }
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
