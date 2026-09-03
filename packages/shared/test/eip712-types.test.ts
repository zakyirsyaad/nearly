import { describe, expect, it } from "vitest";
import {
  encodeEip712Type, OFFER_TYPE_STRING, ACCEPT_TYPE_STRING, HANDSHAKE_TYPES,
} from "../src/index.js";

describe("kunci kontrak EIP-712 TS <-> Solidity", () => {
  it("HandshakeOffer di TS menghasilkan string tipe yang sama dengan Solidity", () => {
    expect(encodeEip712Type("HandshakeOffer", HANDSHAKE_TYPES.HandshakeOffer))
      .toBe(OFFER_TYPE_STRING);
  });

  it("HandshakeAccept di TS menghasilkan string tipe yang sama dengan Solidity", () => {
    expect(encodeEip712Type("HandshakeAccept", HANDSHAKE_TYPES.HandshakeAccept))
      .toBe(ACCEPT_TYPE_STRING);
  });

  // Kalau salah satu test di bawah gagal, artinya seseorang mengubah TS tanpa
  // mengubah ConnectionRegistry.sol (atau sebaliknya). JANGAN sekadar ubah
  // literal di sini — perbaiki KEDUA sisi supaya cocok.
  it("literal Solidity untuk offer tidak berubah tanpa sengaja", () => {
    expect(OFFER_TYPE_STRING)
      .toBe("HandshakeOffer(address initiator,bytes32 nonce,uint64 expiresAt)");
  });

  it("literal Solidity untuk accept tidak berubah tanpa sengaja", () => {
    expect(ACCEPT_TYPE_STRING).toBe(
      "HandshakeAccept(address initiator,address counterparty,bytes32 nonce,uint64 expiresAt)",
    );
  });

  it("urutan field penting — menukar urutan harus mengubah string", () => {
    const ditukar = [
      { name: "nonce", type: "bytes32" },
      { name: "initiator", type: "address" },
      { name: "expiresAt", type: "uint64" },
    ];
    expect(encodeEip712Type("HandshakeOffer", ditukar)).not.toBe(OFFER_TYPE_STRING);
  });
});
