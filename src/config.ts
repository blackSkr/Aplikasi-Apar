// src/config.ts
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Ambil config dari Expo
const expoCfg: any = Constants.expoConfig ?? (Constants as any).manifest ?? {};
const extra: any = expoCfg.extra ?? {};

// Flag: kita lagi di Android emulator?
const isAndroidEmu = __DEV__ && Platform.OS === 'android' && !Device.isDevice;

// --- Kandidat URL ---
// Urutan prioritas disesuaikan: di emulator Android, utamakan dev/local terlebih dulu.
const candidatesEmu = [
  process.env.EXPO_PUBLIC_API_URL,         // kalau dev nyetel env → hormati, tapi akan di-map ke 10.0.2.2
  extra.devApiUrl,                         // ex: http://localhost:3000
  'http://10.0.2.2:3000',                  // fallback emulator Android
  extra.localApiUrl,                       // ex: http://192.168.1.3:3000
  extra.stagApiUrl,                        // kantor
];

const candidatesDeviceOrWeb = [
  process.env.EXPO_PUBLIC_API_URL,         // env (EAS/CI/Runtime)
  extra.EXPO_PUBLIC_API_URL,               // app.json → extra.EXPO_PUBLIC_API_URL
  extra.stagApiUrl,                        // kantor
  extra.localApiUrl,                       // LAN
  extra.devApiUrl,                         // localhost (untuk web/ios)
  'http://172.16.34.189:3000',             // fallback kantor
];

// Pilih base raw URL
let rawUrl = (isAndroidEmu ? candidatesEmu : candidatesDeviceOrWeb).find(Boolean) as string | undefined;
if (!rawUrl) rawUrl = 'http://172.16.34.189:3000'; // default terakhir

// Parse URL awal
let protocol = 'http:';
let hostname = '172.16.34.189';
let port = '3000';
try {
  const u = new URL(rawUrl);
  protocol = u.protocol || 'http:';
  hostname = u.hostname || hostname;
  port = u.port || (protocol === 'https:' ? '443' : '3000');
} catch {
  // keep defaults
}

// Mapping khusus emulator Android:
// - Jika host localhost/127.* → 10.0.2.2
// - Kalau host LAN (192.168.* / 10.* / 172.*) juga kita paksa 10.0.2.2 biar selalu ke mesin host
let host = hostname;
if (isAndroidEmu) {
  const hn = (hostname || '').toLowerCase();
  const isLocalhost = hn === 'localhost' || hn === '127.0.0.1';
  const isLan =
    hn.startsWith('192.168.') ||
    hn.startsWith('10.') ||
    hn.startsWith('172.');

  if (isLocalhost || isLan) {
    host = '10.0.2.2';
  }
}

// Port part
const portPart = port ? `:${port}` : '';
export const baseUrl = `${protocol}//${host}${portPart}`;

// Debug info
export const __CONFIG_DEBUG__ = {
  baseUrl,
  rawUrl,
  source: isAndroidEmu ? 'emu_prefer_dev' : 'env_or_extra',
  emulator: isAndroidEmu,
  device: Device.isDevice,
  platform: Platform.OS,
  extra: {
    EXPO_PUBLIC_API_URL: extra.EXPO_PUBLIC_API_URL,
    stagApiUrl: extra.stagApiUrl,
    localApiUrl: extra.localApiUrl,
    devApiUrl: extra.devApiUrl,
  },
  env: {
    EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  },
};

export function logApiConfig(tag = 'config') {
  try { console.log(`[debug][${tag}]`, JSON.stringify(__CONFIG_DEBUG__)); }
  catch { console.log(`[debug][${tag}]`, __CONFIG_DEBUG__); }
}
