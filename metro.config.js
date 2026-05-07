const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Reduce bundle size: exclude large dev-only packages from production bundles
config.resolver.blockList = [
  // Exclude expo-dev-client internals from production bundles
  /expo-dev-client\/.*\/DevLauncher.*/,
];

module.exports = config;
