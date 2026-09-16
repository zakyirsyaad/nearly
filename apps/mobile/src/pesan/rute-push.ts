const EVENT_ID = /^0x[0-9a-fA-F]{64}$/;

/** Murni: data tersembunyi notifikasi → rute yang dibuka saat diketuk. */
export function ruteDariNotifikasi(data: unknown): "/pesan" | `/radar/${string}` | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as { jenis?: unknown; eventId?: unknown };
  if (d.jenis === "pesan") return "/pesan";
  if (d.jenis === "radar" && typeof d.eventId === "string" && EVENT_ID.test(d.eventId)) {
    return `/radar/${d.eventId.toLowerCase()}`;
  }
  return null;
}
