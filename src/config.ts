// src/config.ts
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Ambil expo config & extra dari app.json
const expoCfg: any = (Constants.expoConfig || (Constants as any).manifest || {}) ?? {};
const extra: any = expoCfg.extra ?? {};

// 1) PRIORITAS: env override untuk APK / build (EAS)
const envUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_LAN_API_URL ||
  extra.EXPO_PUBLIC_API_URL ||
  extra.EXPO_PUBLIC_LAN_API_URL || '';

// 2) FALLBACK (kalau envUrl kosong): pakai app.json extra
let rawUrl =
  envUrl ||
  extra.stagApiUrl ||          // biasanya IP LAN kamu (172.16.34.189:3000)
  extra.devApiUrl ||           // default dev
  'http://localhost:3000';

// 3) Parse URL
let protocol = 'http:';
let hostname = 'localhost';
let port = '3000';

try {
  const u = new URL(rawUrl);
  protocol = u.protocol;
  hostname = u.hostname;
  port = u.port || (u.protocol === 'https:' ? '443' : '80');
} catch {
  // ignore
}

// 4) AUTO-EMULATOR: aktif HANYA saat DEVELOPER MODE (__DEV__ = true)
//    Supaya APK rilis tidak ketimpa ke 10.0.2.2
const hasEnvOverride = !!envUrl;
if (!hasEnvOverride && Platform.OS === 'android' && __DEV__) {
  hostname = '10.0.2.2';
}

// 5) Susun baseUrl final
export const baseUrl = `${protocol}//${hostname}:${port}`;

// 6) Ekspor payload debug (dipakai di index.tsx)
export const __CONFIG_DEBUG__ = {
  baseUrl,
  platform: Platform.OS,
  rawUrl,
  envUrl: hasEnvOverride ? envUrl : null,
  extra: {
    devApiUrl: extra.devApiUrl,
    stagApiUrl: extra.stagApiUrl,
    EXPO_PUBLIC_API_URL: extra.EXPO_PUBLIC_API_URL,
    EXPO_PUBLIC_LAN_API_URL: extra.EXPO_PUBLIC_LAN_API_URL,
  },
};

// 7) Helper log kalau mau dipanggil manual
export function logApiConfig(tag = 'config') {
  try {
    console.log(`[debug][${tag}]`, JSON.stringify(__CONFIG_DEBUG__));
  } catch {
    console.log(`[debug][${tag}]`, __CONFIG_DEBUG__);
  }
}
