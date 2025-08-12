// src/config.ts
import Constants from 'expo-constants';

const expoCfg: any = (Constants.expoConfig || (Constants as any).manifest || {}) ?? {};
const extra: any = expoCfg.extra ?? {};
const hostFromExpo = (expoCfg as any)?.hostUri?.split(':')?.[0]; // mis. "192.168.1.3" saat Expo LAN

// 1) Env override (untuk build/EAS, opsional)
const envUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_LAN_API_URL ||
  extra.EXPO_PUBLIC_API_URL ||
  extra.EXPO_PUBLIC_LAN_API_URL || '';

// 2) Urutan sumber base URL (paling penting di depan)
let rawUrl =
  envUrl ||
  extra.localApiUrl ||                 // <— IP Wi-Fi laptop (rumah)
  extra.stagApiUrl ||                  // <— IP kantor (kalau dipakai)
  extra.devApiUrl ||                   // <— localhost (dev PC)
  (hostFromExpo ? `http://${hostFromExpo}:3000` : '') ||
  'http://192.168.1.3:3000';           // fallback terakhir

// 3) Parse ke komponen URL
let protocol = 'http:';
let hostname = '192.168.1.3';
let port = '3000';
try {
  const u = new URL(rawUrl);
  protocol = u.protocol;
  hostname = u.hostname;
  port = u.port || (u.protocol === 'https:' ? '443' : '80');
} catch {}

// 4) IMPORTANT: jangan auto 10.0.2.2 (itu khusus emulator).
export const baseUrl = `${protocol}//${hostname}:${port}`;

export const __CONFIG_DEBUG__ = {
  baseUrl,
  rawUrl,
  extra: {
    localApiUrl: extra.localApiUrl,
    stagApiUrl: extra.stagApiUrl,
    devApiUrl: extra.devApiUrl,
  },
};

export function logApiConfig(tag = 'config') {
  try { console.log(`[debug][${tag}]`, JSON.stringify(__CONFIG_DEBUG__)); }
  catch { console.log(`[debug][${tag}]`, __CONFIG_DEBUG__); }
}
