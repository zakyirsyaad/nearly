import { Hono } from "hono";
import { isAddress, type Address } from "viem";
import type { GateDeps } from "../ports";

export function profileRoutes(deps: GateDeps) {
  const r = new Hono();

  r.get("/connections/:address", async (c) => {
    const raw = c.req.param("address");
    if (!isAddress(raw)) return c.json({ code: "invalid_address" }, 400);
    const addr = raw.toLowerCase() as Address;
    return c.json({ connections: await deps.profiles.listConnections(addr, 100) });
  });

  // Jawaban ya/tidak untuk "apakah A dan B sudah terkoneksi", dipakai layar
  // profil mobile untuk memutuskan apakah tombol Vouch muncul. Sengaja BUKAN
  // menarik daftar koneksi (GET /connections/:address dibatasi 100 terbaru) —
  // pasangan yang sudah terkoneksi tapi di luar 100 terbaru harus tetap benar.
  r.get("/connected/:a/:b", async (c) => {
    const rawA = c.req.param("a");
    const rawB = c.req.param("b");
    if (!isAddress(rawA) || !isAddress(rawB)) return c.json({ code: "invalid_address" }, 400);
    const connected = await deps.store.areConnected(
      rawA.toLowerCase() as Address,
      rawB.toLowerCase() as Address,
    );
    return c.json({ connected });
  });

  r.get("/profile/:address", async (c) => {
    const raw = c.req.param("address");
    if (!isAddress(raw)) return c.json({ code: "invalid_address" }, 400);
    const addr = raw.toLowerCase() as Address;

    // Profil tidak boleh ikut mati kalau RPC mainnet atau opBNB sedang tersendat.
    // Anon tanpa ENS adalah keadaan NORMAL, bukan kesalahan.
    const [displayName, ens, txCount, connectionCount] = await Promise.all([
      deps.profiles.getDisplayName(addr).catch(() => ""),
      deps.identity.ensName(addr).catch(() => null),
      deps.identity.txCount(addr).catch(() => 0),
      deps.profiles.countConnections(addr).catch(() => 0),
    ]);

    return c.json({ address: addr, displayName, ens, txCount, connectionCount });
  });

  return r;
}
