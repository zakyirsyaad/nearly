import type { Address } from "viem";
import { tagsHashOf, vouchTypedData } from "@nearly/shared";
import { CONFIG } from "./config";
import type { NearlySigner } from "./signer";
import type { TrustEvidenceView } from "./tier";

export type TrustResponse = {
  address: string;
  tier: number;
  tierLabel: string;
  evidence: TrustEvidenceView;
};

async function post(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${CONFIG.apiUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { code?: string } | null;
    throw new Error(detail?.code ?? `gagal (${res.status})`);
  }
}

export async function fetchTrust(address: Address): Promise<TrustResponse> {
  const res = await fetch(`${CONFIG.apiUrl}/trust/${address}`);
  if (!res.ok) throw new Error(`gagal membaca trust (${res.status})`);
  return (await res.json()) as TrustResponse;
}

export async function sendVouch(
  signer: NearlySigner, to: Address, tags: string[],
): Promise<void> {
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const msg = {
    from: signer.address, to, tagsHash: tagsHashOf(tags), expiresAt,
  };
  const sig = await signer.signTypedData(
    vouchTypedData(msg, CONFIG.vouchRegistry),
  );
  await post("/vouch", {
    from: signer.address, to, tags, expiresAt: expiresAt.toString(), sig,
  });
}

export async function sendReport(
  reporter: Address, subject: Address, reason: string,
): Promise<void> {
  await post("/report", { reporter, subject, reason });
}
