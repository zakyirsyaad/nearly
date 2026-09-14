import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { HANDSHAKE_TYPES } from "../src/handshake";
import { VOUCH_TYPES } from "../src/vouch";
import { EVENT_TYPES } from "../src/event";
import { FEED_TYPES } from "../src/feed";
import { MEET_TYPES } from "../src/meet";
import { BLOKIR_TYPES } from "../src/blokir";
import { PESAN_TYPES } from "../src/pesan";
import { PROFIL_TYPES } from "../src/profil";

type Field = { name: string; type: string };

function encodeType(nama: string, fields: readonly Field[]): string {
  return `${nama}(${fields.map((f) => `${f.type} ${f.name}`).join(",")})`;
}

/**
 * Menyebar keenam keluarga ke SATU objek. Kalau dua keluarga memakai nama
 * tipe yang sama, penyebaran ini diam-diam menelan salah satunya dan
 * jumlahnya turun — itulah yang diperiksa tes "SEMUA tidak kehilangan tipe"
 * di bawah, sengaja dipisah dari tes jumlah per-keluarga.
 *
 * Tabrakan lintas keluarga justru yang paling mungkin lolos, karena tidak ada
 * satu berkas pun yang memuat semuanya.
 */
const SEMUA: Record<string, readonly Field[]> = {
  ...HANDSHAKE_TYPES, ...VOUCH_TYPES, ...EVENT_TYPES, ...FEED_TYPES, ...MEET_TYPES,
  ...BLOKIR_TYPES, ...PESAN_TYPES, ...PROFIL_TYPES,
};

// 25 sejak Fase 4b + 5: AturProfil.
const JUMLAH_TIPE = 25;

const SOL_DIR = fileURLToPath(new URL("../../contracts/src/", import.meta.url));

describe("typehash seluruh aplikasi", () => {
  // Dipisah dari tes "SEMUA tidak kehilangan tipe" di bawah dengan sengaja.
  // Vitest berhenti di `expect` pertama yang gagal dalam satu `it` — kalau
  // kedua asersi ini digabung, tipe baru yang KEBETULAN bertabrakan nama
  // dengan tipe di keluarga lain (jumlah per-keluarga naik, tapi SEMUA diam
  // di tempat karena spread menelan salah satunya) akan berhenti di asersi
  // ini duluan, dan asersi SEMUA di tes berikutnya tidak pernah sempat
  // membuktikan ada tabrakan nama tersembunyi di baliknya.
  it("jumlah tipe per keluarga sesuai jumlah yang diharapkan", () => {
    const total = Object.keys(HANDSHAKE_TYPES).length + Object.keys(VOUCH_TYPES).length
      + Object.keys(EVENT_TYPES).length + Object.keys(FEED_TYPES).length
      + Object.keys(MEET_TYPES).length + Object.keys(BLOKIR_TYPES).length
      + Object.keys(PESAN_TYPES).length + Object.keys(PROFIL_TYPES).length;
    expect(total).toBe(JUMLAH_TIPE);
  });

  it("SEMUA tidak kehilangan tipe akibat tabrakan nama lintas keluarga", () => {
    expect(Object.keys(SEMUA)).toHaveLength(JUMLAH_TIPE);
  });

  it("setiap encodeType unik", () => {
    const semua = Object.entries(SEMUA).map(([n, f]) => encodeType(n, f));
    expect(new Set(semua).size).toBe(JUMLAH_TIPE);
  });

  // Ketiga tipe meet TIDAK PERNAH naik on-chain (spec §2.3). Typehash-nya di
  // Solidity berarti seseorang mulai mengirimnya ke chain, dan anonimitas yang
  // jadi syarat fitur ini hilang.
  it("tidak ada typehash meet di Solidity mana pun", () => {
    const berkasSol = readdirSync(SOL_DIR).filter((f) => f.endsWith(".sol"));
    expect(berkasSol.length).toBeGreaterThan(0);
    for (const berkas of berkasSol) {
      const sumber = readFileSync(`${SOL_DIR}${berkas}`, "utf8");
      for (const nama of Object.keys(MEET_TYPES)) {
        expect(sumber).not.toContain(`${nama}(`);
      }
    }
  });

  it("encodeType meet persis seperti spec §5", () => {
    expect(encodeType("InginBertemu", MEET_TYPES.InginBertemu))
      .toBe("InginBertemu(address target,address who,bool ingin,uint64 expiresAt)");
    expect(encodeType("LihatProfil", MEET_TYPES.LihatProfil))
      .toBe("LihatProfil(address target,address who,uint64 expiresAt)");
    expect(encodeType("TandaiDilihat", MEET_TYPES.TandaiDilihat))
      .toBe("TandaiDilihat(address who,uint64 expiresAt)");
    expect(encodeType("LihatKecocokan", MEET_TYPES.LihatKecocokan))
      .toBe("LihatKecocokan(address who,uint64 expiresAt)");
  });

  it("tidak ada typehash blokir di Solidity mana pun", () => {
    const berkasSol = readdirSync(SOL_DIR).filter((f) => f.endsWith(".sol"));
    expect(berkasSol.length).toBeGreaterThan(0);
    for (const berkas of berkasSol) {
      const sumber = readFileSync(`${SOL_DIR}${berkas}`, "utf8");
      for (const nama of Object.keys(BLOKIR_TYPES)) {
        expect(sumber).not.toContain(`${nama}(`);
      }
    }
  });

  // LihatFeed bukti BACA yang tidak pernah naik on-chain, sama seperti
  // saudara-saudaranya di keluarga `{ who, expiresAt }`.
  it("tidak ada typehash LihatFeed di Solidity mana pun", () => {
    const berkasSol = readdirSync(SOL_DIR).filter((f) => f.endsWith(".sol"));
    expect(berkasSol.length).toBeGreaterThan(0);
    for (const berkas of berkasSol) {
      const sumber = readFileSync(`${SOL_DIR}${berkas}`, "utf8");
      expect(sumber).not.toContain("LihatFeed(");
    }
  });

  it("encodeType LihatFeed persis seperti spec 4a §6", () => {
    expect(encodeType("LihatFeed", FEED_TYPES.LihatFeed))
      .toBe("LihatFeed(address who,uint64 expiresAt)");
  });

  it("encodeType blokir persis seperti spec §6", () => {
    expect(encodeType("Blokir", BLOKIR_TYPES.Blokir))
      .toBe("Blokir(address target,address who,bool blokir,uint64 expiresAt)");
    expect(encodeType("LihatBlokir", BLOKIR_TYPES.LihatBlokir))
      .toBe("LihatBlokir(address who,uint64 expiresAt)");
  });

  // Kedua tipe pesan TIDAK PERNAH naik on-chain (spec 4c §6).
  it("tidak ada typehash pesan di Solidity mana pun", () => {
    const berkasSol = readdirSync(SOL_DIR).filter((f) => f.endsWith(".sol"));
    expect(berkasSol.length).toBeGreaterThan(0);
    for (const berkas of berkasSol) {
      const sumber = readFileSync(`${SOL_DIR}${berkas}`, "utf8");
      for (const nama of Object.keys(PESAN_TYPES)) {
        expect(sumber).not.toContain(`${nama}(`);
      }
    }
  });

  it("encodeType pesan persis seperti spec 4c §6", () => {
    expect(encodeType("KunciPesan", PESAN_TYPES.KunciPesan))
      .toBe("KunciPesan(address who,uint32 versi)");
    expect(encodeType("DaftarKunciPesan", PESAN_TYPES.DaftarKunciPesan))
      .toBe("DaftarKunciPesan(address who,bytes32 kunciEnkripsi,bytes32 kunciTanda,uint64 expiresAt)");
  });

  // AturProfil TIDAK PERNAH naik on-chain (spec 4b+5 §7.1).
  it("tidak ada typehash profil di Solidity mana pun", () => {
    const berkasSol = readdirSync(SOL_DIR).filter((f) => f.endsWith(".sol"));
    expect(berkasSol.length).toBeGreaterThan(0);
    for (const berkas of berkasSol) {
      const sumber = readFileSync(`${SOL_DIR}${berkas}`, "utf8");
      for (const nama of Object.keys(PROFIL_TYPES)) {
        expect(sumber).not.toContain(`${nama}(`);
      }
    }
  });

  it("encodeType profil persis seperti spec 4b+5 §7.1", () => {
    expect(encodeType("AturProfil", PROFIL_TYPES.AturProfil))
      .toBe("AturProfil(address who,string displayName,string visibilitas,uint64 expiresAt)");
  });
});
