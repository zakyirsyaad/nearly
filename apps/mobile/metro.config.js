// Konfigurasi Metro untuk monorepo pnpm.
// Tanpa watchFolders ke akar workspace, perubahan di packages/shared tidak
// terdeteksi; tanpa nodeModulesPaths, resolusi paket gagal saat build EAS.
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
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
