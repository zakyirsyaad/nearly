import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { Landing } from "../src/pages/Landing";
import { CHAIN_ID, KONTRAK, tautanBscScan } from "../src/kontrak";

describe("Landing component", () => {
  it("merender struktur utama landing page dengan benar", () => {
    const html = renderToString(Landing());

    // Memastikan elemen utama dan kelas ada
    expect(html).toContain('class="landing"');
    expect(html).toContain('class="hero"');
    expect(html).toContain("Connections you can only make in person.");
    expect(html).toContain("See the live graph");
    expect(html).toContain('href="/live"');

    // Memastikan bagian-bagian penting ada
    expect(html).toContain("How it works");
    expect(html).toContain("Trust comes from the graph");
    expect(html).toContain("Privacy by design");
    expect(html).toContain("What Nearly does not claim");
    expect(html).toContain("On-chain");
    expect(html).toContain("BNB Smart Chain testnet");
    expect(html).toContain(`${CHAIN_ID}`);

    // Memastikan kelima kontrak ditampilkan dengan tautan BscScan
    for (const k of KONTRAK) {
      expect(html).toContain(k.nama);
      expect(html).toContain(k.peran);
      expect(html).toContain(k.alamat);
      expect(html).toContain(tautanBscScan(k.alamat));
    }

    // Memastikan footer ada
    expect(html).toContain("Nearly · testnet demo");
  });
});
