// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Tambahkan 'cjs' supaya Metro bisa load file .cjs
config.resolver.sourceExts.push('cjs');

module.exports = config;
