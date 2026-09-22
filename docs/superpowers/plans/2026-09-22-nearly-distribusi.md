# Distribusi Nearly (Tahap 1 Android) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membuat repo siap membangun APK Android rilis yang bisa dipasang orang lain (tanpa Expo Go): konfigurasi EAS yang benar, EAS Update, notifikasi push FCM, tautan unduh di web, host APK di VPS, dan runbook operasional — sambil menyiapkan jalur iPhone/TestFlight.

**Architecture:** Hanya konfigurasi dan tepi aplikasi yang berubah. `app.config.ts` membungkus `app.json` untuk menyuntik `google-services.json` dari EAS file variable. `eas.json` kehilangan semua nilai env (pindah ke EAS environment variables). Push mendapat kanal Android `default`. Web mendapat bagian "Get the app" yang digerakkan `VITE_APK_URL`. Caddy melayani APK di `unduh.<domain>`. `apps/api` tidak berubah.

**Tech Stack:** pnpm monorepo · Expo SDK 57 (expo-router 57.0.18, RN 0.86.3) · EAS Build/Update · expo-notifications ~57.0.18 · expo-updates (baru) · Vite 5 + React 19 (web) · Caddy · Vitest.

**Spec:** `docs/superpowers/specs/2026-09-22-nearly-distribusi-design.md` (otoritas mengikat, keputusan D1–D12).

**Titik awal:** branch `distribusi` dari `main` `db20f48`, di checkout utama `/Users/mac/developer/nearly` (tidak ada worktree).

## Global Constraints

- **D6:** tidak ada nilai `EXPO_PUBLIC_*` di `eas.json`; tidak ada IP LAN (`192.168.`) atau `http://` di `eas.json`, `app.json`, `app.config.ts`.
- **D7:** `google-services.json` tidak pernah di-commit; `app.config.ts` tidak memasang `googleServicesFile` bila env `GOOGLE_SERVICES_JSON` kosong DAN `./google-services.json` tidak ada.
- **D9:** ikon notifikasi Android = 96×96 PNG, "n" putih `#ffffff` di atas transparan; warna aksen notifikasi `#f3ba2f`. `icon.png`, `adaptive-icon.png`, `splash-icon.png` TIDAK berubah (byte-identik dengan `db20f48`).
- **D10:** tombol unduh hanya untuk URL `https:`; bagian "Get the app" tidak dirender bila `VITE_APK_URL` kosong/tidak valid. Salinan web berbahasa Inggris dan setiap blok diberi komentar rujukan spec (aturan salinan di kepala `Landing.tsx`).
- **D12:** `apps/api/**` TIDAK disentuh. Id kanal Android persis `default`; nama tampilannya persis `Messages and Radar`.
- **Dependensi:** satu-satunya dependensi baru adalah `expo-updates`, dipasang lewat `npx expo install expo-updates` (versi dipilih Expo untuk SDK 57). Tidak ada dependensi lain; `apps/web/package.json` tidak berubah.
- **Keamanan (berlaku untuk seluruh sesi):** jangan pernah membaca, mencetak, atau mengubah berkas `.env` apa pun (boleh `.env.example`). Jangan mencatat 12 kata pemulihan, kunci privat, atau token. Tanpa `git reset --hard`, `git clean`, `rm -r`, force-push, atau `--amend`. `git add` dengan nama berkas eksplisit.
- **Tanpa server/Metro/Expo Go/simulator/EAS CLI.** Tidak ada `eas build`, `eas env`, `eas update`, `eas credentials` — itu langkah pemilik. Bundel diverifikasi hanya lewat `npx expo export` ke `mktemp -d`.
- **Tsconfig:** `tsconfig.base.json` TIDAK memakai `resolveJsonModule` — jangan `import x from "*.json"` di TypeScript; baca JSON dengan `readFileSync` + `JSON.parse`.

---

### Task 1: Ikon notifikasi, `app.config.ts`, plugin expo-notifications

**Files:**
- Modify: `apps/mobile/scripts/buat-ikon.mjs`
- Create: `apps/mobile/assets/notification-icon.png` (dihasilkan skrip)
- Create: `apps/mobile/app.config.ts`
- Modify: `apps/mobile/app.json` (array `plugins`)
- Modify: `.gitignore` (akar repo)
- Test: `apps/mobile/test/konfigurasi-app.test.ts`

**Interfaces:**
- Produces: `export default function konfigurasi({ config }: ConfigContext): ExpoConfig` dan `export function berkasGoogleServices(env: string | undefined, adaLokal: boolean): string | undefined` di `apps/mobile/app.config.ts`.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/konfigurasi-app.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import konfigurasi, { berkasGoogleServices } from "../app.config";

const AKAR = join(__dirname, "..");
const appJson = JSON.parse(readFileSync(join(AKAR, "app.json"), "utf8"));

/** Lebar & tinggi dari header IHDR PNG (bait 16–23, big-endian). */
function ukuranPng(berkas: string): { w: number; h: number } {
  const b = readFileSync(join(AKAR, berkas));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

describe("berkasGoogleServices (spec distribusi D7)", () => {
  it("EAS file variable menang", () => {
    expect(berkasGoogleServices("/tmp/eas/google-services.json", true)).toBe("/tmp/eas/google-services.json");
  });
  it("jatuh ke berkas lokal bila ada", () => {
    expect(berkasGoogleServices(undefined, true)).toBe("./google-services.json");
    expect(berkasGoogleServices("", true)).toBe("./google-services.json");
  });
  it("tidak memasang apa pun bila keduanya tidak ada", () => {
    expect(berkasGoogleServices(undefined, false)).toBeUndefined();
  });
});

describe("app.config.ts", () => {
  const cfg = konfigurasi({ config: appJson.expo } as never);

  it("mempertahankan isi app.json", () => {
    expect(cfg.name).toBe("Nearly");
    expect(cfg.android?.package).toBe("app.nearly.mobile");
    expect(cfg.ios?.bundleIdentifier).toBe("app.nearly.mobile");
    expect(cfg.runtimeVersion).toEqual({ policy: "appVersion" });
    expect(cfg.updates?.url).toMatch(/^https:\/\/u\.expo\.dev\//);
  });

  it("plugin expo-notifications dengan ikon notifikasi dan warna aksen", () => {
    const plugin = (cfg.plugins ?? []).find((p) => Array.isArray(p) && p[0] === "expo-notifications");
    expect(plugin).toEqual(["expo-notifications", { icon: "./assets/notification-icon.png", color: "#f3ba2f" }]);
  });

  it("tanpa http:// atau IP LAN (spec distribusi D6)", () => {
    const teks = JSON.stringify(cfg);
    expect(teks).not.toContain("http://");
    expect(teks).not.toContain("192.168.");
  });
});

describe("aset ikon (spec distribusi D9)", () => {
  it("ikon notifikasi 96×96", () => {
    expect(ukuranPng("assets/notification-icon.png")).toEqual({ w: 96, h: 96 });
  });
  it("ikon lama tetap 1024×1024", () => {
    for (const f of ["assets/icon.png", "assets/adaptive-icon.png", "assets/splash-icon.png"]) {
      expect(ukuranPng(f), f).toEqual({ w: 1024, h: 1024 });
    }
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/konfigurasi-app.test.ts`
Expected: FAIL — `Cannot find module '../app.config'` (dan `notification-icon.png` tidak ada).

- [ ] **Step 3: Ikon notifikasi**

Di `apps/mobile/scripts/buat-ikon.mjs`, ganti fungsi `tulis` agar menerima sisi:

```js
function tulis(nama, isi, sisi = SISI) {
  const png = new Resvg(isi, { fitTo: { mode: "width", value: sisi } }).render().asPng();
  writeFileSync(join(ASET, nama), png);
  console.log(`${nama}: ${png.length} bait`);
}
```

dan tambahkan di akhir berkas:

```js
// notification-icon.png: ikon kecil bilah status Android — sistem hanya memakai
// kanal alfa, jadi "n" putih di atas transparan; warnanya diberi plugin
// expo-notifications (app.json, "color"). 96×96 = xxxhdpi (spec distribusi D9).
tulis("notification-icon.png", svg({ latar: null, warna: "#ffffff", skala: 1 }), 96);
```

Run: `pnpm --filter @nearly/mobile run ikon`
Lalu: `git status --short apps/mobile/assets`
Expected: hanya `?? apps/mobile/assets/notification-icon.png`. Bila `icon.png`/`adaptive-icon.png`/`splash-icon.png` tampil ` M`, kembalikan dengan `git restore apps/mobile/assets/icon.png apps/mobile/assets/adaptive-icon.png apps/mobile/assets/splash-icon.png` (D9: byte-identik), dan catat di ledger.

- [ ] **Step 4: `app.json` — plugin**

Di array `plugins` `apps/mobile/app.json`, tambahkan tepat setelah `"expo-secure-store",`:

```json
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#f3ba2f"
        }
      ],
```

- [ ] **Step 5: `app.config.ts`**

`apps/mobile/app.config.ts`:

```ts
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Lokasi google-services.json (spec distribusi D7). Berkas ini tidak di-commit:
 * di EAS Build ia datang dari file variable GOOGLE_SERVICES_JSON (EAS menulis
 * berkasnya dan mengisi env dengan path-nya); di mesin pengembang boleh ada
 * salinan lokal yang di-gitignore. Tanpa keduanya tidak dipasang, supaya Expo Go
 * dan `expo export` tetap jalan.
 */
export function berkasGoogleServices(env: string | undefined, adaLokal: boolean): string | undefined {
  if (env) return env;
  return adaLokal ? "./google-services.json" : undefined;
}

export default function konfigurasi({ config }: ConfigContext): ExpoConfig {
  const googleServicesFile = berkasGoogleServices(
    process.env.GOOGLE_SERVICES_JSON,
    existsSync(join(__dirname, "google-services.json")),
  );
  return {
    ...config,
    name: config.name ?? "Nearly",
    slug: config.slug ?? "nearly",
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
  };
}
```

- [ ] **Step 6: `.gitignore`**

Tambahkan di akhir `.gitignore` akar:

```gitignore

# Kredensial Firebase (spec distribusi D7) — datang dari EAS file variable.
apps/mobile/google-services.json
apps/mobile/GoogleService-Info.plist
```

- [ ] **Step 7: Jalankan tes, typecheck, periksa config nyata**

Run: `pnpm --filter @nearly/mobile exec vitest run test/konfigurasi-app.test.ts`
Expected: PASS.
Run: `pnpm --filter @nearly/mobile run typecheck`
Expected: tanpa galat.
Run: `cd apps/mobile && npx expo config --type public | grep -n "expo-notifications\|googleServicesFile\|runtimeVersion"`
Expected: `expo-notifications` dan `runtimeVersion` muncul; `googleServicesFile` TIDAK muncul (belum ada berkas lokal).

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/scripts/buat-ikon.mjs apps/mobile/assets/notification-icon.png apps/mobile/app.config.ts apps/mobile/app.json .gitignore apps/mobile/test/konfigurasi-app.test.ts
git commit -m "feat(mobile): app.config.ts dengan google-services dari EAS, plugin dan ikon notifikasi"
```

---

### Task 2: `eas.json` tanpa env + profil rilis + expo-updates

**Files:**
- Modify: `apps/mobile/eas.json` (tulis ulang)
- Modify: `apps/mobile/package.json`, `pnpm-lock.yaml` (oleh `npx expo install`)
- Test: `apps/mobile/test/eas.test.ts`

**Interfaces:**
- Consumes: `app.config.ts` dari Task 1 (tidak diubah).
- Produces: profil EAS `development` / `preview` / `production` dan kanal `development` / `preview` / `production` — nama ini dipakai runbook di Task 5.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/mobile/test/eas.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const AKAR = join(__dirname, "..");
const eas = JSON.parse(readFileSync(join(AKAR, "eas.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(AKAR, "package.json"), "utf8"));

describe("eas.json (spec distribusi D6, D8, D11)", () => {
  it("tanpa nilai env: EXPO_PUBLIC_* hanya di EAS environment variables", () => {
    for (const [nama, profil] of Object.entries<Record<string, unknown>>(eas.build)) {
      expect(profil.env, nama).toBeUndefined();
    }
    const teks = JSON.stringify(eas);
    expect(teks).not.toContain("http://");
    expect(teks).not.toContain("192.168.");
  });

  it("preview: APK internal di kanal preview, versionCode naik otomatis", () => {
    expect(eas.build.preview).toMatchObject({
      distribution: "internal",
      channel: "preview",
      environment: "preview",
      autoIncrement: true,
      android: { buildType: "apk" },
    });
  });

  it("production: kanal production, Android app-bundle, iOS disiapkan", () => {
    expect(eas.build.production).toMatchObject({
      channel: "production",
      environment: "production",
      autoIncrement: true,
      android: { buildType: "app-bundle" },
    });
    expect(eas.build.production.ios).toBeDefined();
  });

  it("development: dev client APK", () => {
    expect(eas.build.development).toMatchObject({
      developmentClient: true,
      distribution: "internal",
      channel: "development",
      environment: "development",
      android: { buildType: "apk" },
    });
  });

  it("versi aplikasi dikelola EAS", () => {
    expect(eas.cli.appVersionSource).toBe("remote");
  });

  it("expo-updates terpasang", () => {
    expect(pkg.dependencies["expo-updates"]).toMatch(/^~57\./);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/eas.test.ts`
Expected: FAIL pada "tanpa nilai env", "preview", "production", "development", dan "expo-updates terpasang".

- [ ] **Step 3: Tulis ulang `apps/mobile/eas.json`**

```json
{
  "cli": {
    "version": ">= 16.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "channel": "development",
      "environment": "development",
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "distribution": "internal",
      "channel": "preview",
      "environment": "preview",
      "autoIncrement": true,
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "channel": "production",
      "environment": "production",
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"
      },
      "ios": {}
    }
  },
  "submit": {
    "production": {}
  }
}
```

(`>= 16.0.0`: eas-cli yang mengenal `environment` di profil build. `submit.production` kosong: `eas submit` menanyakan App Store Connect app secara interaktif — spec §7.)

- [ ] **Step 4: Pasang expo-updates**

Run: `cd apps/mobile && npx expo install expo-updates`
Lalu: `git status --short` — yang berubah hanya `apps/mobile/package.json`, `pnpm-lock.yaml`, dan `apps/mobile/eas.json` (Step 3). Bila `npx expo install` juga mengubah `app.json`, periksa isinya: `updates.url` dan `runtimeVersion` sudah ada — kembalikan perubahan yang menduplikasi dengan `git restore apps/mobile/app.json`, kecuali yang benar-benar baru dan dibutuhkan; catat keputusan di ledger sebagai `Ruling:`.

- [ ] **Step 5: Jalankan tes; typecheck**

Run: `pnpm --filter @nearly/mobile exec vitest run test/eas.test.ts test/konfigurasi-app.test.ts`
Expected: PASS.
Run: `pnpm --filter @nearly/mobile run typecheck`
Expected: tanpa galat.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/eas.json apps/mobile/package.json pnpm-lock.yaml apps/mobile/test/eas.test.ts
git commit -m "build(mobile): eas.json tanpa env LAN, profil production + kanal EAS Update, pasang expo-updates"
```

---

### Task 3: Kanal notifikasi Android sebelum izin

**Files:**
- Modify: `apps/mobile/src/pesan/push.ts`
- Test: `apps/mobile/test/push.test.ts`

**Interfaces:**
- Produces: `export const KANAL_ANDROID = "default"` dan `export const NAMA_KANAL_ANDROID = "Messages and Radar"` di `src/pesan/push.ts`. Tandatangan `daftarkanPush(sesi: SesiPesan): Promise<void>` dan `lupakanPendaftaranPush(): void` tidak berubah.

- [ ] **Step 1: Perbarui mock dan tulis tes yang gagal**

Di `apps/mobile/test/push.test.ts`, ganti tiga deklarasi `const mock… = vi.fn();` dan blok `vi.mock("expo-notifications", …)` dengan:

```ts
const mockGetPermissionsAsync = vi.fn();
const mockRequestPermissionsAsync = vi.fn();
const mockGetExpoPushTokenAsync = vi.fn();
const mockSetNotificationChannelAsync = vi.fn();
const platform = vi.hoisted(() => ({ OS: "ios" as "ios" | "android" }));

vi.mock("react-native", () => ({ Platform: platform }));

vi.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 },
  getPermissionsAsync: () => mockGetPermissionsAsync(),
  requestPermissionsAsync: () => mockRequestPermissionsAsync(),
  getExpoPushTokenAsync: (args: unknown) => mockGetExpoPushTokenAsync(args),
  setNotificationChannelAsync: (id: string, opsi: unknown) => mockSetNotificationChannelAsync(id, opsi),
}));
```

Ubah impor push menjadi:

```ts
import { daftarkanPush, KANAL_ANDROID, lupakanPendaftaranPush, NAMA_KANAL_ANDROID } from "../src/pesan/push";
```

Di `beforeEach`, tambahkan `platform.OS = "ios";`. Lalu tambahkan dua tes di dalam `describe("push", …)`:

```ts
  it("Android: kanal 'default' dibuat SEBELUM izin diminta (Android 13, spec distribusi §4.2)", async () => {
    platform.OS = "android";
    mockSetNotificationChannelAsync.mockResolvedValue(null);
    mockGetPermissionsAsync.mockResolvedValue({ granted: true });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: "ExponentPushToken[android]" });
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })) as never;

    await daftarkanPush(buatSesi("0x3333333333333333333333333333333333333333"));

    expect(KANAL_ANDROID).toBe("default");
    expect(NAMA_KANAL_ANDROID).toBe("Messages and Radar");
    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith("default", {
      name: "Messages and Radar",
      importance: 4,
    });
    expect(mockSetNotificationChannelAsync.mock.invocationCallOrder[0]!).toBeLessThan(
      mockGetPermissionsAsync.mock.invocationCallOrder[0]!,
    );
  });

  it("iOS: tidak membuat kanal", async () => {
    mockGetPermissionsAsync.mockResolvedValue({ granted: false });
    mockRequestPermissionsAsync.mockResolvedValue({ granted: false });

    await daftarkanPush(buatSesi("0x4444444444444444444444444444444444444444"));

    expect(mockSetNotificationChannelAsync).not.toHaveBeenCalled();
    expect(mockGetExpoPushTokenAsync).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `pnpm --filter @nearly/mobile exec vitest run test/push.test.ts`
Expected: FAIL — `KANAL_ANDROID` tidak diekspor / `setNotificationChannelAsync` tidak dipanggil. Dua tes lama tetap PASS.

- [ ] **Step 3: Implementasi**

Di `apps/mobile/src/pesan/push.ts`, tambahkan impor:

```ts
import { Platform } from "react-native";
```

dan konstanta di atas `let sudahDicoba`:

```ts
/**
 * Kanal Android untuk semua notifikasi Nearly (spec distribusi §4.2, D12).
 * API mengirim tanpa channelId dan Expo mengantarnya ke kanal "default", jadi id
 * ini TIDAK boleh diganti tanpa mengubah API. Nama tampil di Pengaturan Android.
 */
export const KANAL_ANDROID = "default";
export const NAMA_KANAL_ANDROID = "Messages and Radar";
```

Di dalam `try` pada `daftarkanPush`, sebagai pernyataan PERTAMA (sebelum `getPermissionsAsync`):

```ts
    // Android 13 hanya menampilkan dialog izin bila aplikasi sudah punya kanal.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(KANAL_ANDROID, {
        name: NAMA_KANAL_ANDROID,
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
```

Di komentar dok `daftarkanPush`, ganti frasa "push belum tentu jalan di Expo Go SDK 57" dengan "push tidak jalan di Expo Go SDK 57 dan butuh build EAS (spec distribusi D5)"; sisanya tetap.

- [ ] **Step 4: Jalankan tes; penjaga bahasa; typecheck**

Run: `pnpm --filter @nearly/mobile exec vitest run test/push.test.ts test/bahasa.test.ts`
Expected: PASS (keempat tes push; penjaga bahasa hijau). Jangan melonggarkan `bahasa.test.ts`; bila merah karena string baru, perbaiki teksnya atau berhenti dan laporkan.
Run: `pnpm --filter @nearly/mobile run typecheck`
Expected: tanpa galat.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/pesan/push.ts apps/mobile/test/push.test.ts
git commit -m "feat(mobile): kanal notifikasi Android 'default' dibuat sebelum izin push diminta"
```

---

### Task 4: Web — bagian "Get the app"

**Files:**
- Create: `apps/web/src/unduhan.ts`
- Modify: `apps/web/src/pages/Landing.tsx`
- Modify: `apps/web/src/vite-env.d.ts`
- Modify: `apps/web/src/gaya.css`
- Test: `apps/web/test/unduhan.test.ts`, `apps/web/test/landing.test.ts`

**Interfaces:**
- Produces: `export function tautanApk(nilai?: string): string | null` di `src/unduhan.ts`; `Landing({ apkUrl }: { apkUrl?: string | null } = {})` — `<Landing />` di `src/main.tsx` tetap jalan tanpa perubahan.

- [ ] **Step 1: Tulis tes yang gagal**

`apps/web/test/unduhan.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { tautanApk } from "../src/unduhan";

describe("tautanApk (spec distribusi D10)", () => {
  it("menerima URL https", () => {
    expect(tautanApk("https://unduh.contoh.id/nearly.apk")).toBe("https://unduh.contoh.id/nearly.apk");
  });
  it("menolak kosong, http, dan bukan URL", () => {
    expect(tautanApk(undefined)).toBeNull();
    expect(tautanApk("")).toBeNull();
    expect(tautanApk("http://unduh.contoh.id/nearly.apk")).toBeNull();
    expect(tautanApk("nearly.apk")).toBeNull();
    expect(tautanApk("javascript:alert(1)")).toBeNull();
  });
});
```

Tambahkan di akhir `apps/web/test/landing.test.ts`:

```ts
describe("Landing — Get the app (spec distribusi D10)", () => {
  const APK = "https://unduh.contoh.id/nearly.apk";

  it("tombol unduh APK tampil bila tautan ada, beserta catatan iPhone", () => {
    const html = renderToString(Landing({ apkUrl: APK }));
    expect(html).toContain("Get the app");
    expect(html).toContain(`href="${APK}"`);
    expect(html).toContain("Download for Android");
    expect(teksTerbaca(html)).toContain("iphone: coming soon");
    expect(html.indexOf("Get the app")).toBeLessThan(html.indexOf("How it works"));
  });

  it("tidak dirender bila tautan kosong", () => {
    const html = renderToString(Landing({ apkUrl: null }));
    expect(html).not.toContain("Get the app");
    expect(html).not.toContain("Download for Android");
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `pnpm --filter @nearly/web exec vitest run test/unduhan.test.ts test/landing.test.ts`
Expected: FAIL — modul `../src/unduhan` tidak ada; tes Get the app gagal.

- [ ] **Step 3: `src/unduhan.ts` dan tipe env**

`apps/web/src/unduhan.ts`:

```ts
/**
 * Tautan unduh APK Android dari VITE_APK_URL (spec distribusi D4, D10).
 * Hanya https: pengunjung memasang berkas ini di HP-nya, jadi tautan yang bisa
 * disadap di jalan tidak pernah ditampilkan. null = bagian unduh disembunyikan.
 */
export function tautanApk(nilai: string | undefined = import.meta.env.VITE_APK_URL): string | null {
  if (!nilai) return null;
  try {
    const url = new URL(nilai);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
```

Di `apps/web/src/vite-env.d.ts`, tambahkan di dalam `ImportMetaEnv`:

```ts
  /** Tautan APK Android, mis. https://unduh.<domain>/nearly.apk. Kosong = bagian unduh disembunyikan. */
  readonly VITE_APK_URL?: string;
```

- [ ] **Step 4: Landing**

Di `apps/web/src/pages/Landing.tsx`, tambahkan `import { tautanApk } from "../unduhan";`, ubah tandatangan menjadi:

```tsx
export function Landing({ apkUrl = tautanApk() }: { apkUrl?: string | null } = {}) {
```

dan sisipkan tepat setelah `</section>` penutup `hero`:

```tsx
      {/* distribusi D1 (Android dulu lewat APK, iPhone menyusul lewat TestFlight), D4, D10;
          "stays on your phone" = spec dompet 2026-09-17 (dompet dibuat dan disimpan di HP) */}
      {apkUrl && (
        <section className="unduh">
          <h2>Get the app</h2>
          <a className="tombol-utama" href={apkUrl}>Download for Android (APK)</a>
          <ol className="langkah-pasang">
            <li>Open the downloaded file on your Android phone.</li>
            <li>If Android asks, allow installing apps from this source.</li>
            <li>Open Nearly and create your wallet. It stays on your phone.</li>
          </ol>
          <p className="catatan">iPhone: coming soon.</p>
        </section>
      )}
```

- [ ] **Step 5: Gaya**

Tambahkan di akhir `apps/web/src/gaya.css`:

```css
.unduh .langkah-pasang {
  margin: 16px 0 0;
  padding-left: 20px;
}

.unduh .catatan {
  margin-top: 12px;
  opacity: 0.7;
}
```

- [ ] **Step 6: Jalankan tes; typecheck; build**

Run: `pnpm --filter @nearly/web exec vitest run`
Expected: PASS semua (termasuk penjaga overclaim dan "tanpa angka pengguna").
Run: `pnpm --filter @nearly/web run typecheck && pnpm --filter @nearly/web run build`
Expected: tanpa galat.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/unduhan.ts apps/web/src/pages/Landing.tsx apps/web/src/vite-env.d.ts apps/web/src/gaya.css apps/web/test/unduhan.test.ts apps/web/test/landing.test.ts
git commit -m "feat(web): bagian Get the app di landing dengan tautan APK dari VITE_APK_URL"
```

---

### Task 5: Caddy unduhan, runbook, `.env.example`

**Files:**
- Modify: `deploy/Caddyfile`
- Modify: `docs/demo/runbook.md` (§1.5, §1.7 baru, §2 langkah 3, §3 tulis ulang, §8 baru)
- Modify: `.env.example` (komentar di atas `EXPO_PUBLIC_API_URL=`)

Tidak ada kode yang dites; verifikasi Step 6 adalah pemeriksaan teks.

- [ ] **Step 1: Caddyfile**

Tambahkan di akhir `deploy/Caddyfile`:

```caddyfile

# Unduhan APK Android (spec distribusi D4). NEARLY_DOWNLOAD_HOST diisi lewat env
# layanan Caddy seperti NEARLY_API_HOST; contoh nilainya: unduh.<domain>.
# Berkas diunggah pemilik ke /srv/nearly/unduh — langkahnya di runbook bagian 1.7.
{$NEARLY_DOWNLOAD_HOST} {
	root * /srv/nearly/unduh

	@apk path *.apk
	header @apk Content-Type application/vnd.android.package-archive
	# Nama berkas tetap (nearly.apk) sementara isinya berganti tiap build.
	header @apk Cache-Control no-cache

	file_server
}
```

- [ ] **Step 2: Runbook §1.5 dan §1.7**

Di §1.5 langkah 1, ganti kalimatnya menjadi: "Di pengelola DNS domainmu: rekaman **A** `api.<domain>` dan `unduh.<domain>` → `<vps>`. Tunggu sampai `dig +short api.<domain>` dan `dig +short unduh.<domain>` mengembalikan `<vps>`."

Di blok bash §1.5 langkah 2, tambahkan baris `#   Environment=NEARLY_DOWNLOAD_HOST=unduh.<domain>` tepat di bawah baris `#   Environment=NEARLY_API_HOST=api.<domain>`, dan ganti perintah validasinya menjadi:

```bash
sudo NEARLY_API_HOST=api.<domain> NEARLY_DOWNLOAD_HOST=unduh.<domain> caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
```

Sisipkan sub-bagian baru tepat setelah blok §1.6 (sebelum `---` yang mendahului `## 2.`):

````markdown
### 1.7 Unduhan APK (`unduh.<domain>`)

Folder yang dilayani blok kedua Caddyfile (spec distribusi D4):

```bash
sudo mkdir -p /srv/nearly/unduh
sudo chown "$USER" /srv/nearly/unduh      # pengguna SSH-mu yang mengunggah
```

Setiap APK baru (dari bagian 3.4) diunggah dari laptop dengan nama tetap:

```bash
scp ~/Downloads/<berkas-dari-eas>.apk <user>@<vps>:/srv/nearly/unduh/nearly.apk
curl -sI https://unduh.<domain>/nearly.apk | grep -i "content-type\|content-length"
# content-type: application/vnd.android.package-archive
```
````

- [ ] **Step 3: Runbook §2 langkah 3**

Tambahkan di akhir langkah 3 §2: "`VITE_APK_URL` = `https://unduh.<domain>/nearly.apk` (Production) — tanpa nilai ini bagian **Get the app** di landing tidak tampil (spec distribusi D10). Isi setelah APK pertama diunggah (bagian 1.7), lalu Redeploy."

- [ ] **Step 4: Runbook §3 (tulis ulang) dan §8 (baru)**

Ganti seluruh isi §3 (dari `## 3. Aplikasi mobile` sampai sebelum `---` yang mendahului `## 4. H-1`) dengan:

````markdown
## 3. Aplikasi mobile — APK Android lewat EAS (spec distribusi)

Peserta memasang **aplikasi sendiri**, bukan Expo Go. Semua perintah dari `apps/mobile`, di laptop
pemilik, dengan `npx eas-cli@latest` (atau `npm i -g eas-cli`, lalu `eas login` sekali).

### 3.1 Pengembangan lokal (tidak berubah)

`apps/mobile/.env` (BUKAN `.env` root) hanya dibaca Metro di laptop. Untuk Expo Go dengan API
produksi: `EXPO_PUBLIC_API_URL=https://api.<domain>`, lalu `npx expo start -c`. Build EAS **tidak**
membaca berkas ini. Nilai `EXPO_PUBLIC_DEV_PRIVATE_KEY` di berkas itu boleh dihapus: setiap HP
membuat dompetnya sendiri di layar **Get started**.

### 3.2 Nilai env untuk build (sekali, lalu setiap kali berubah)

Build dan update membaca EAS environment variables (spec distribusi D6):

```bash
eas env:create --environment preview --name EXPO_PUBLIC_API_URL --value https://api.<domain> --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_CONNECTION_REGISTRY --value <alamat> --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_VOUCH_REGISTRY --value <alamat> --visibility plaintext
eas env:create --environment preview --name EXPO_PUBLIC_ATTENDANCE_REGISTRY --value <alamat> --visibility plaintext
eas env:list --environment preview
```

Alamat kontrak = nilai yang sama dengan `/etc/nearly/api.env`. Tanpa keempatnya aplikasi berhenti
saat dibuka (`src/config.ts`). `EXPO_PUBLIC_*` ikut terbundel ke aplikasi — jangan pernah menaruh
rahasia di sana.

### 3.3 Notifikasi push (Firebase, sekali)

1. [console.firebase.google.com](https://console.firebase.google.com) → proyek baru (Analytics
   boleh dimatikan) → **Add app → Android**, package `app.nearly.mobile` → unduh
   `google-services.json`. Berkas ini tidak di-commit (`.gitignore`).
2. Simpan sebagai EAS file variable (spec distribusi D7):
   `eas env:create --environment preview --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret`
3. Firebase → **Project settings → Service accounts → Generate new private key** (JSON). Unggah:
   `eas credentials -p android` → profil `preview` → **Google Service Account → Manage your Google
   Service Account Key for Push Notifications (FCM V1)** → pilih berkas JSON tadi. Hapus berkas JSON
   itu dari laptop setelah terunggah.

### 3.4 Build APK

```bash
eas build -p android --profile preview
```

±15 menit di antrean gratis. Unduh APK dari tautan yang dicetak, lalu unggah ke VPS (bagian 1.7).
`versionCode` naik otomatis, jadi APK baru terpasang di atas APK lama dan dompet di HP tetap ada.

Uji penerimaan (spec distribusi §6): pasang dari landing di HP Android nyata → buat dompet →
salaman dengan perangkat kedua → kirim pesan dari perangkat kedua saat aplikasi di latar belakang →
notifikasi muncul, ketuk membuka Percakapan.

### 3.5 Memperbarui tanpa build ulang (EAS Update)

Perubahan yang hanya menyentuh JavaScript/TypeScript:

```bash
eas update --channel preview --environment preview --message "<ringkas perubahan>"
```

HP mengunduh pembaruan saat aplikasi dibuka, dan memakainya pada pembukaan berikutnya. Perubahan
**native** (dependensi baru dengan kode native, plugin/izin di `app.json`, ikon) tidak bisa lewat
update: naikkan `version` di `app.json` (mis. `0.2.0` → `0.3.0`), build ulang (3.4), unggah APK baru.
`runtimeVersion` mengikuti `version`, jadi update untuk 0.3.0 tidak pernah sampai ke APK 0.2.0.
````

Tambahkan di akhir berkas runbook:

````markdown

---

## 8. iPhone — TestFlight (tahap 2, spec distribusi §7)

Belum dijalankan. Prasyarat: **Apple Developer Program** ($99/tahun) atas nama pemilik. Tidak perlu
Xcode: EAS membangun di cloud dan membuat sertifikat, profil provisioning, dan kunci APNs push.

1. Env `production`: ulangi bagian 3.2 dengan `--environment production` (API dan alamat kontrak yang
   sama). Push iOS lewat APNs tidak memakai `google-services.json`.
2. `eas build -p ios --profile production` — pertama kali, login Apple ID dan biarkan EAS membuat
   kredensial (termasuk kunci push).
3. `eas submit -p ios --latest` — pilih/buat app di App Store Connect saat ditanya.
4. App Store Connect → TestFlight → **External Testing** → grup baru → tambahkan build → isi
   informasi uji → kirim ke **Beta App Review** (±1–2 hari, sekali per versi).
5. Setelah disetujui: aktifkan **Public Link**, taruh di landing menggantikan "iPhone: coming soon".
6. Pembaruan JS: `eas update --channel production --environment production --message "…"`.
````

- [ ] **Step 5: `.env.example`**

Ganti baris-baris komentar tepat di atas `EXPO_PUBLIC_API_URL=` (yang berakhir dengan contoh `http://192.168.1.5:8787` / URL tunnel) dengan komentar berikut; baris nilai contohnya dibiarkan:

```bash
# Hanya untuk Metro di laptop (salin ke apps/mobile/.env): IP LAN Mac kalau
# satu Wi-Fi, atau https://api.<domain>. Build EAS (APK) TIDAK membaca berkas
# ini — nilainya di EAS environment variables (runbook bagian 3.2).
```

(Hanya `.env.example`. Jangan membuka `.env` mana pun.)

- [ ] **Step 6: Periksa**

Run: `grep -n "NEARLY_DOWNLOAD_HOST" deploy/Caddyfile docs/demo/runbook.md && grep -n "^## \|^### " docs/demo/runbook.md`
Expected: host unduhan muncul di Caddyfile dan runbook; urutan bagian §1.1–§1.7, §2, §3.1–§3.5, §4–§8.
Run: `git status --short` — hanya ketiga berkas task ini.

- [ ] **Step 7: Commit**

```bash
git add deploy/Caddyfile docs/demo/runbook.md .env.example
git commit -m "docs: runbook distribusi — unduhan APK di VPS, EAS build/update, Firebase, TestFlight"
```

---

### Task 6: Verifikasi akhir dan serah terima

**Files:** tidak ada perubahan kode (kecuali perbaikan dari review).

- [ ] **Step 1: Seluruh tes dan typecheck**

Run: `pnpm -r test && pnpm -r typecheck`
Expected: semua hijau. Catat jumlah tes per paket dari keluaran nyata (baseline `main` `db20f48`: mobile 603, api 873, shared 316, trust 75, web 49).

- [ ] **Step 2: Bundel**

Run: `cd apps/mobile && D=$(mktemp -d) && npx expo export --platform android --output-dir "$D" && ls "$D"`
Expected: berhasil. (Metro membaca `apps/mobile/.env` lokal — jangan cetak isinya.)

- [ ] **Step 3: Batas jalur**

Run: `git diff --stat db20f48..HEAD`
Expected: hanya berkas Task 1–5 plus spec dan rencana ini. `apps/api/**` tidak ada; `apps/mobile/assets/icon.png`, `adaptive-icon.png`, `splash-icon.png` tidak ada.
Run: `git diff db20f48..HEAD -- apps/mobile/package.json`
Expected: hanya baris `expo-updates` bertambah.
Run: `git ls-files | grep -i "google-services\|GoogleService-Info"`
Expected: kosong.

- [ ] **Step 4: Final Whole-Branch Review**

Model paling mampu, adversarial, dicatat sebagai baris `Final Whole-Branch Review` di ledger. Perhatian khusus:
- tidak ada nilai rahasia atau IP LAN yang ter-commit;
- `app.config.ts` benar untuk tiga kasus D7, termasuk `expo export` tanpa berkas;
- kanal Android `default` dibuat sebelum izin, dan id cocok dengan asumsi D12;
- tautan APK hanya `https:`; salinan landing tidak mengklaim berlebihan;
- langkah runbook bisa diikuti dari nol oleh pemilik (DNS → VPS → Firebase → env → build → unggah → Vercel).

Satu gelombang perbaikan, lalu ulangi Step 1–3.

- [ ] **Step 5: Push dan laporan**

`git push origin distribusi`, lalu tulis komentar PR berisi: jumlah tes nyata, `git diff --stat db20f48..HEAD`, hasil `expo export`, setiap `Ruling:` baru, dan langkah operasional pemilik (spec §5) sebagai checklist. **Jangan merge.** Merge menunggu uji penerimaan APK di HP Android (spec §6) oleh pemilik.
