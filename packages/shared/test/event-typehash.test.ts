import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { keccak256, toHex } from "viem";
import { EVENT_TYPES } from "../src/index";

const SOL = fileURLToPath(
  new URL("../../contracts/src/AttendanceRegistry.sol", import.meta.url),
);

function encodeType(name: keyof typeof EVENT_TYPES): string {
  const fields = EVENT_TYPES[name].map((f) => `${f.type} ${f.name}`).join(",");
  return `${name}(${fields})`;
}

function typehashLiteral(source: string, constantName: string): string {
  const re = new RegExp(`${constantName}[^=]*=\\s*keccak256\\(\\s*"([^"]+)"`, "m");
  const m = source.match(re);
  if (!m) throw new Error(`typehash ${constantName} tidak ada di AttendanceRegistry.sol`);
  return m[1]!;
}

describe("kunci EIP-712 TS <-> Solidity untuk event", () => {
  const sol = readFileSync(SOL, "utf8");

  it("string tipe CreateEvent identik di kedua sisi", () => {
    expect(typehashLiteral(sol, "CREATE_EVENT_TYPEHASH")).toBe(encodeType("CreateEvent"));
  });

  it("string tipe CheckInOffer identik di kedua sisi", () => {
    expect(typehashLiteral(sol, "CHECKIN_OFFER_TYPEHASH")).toBe(encodeType("CheckInOffer"));
  });

  it("string tipe CheckInAccept identik di kedua sisi", () => {
    expect(typehashLiteral(sol, "CHECKIN_ACCEPT_TYPEHASH")).toBe(encodeType("CheckInAccept"));
  });

  it("hash CheckInAccept pun identik, bukan cuma stringnya", () => {
    expect(keccak256(toHex(typehashLiteral(sol, "CHECKIN_ACCEPT_TYPEHASH"))))
      .toBe(keccak256(toHex(encodeType("CheckInAccept"))));
  });

  it("domain di kontrak memakai nama dan versi yang sama dengan TypeScript", () => {
    expect(sol).toContain('keccak256("Nearly")');
    expect(sol).toContain('keccak256("1")');
  });

  // Rsvp SENGAJA tidak punya typehash Solidity: RSVP tidak pernah naik
  // on-chain. Test ini mengunci ketiadaan itu, supaya tidak ada yang
  // menambahkannya "demi konsistensi" lalu diam-diam mengubah cakupan fase.
  it("Rsvp tidak punya typehash di kontrak", () => {
    expect(sol).not.toContain("Rsvp(");
  });

  // LihatEvent adalah bukti baca (GET /events/:id), bukan perintah tulis.
  // Sama seperti Rsvp, ia TIDAK PERNAH naik on-chain dan tidak boleh punya
  // pasangan typehash di Solidity — kalau ditambahkan "demi konsistensi",
  // itu berarti seseorang salah paham dan mengira ini perlu diverifikasi
  // kontrak, padahal justru keterpisahannya dari Rsvp itulah intinya.
  it("LihatEvent tidak punya typehash di kontrak", () => {
    expect(sol).not.toContain("LihatEvent(");
  });
});
