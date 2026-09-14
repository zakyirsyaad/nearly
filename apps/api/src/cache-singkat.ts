/**
 * Cache di memori proses untuk endpoint publik yang dipanggil tiap 3 detik
 * oleh setiap layar yang terbuka (spec 6 §4.5).
 *
 * Yang disimpan adalah PROMISE, bukan hasil: sepuluh tab yang meminta kunci
 * yang sama di milidetik yang sama menunggu SATU kueri, bukan sepuluh kueri
 * yang berlomba lalu menulis cache bersamaan. Promise yang gagal langsung
 * dibuang, supaya galat sesaat tidak tersimpan 2 detik.
 */
export type CacheSingkat<T> = {
  ambil(kunci: string, hitung: () => Promise<T>): Promise<T>;
  ukuran(): number;
};

export function buatCacheSingkat<T>(
  nowMs: () => number,
  umurMs: number,
  batasEntri = 1000,
): CacheSingkat<T> {
  const isi = new Map<string, { sampaiMs: number; nilai: Promise<T> }>();

  function bersihkan(sekarang: number) {
    for (const [k, v] of isi) if (v.sampaiMs <= sekarang) isi.delete(k);
    // Kunci memuat `sejakId` bebas dari query — tanpa batas, siapa pun bisa
    // mengisi memori proses dengan sejakId=1, 2, 3, ...
    while (isi.size >= batasEntri) {
      const tertua = isi.keys().next().value;
      if (tertua === undefined) break;
      isi.delete(tertua);
    }
  }

  return {
    ambil(kunci, hitung) {
      const sekarang = nowMs();
      const ada = isi.get(kunci);
      if (ada && ada.sampaiMs > sekarang) return ada.nilai;

      bersihkan(sekarang);
      const nilai = hitung();
      isi.set(kunci, { sampaiMs: sekarang + umurMs, nilai });
      nilai.catch(() => {
        if (isi.get(kunci)?.nilai === nilai) isi.delete(kunci);
      });
      return nilai;
    },
    ukuran: () => isi.size,
  };
}
