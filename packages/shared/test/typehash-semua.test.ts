import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { HANDSHAKE_TYPES } from "../src/handshake";
import { VOUCH_TYPES } from "../src/vouch";
import { EVENT_TYPES } from "../src/event";
import { FEED_TYPES } from "../src/feed";
import { MEET_TYPES } from "../src/meet";

type Field = { name: string; type: string };

function encodeType(nama: string, fields: readonly Field[]): string {
  return `${nama}(${fields.map((f) => `${f.type} ${f.name}`).join(",")})`;
}

/**
 * Menyebar kelima keluarga ke SATU objek. Kalau dua keluarga memakai nama
 * tipe yang sama, penyebaran ini diam-diam menelan salah satunya dan
 * jumlahnya turun — itulah yang diperiksa asersi jumlah di bawah.
 *
 * Tabrakan lintas keluarga justru yang paling mungkin lolos, karena tidak ada
 * satu berkas pun yang memuat semuanya.
 */
const SEMUA: Record<string, readonly Field[]> = {
  ...HANDSHAKE_TYPES, ...VOUCH_TYPES, ...EVENT_TYPES, ...FEED_TYPES, ...MEET_TYPES,
};

const JUMLAH_TIPE = 19;

const SOL_DIR = fileURLToPath(new URL("../../contracts/src/", import.meta.url));

describe("typehash seluruh aplikasi", () => {
  it("tidak ada nama tipe yang bertabrakan lintas keluarga", () => {
    const total = Object.keys(HANDSHAKE_TYPES).length + Object.keys(VOUCH_TYPES).length
      + Object.keys(EVENT_TYPES).length + Object.keys(FEED_TYPES).length
      + Object.keys(MEET_TYPES).length;
    expect(total).toBe(JUMLAH_TIPE);
    expect(Object.keys(SEMUA)).toHaveLength(JUMLAH_TIPE);
  });

  it("kesembilan belas encodeType unik", () => {
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
});
