import type { Address, Hex } from "viem";

export type PendingOffer = {
  nonce: Hex;
  initiator: Address;
  expiresAt: bigint;
  sigOffer: Hex;
  /** Sel geohash7 yang dikirim A sendiri. */
  cell: string;
  /** Milidetik. */
  atMs: number;
  consumed: boolean;
};

export type HandshakeStore = {
  putOffer(offer: Omit<PendingOffer, "consumed">): Promise<void>;
  getOffer(nonce: Hex): Promise<PendingOffer | null>;
  consumeOffer(nonce: Hex): Promise<void>;
  areConnected(a: Address, b: Address): Promise<boolean>;
  countConnectionsSince(addr: Address, sinceMs: number): Promise<number>;
  recordConnection(row: {
    a: Address; b: Address; nonce: Hex; txHash: Hex; atMs: number; cell: string;
  }): Promise<void>;
};

export type ChainPort = {
  submitConnect(args: {
    initiator: Address; counterparty: Address; nonce: Hex;
    expiresAt: bigint; sigOffer: Hex; sigAccept: Hex;
  }): Promise<Hex>;
};

export type GateDeps = {
  store: HandshakeStore;
  chain: ChainPort;
  profiles: ProfileStore;
  identity: IdentityPort;
  verifyingContract: Address;
  nowMs: () => number;
};

export type ConnectionRow = { address: Address; txHash: Hex; at: number };

export type ProfileStore = {
  listConnections(addr: Address, limit: number): Promise<ConnectionRow[]>;
  countConnections(addr: Address): Promise<number>;
  getDisplayName(addr: Address): Promise<string>;
};

export type IdentityPort = {
  /** ENS hidup di Ethereum mainnet, BUKAN di opBNB. */
  ensName(addr: Address): Promise<string | null>;
  txCount(addr: Address): Promise<number>;
};

import type { TrustGraph, TrustResult } from "@nearly/trust";

export type TrustStore = {
  loadGraph(nowMs: number): Promise<TrustGraph>;
  saveSnapshots(rows: TrustResult[], computedAt: number): Promise<void>;
  getSnapshot(addr: Address): Promise<TrustResult | null>;
  /** address -> tier yang terakhir benar-benar ditulis on-chain. */
  listPublishedTiers(): Promise<Map<string, number>>;
  markPublished(
    rows: { address: Address; tier: number; score: number; txHash: Hex }[],
  ): Promise<void>;
};

export type VouchStore = {
  countVouchesSince(from: Address, sinceMs: number): Promise<number>;
  hasVouch(from: Address, to: Address): Promise<boolean>;
  recordVouch(row: {
    from: Address; to: Address; tags: string[]; tagsHash: Hex; txHash: Hex;
  }): Promise<void>;
  markRevoked(from: Address, to: Address): Promise<void>;
};

export type ReportRow = { reporter: Address; subject: Address; atMs: number };

export type ReportStore = {
  recordReport(row: {
    reporter: Address; subject: Address; reason: string; evidence?: string;
  }): Promise<void>;
  listReports(subject: Address): Promise<ReportRow[]>;
  setReportStatus(subject: Address, status: string): Promise<void>;
  recordSlash(subject: Address, txHash: Hex): Promise<void>;
};

export type AttestorPort = {
  setScore(who: Address, score: number, tier: number): Promise<Hex>;
};

export type VouchChainPort = {
  submitVouch(args: {
    from: Address; to: Address; tagsHash: Hex; expiresAt: bigint; sig: Hex;
  }): Promise<Hex>;
  submitRevoke(args: {
    from: Address; to: Address; expiresAt: bigint; sig: Hex;
  }): Promise<Hex>;
  submitSlash(subject: Address): Promise<Hex>;
};
