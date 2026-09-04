// Konfigurasi Metro untuk monorepo pnpm.
// watchFolders membuat perubahan di packages/shared ikut terdeteksi;
// nodeModulesPaths memastikan resolusi paket bekerja saat build EAS.
//
// disableHierarchicalLookup TIDAK diset — expo/metro-config SDK 57 sudah
// menangani monorepo sendiri, dan mengoverride-nya justru merusak resolusi.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
