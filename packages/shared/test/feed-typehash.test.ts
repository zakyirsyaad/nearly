import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FEED_TYPES } from "../src/feed";
import { EVENT_TYPES } from "../src/event";

/**
 * Pelajaran Ruling 23 Fase 3a: dua tipe EIP-712 berbentuk field sama tapi
 * bernama beda menghasilkan digest beda — dan itulah satu-satunya hal yang
 * mencegah tanda tangan baca dipakai ulang sebagai perintah tulis. Tes ini
 * menjaga arah sebaliknya: memastikan tidak ada NAMA tipe yang bertabrakan.
 */
function encodeType(nama: string, fields: readonly { name: string; type: string }[]): string {
  return `${nama}(${fields.map((f) => `${f.type} ${f.name}`).join(",")})`;
}

const SOL_DIR = fileURLToPath(new URL("../../contracts/src/", import.meta.url));

describe("tipe EIP-712 feed", () => {
  it("keempat nama tidak bertabrakan dengan tipe mana pun yang sudah ada", () => {
    const lama = Object.keys(EVENT_TYPES);
    for (const nama of ["Post", "Like", "HapusPost", "LampirGambar"]) {
      expect(lama).not.toContain(nama);
    }
  });

  it("keempat encodeType saling berbeda", () => {
    const semua = Object.entries(FEED_TYPES).map(([n, f]) => encodeType(n, f));
    expect(new Set(semua).size).toBe(4);
  });

  // Post dan Like TIDAK PERNAH naik on-chain (spec §5). Kalau suatu hari ada
  // typehash-nya di Solidity, itu tanda seseorang mulai mengirimnya ke chain
  // dan aturan fase ini bocor.
  it("tidak ada typehash feed di Solidity mana pun", () => {
    const berkasSol = readdirSync(SOL_DIR).filter((f) => f.endsWith(".sol"));
    expect(berkasSol.length).toBeGreaterThan(0);
    for (const berkas of berkasSol) {
      const sumber = readFileSync(`${SOL_DIR}${berkas}`, "utf8");
      for (const nama of ["Post(", "Like(", "HapusPost(", "LampirGambar("]) {
        expect(sumber).not.toContain(nama);
      }
    }
  });

  it("encodeType Post persis seperti yang didokumentasikan spec §5", () => {
    expect(encodeType("Post", FEED_TYPES.Post))
      .toBe("Post(bytes32 postId,address author,string body,uint64 expiresAt)");
  });

  it("encodeType Like persis seperti yang didokumentasikan spec §5", () => {
    expect(encodeType("Like", FEED_TYPES.Like))
      .toBe("Like(bytes32 postId,address who,bool suka,uint64 expiresAt)");
  });

  it("encodeType HapusPost persis seperti yang didokumentasikan spec §5", () => {
    expect(encodeType("HapusPost", FEED_TYPES.HapusPost))
      .toBe("HapusPost(bytes32 postId,address author,uint64 expiresAt)");
  });

  it("encodeType LampirGambar persis seperti yang didokumentasikan spec §5", () => {
    expect(encodeType("LampirGambar", FEED_TYPES.LampirGambar))
      .toBe("LampirGambar(bytes32 postId,address author,string mime,uint64 expiresAt)");
  });
});
