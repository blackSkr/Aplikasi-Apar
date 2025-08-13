// src/config.ts
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Ambil config dari Expo
const expoCfg: any = Constants.expoConfig ?? (Constants as any).manifest ?? {};
const extra: any = expoCfg.extra ?? {};

// 1) Env / Extra (prioritas tertinggi)
const envUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  extra.EXPO_PUBLIC_API_URL ||
  extra.stagApiUrl ||
  extra.localApiUrl ||
  extra.devApiUrl ||
  'http://172.16.34.189:3000'; // fallback terakhir = kantor

// 2) Tentukan rawUrl + sumber
let rawUrl = envUrl;
let source: 'env' | 'stag' | 'local' | 'dev' | 'fallback' = 'env';
if (!process.env.EXPO_PUBLIC_API_URL && extra.EXPO_PUBLIC_API_URL) source = 'env';
else if (!extra.EXPO_PUBLIC_API_URL && extra.stagApiUrl && envUrl === extra.stagApiUrl) source = 'stag';
else if (!extra.EXPO_PUBLIC_API_URL && extra.localApiUrl && envUrl === extra.localApiUrl) source = 'local';
else if (!extra.EXPO_PUBLIC_API_URL && extra.devApiUrl && envUrl === extra.devApiUrl) source = 'dev';
if (!rawUrl) { rawUrl = 'http://172.16.34.189:3000'; source = 'fallback'; }

// 3) Parse URL
let protocol = 'http:';
let hostname = '172.16.34.189';
let port = '3000';
try {
  const u = new URL(rawUrl);
  protocol = u.protocol || 'http:';
  hostname = u.hostname || '172.16.34.189';
  port = u.port || (protocol === 'https:' ? '443' : '3000');
} catch { /* keep defaults */ }

// 4) Mapping khusus emulator Android hanya jika host = localhost/127.0.0.1
let host = hostname;
if (__DEV__ && Platform.OS === 'android' && !Device.isDevice) {
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    host = '10.0.2.2'; // Genymotion = 10.0.3.2
  }
}

// ⚠️ Dihapus: hard-guard yang dulu memaksa 172.* kembali ke localApiUrl.
// (Supaya IP kantor 172.16.34.189 tetap dipakai di HP fisik.)

const portPart = port ? `:${port}` : '';
export const baseUrl = `${protocol}//${host}${portPart}`;

export const __CONFIG_DEBUG__ = {
  baseUrl,
  rawUrl,
  source,
  extra: {
    EXPO_PUBLIC_API_URL: extra.EXPO_PUBLIC_API_URL,
    stagApiUrl: extra.stagApiUrl,
    localApiUrl: extra.localApiUrl,
    devApiUrl: extra.devApiUrl
  }
};

export function logApiConfig(tag = 'config') {
  try { console.log(`[debug][${tag}]`, JSON.stringify(__CONFIG_DEBUG__)); }
  catch { console.log(`[debug][${tag}]`, __CONFIG_DEBUG__); }
}
