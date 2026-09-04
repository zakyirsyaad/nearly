import { serve } from "@hono/node-server";
import type { Address, Hex } from "viem";
import { createApp } from "./app";
import { createProfileStore, createStore, createSupabase } from "./db";
import { createIdentity } from "./identity";
import { createRelayer } from "./relayer";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`env ${name} wajib diisi`);
  return v;
}

const registry = required("CONNECTION_REGISTRY_ADDRESS") as Address;

const supabase = createSupabase(
  required("SUPABASE_URL"),
  required("SUPABASE_SERVICE_ROLE_KEY"),
);

const app = createApp({
  store: createStore(supabase),
  profiles: createProfileStore(supabase),
  identity: createIdentity(required("MAINNET_RPC"), required("RPC_URL")),
  chain: createRelayer({
    rpcUrl: required("RPC_URL"),
    privateKey: required("RELAYER_PRIVATE_KEY") as Hex,
    registry,
  }),
  verifyingContract: registry,
  nowMs: () => Date.now(),
});

serve({ fetch: app.fetch, port: 8787 });
console.log("API Nearly berjalan di http://localhost:8787");
