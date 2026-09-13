/** Murni: data tersembunyi notifikasi → rute yang dibuka saat diketuk. */
export function ruteDariNotifikasi(data: unknown): "/pesan" | null {
  if (typeof data === "object" && data !== null && (data as { jenis?: unknown }).jenis === "pesan") {
    return "/pesan";
  }
  return null;
}
