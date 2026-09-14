import { describe, expect, it } from "vitest";
import {
  KALIMAT_SERVER_TAK_TERJANGKAU,
  blokirErrorMessage,
  eventErrorMessage,
  feedErrorMessage,
  handshakeErrorMessage,
  meetErrorMessage,
  pesanErrorMessage,
} from "../src/messages";
import { pesanGagal } from "../src/errors";

// `req` melempar kode ini saat server diam atau jaringan gagal. Setiap layar
// menerjemahkan galat lewat penerjemah domainnya sendiri — kalau satu saja
// lupa, layar itu jatuh ke "Gagal. Coba lagi" dan pengguna tidak tahu bahwa
// masalahnya koneksi, bukan aksinya.
describe("server_tak_terjangkau di setiap penerjemah galat", () => {
  const penerjemah: Array<[string, (code: string) => string]> = [
    ["handshake", (c) => handshakeErrorMessage(c)],
    ["event", (c) => eventErrorMessage(c)],
    ["feed", feedErrorMessage],
    ["meet", meetErrorMessage],
    ["blokir", blokirErrorMessage],
    ["pesan", pesanErrorMessage],
    ["vouch/report", pesanGagal],
  ];

  for (const [nama, terjemah] of penerjemah) {
    it(`${nama} memakai kalimat koneksi yang sama`, () => {
      expect(terjemah("server_tak_terjangkau")).toBe(KALIMAT_SERVER_TAK_TERJANGKAU);
    });
  }
});
