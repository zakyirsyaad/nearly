/**
 * Memicu perhitungan ulang trust dari terminal. Berguna setelah mengubah seed,
 * dan sebagai jaring pengaman kalau pemicu otomatis pernah gagal.
 *
 * Pakai: tsx tools/recompute.ts
 */
import type { Address, Hex } from "viem";
import { createSupabase } from "../src/db";
import { createAttestor } from "../src/trust/attestor";
import { createTrustStore } from "../src/trust/store";
import { recomputeTrust } from "../src/trust/recompute";

const db = createSupabase(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const out = await recomputeTrust({
  trust: createTrustStore(db),
  attestor: createAttestor({
    rpcUrl: process.env.RPC_URL!,
    privateKey: process.env.RELAYER_PRIVATE_KEY! as Hex,
    attestor: process.env.TRUST_ATTESTOR_ADDRESS! as Address,
  }),
  nowMs: () => Date.now(),
});

console.log(
  `dihitung ${out.computed} alamat · dipublikasi ${out.published} · gagal ${out.failed}`,
);
