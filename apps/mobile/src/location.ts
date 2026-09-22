import * as Location from "expo-location";
import { encodeCell } from "@nearly/shared";

export class LocationDeniedError extends Error {
  constructor() {
    super("Location access was denied");
    // Nama dipakai kalimatGagalLokal (src/teks-salaman.ts) yang murni dan
    // tidak boleh mengimpor expo-location demi instanceof.
    this.name = "LocationDeniedError";
  }
}

/**
 * Satu kali ambil lokasi, di foreground. TIDAK ADA background location di fase ini.
 * Hasilnya langsung dikasarkan ke geohash7 (~150 m); koordinat presisi tidak
 * pernah keluar dari fungsi ini (spec §10.2).
 */
export async function getCurrentCell(): Promise<{ cell: string; atMs: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== Location.PermissionStatus.GRANTED) throw new LocationDeniedError();

  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return {
    cell: encodeCell(pos.coords.latitude, pos.coords.longitude),
    atMs: Date.now(),
  };
}
