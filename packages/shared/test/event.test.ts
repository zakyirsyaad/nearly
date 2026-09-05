import { describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";
import {
  bytes32ToCell, cellToBytes32, checkInAcceptTypedData, checkInOfferTypedData,
  createEventTypedData, makeEventId, recoverCheckInAcceptSigner,
  recoverCheckInOfferSigner, recoverCreateEventSigner, recoverRsvpSigner, rsvpTypedData,
} from "../src/event";

const PK = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;
const account = privateKeyToAccount(PK);
const CONTRACT = "0x00000000000000000000000000000000000c0de0" as Address;
const EVENT_ID = "0x1111111111111111111111111111111111111111111111111111111111111111" as Hex;
const NONCE = "0x2222222222222222222222222222222222222222222222222222222222222222" as Hex;
const EXPIRES = 1_700_000_030n;

describe("cellToBytes32", () => {
  it("bolak-balik menghasilkan sel yang sama", () => {
    expect(bytes32ToCell(cellToBytes32("qqguv1r"))).toBe("qqguv1r");
  });

  it("hasilnya bytes32 yang sah", () => {
    expect(cellToBytes32("qqguv1r")).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("sel berbeda menghasilkan bytes32 berbeda", () => {
    expect(cellToBytes32("qqguv1r")).not.toBe(cellToBytes32("qqguv1s"));
  });
});

describe("makeEventId", () => {
  it("berbentuk bytes32", () => {
    expect(makeEventId()).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("dua panggilan tidak menghasilkan id yang sama", () => {
    expect(makeEventId()).not.toBe(makeEventId());
  });
});

describe("tanda tangan CreateEvent", () => {
  const msg = {
    eventId: EVENT_ID,
    host: account.address,
    startsAt: 1_700_000_000n,
    endsAt: 1_700_003_600n,
    centerCell: cellToBytes32("qqguv1r"),
    expiresAt: EXPIRES,
  };

  it("pulih ke penandatangan", async () => {
    const sig = await account.signTypedData(createEventTypedData(msg, CONTRACT));
    expect(await recoverCreateEventSigner(msg, sig, CONTRACT)).toBe(account.address);
  });

  // Domain terikat ke alamat kontrak. Tanda tangan untuk satu kontrak tidak
  // boleh berlaku di kontrak lain — tanpa ini, tanda tangan vouch bisa diputar
  // ulang ke AttendanceRegistry.
  it("tidak pulih ke penandatangan kalau verifyingContract berbeda", async () => {
    const sig = await account.signTypedData(createEventTypedData(msg, CONTRACT));
    const other = "0x00000000000000000000000000000000000dead0" as Address;
    expect(await recoverCreateEventSigner(msg, sig, other)).not.toBe(account.address);
  });

  it("tidak pulih ke penandatangan kalau waktu mulai diubah", async () => {
    const sig = await account.signTypedData(createEventTypedData(msg, CONTRACT));
    const tampered = { ...msg, startsAt: msg.startsAt + 1n };
    expect(await recoverCreateEventSigner(tampered, sig, CONTRACT)).not.toBe(account.address);
  });
});

describe("tanda tangan CheckInOffer", () => {
  const msg = { eventId: EVENT_ID, nonce: NONCE, expiresAt: EXPIRES };

  it("pulih ke penandatangan", async () => {
    const sig = await account.signTypedData(checkInOfferTypedData(msg, CONTRACT));
    expect(await recoverCheckInOfferSigner(msg, sig, CONTRACT)).toBe(account.address);
  });

  // Kalau eventId tidak ikut ditandatangani, QR check-in untuk event A bisa
  // dipakai ulang di event B milik host yang sama.
  it("tidak pulih kalau eventId ditukar", async () => {
    const sig = await account.signTypedData(checkInOfferTypedData(msg, CONTRACT));
    const other = { ...msg, eventId: NONCE };
    expect(await recoverCheckInOfferSigner(other, sig, CONTRACT)).not.toBe(account.address);
  });
});

describe("tanda tangan CheckInAccept", () => {
  const msg = {
    eventId: EVENT_ID, nonce: NONCE, attendee: account.address, expiresAt: EXPIRES,
  };

  it("pulih ke penandatangan", async () => {
    const sig = await account.signTypedData(checkInAcceptTypedData(msg, CONTRACT));
    expect(await recoverCheckInAcceptSigner(msg, sig, CONTRACT)).toBe(account.address);
  });

  it("tidak pulih kalau attendee ditukar", async () => {
    const sig = await account.signTypedData(checkInAcceptTypedData(msg, CONTRACT));
    const other = { ...msg, attendee: "0x000000000000000000000000000000000000beef" as Address };
    expect(await recoverCheckInAcceptSigner(other, sig, CONTRACT)).not.toBe(account.address);
  });
});

describe("tanda tangan Rsvp", () => {
  const msg = { eventId: EVENT_ID, who: account.address, expiresAt: EXPIRES };

  it("pulih ke penandatangan", async () => {
    const sig = await account.signTypedData(rsvpTypedData(msg, CONTRACT));
    expect(await recoverRsvpSigner(msg, sig, CONTRACT)).toBe(account.address);
  });
});
