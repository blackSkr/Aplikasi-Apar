// src/config.ts
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// 1) baca manifest/extra dari app.json
const manifest = (Constants.manifest || (Constants as any).expoConfig || {}) as any;
const channel = (manifest.releaseChannel as string) || 'development';

type Extra = { devApiUrl?: string; stagApiUrl?: string; prodApiUrl?: string };
const extra = (manifest.extra || {}) as Extra;

// 2) FORCE ke LAN IP (minta-mu: 172.16.34.189:3000)
const FORCE_LAN = true;
const LAN_URL = 'http://172.16.34.189:3000';

// 3) pilih rawUrl (kalau FORCE_LAN true, selalu pakai LAN_URL)
let rawUrl =
  (FORCE_LAN && LAN_URL) ||
  (channel === 'production' && (extra.prodApiUrl || extra.stagApiUrl)) ||
  (channel === 'staging' && (extra.stagApiUrl || extra.prodApiUrl)) ||
  extra.devApiUrl ||
  LAN_URL;

// 4) rekonstruksi baseUrl (tanpa rewrite ke 10.0.2.2 — tetap LAN IP)
const u = new URL(rawUrl);
const port = u.port || (u.protocol === 'https:' ? '443' : '80');
export const baseUrl = `${u.protocol}//${u.hostname}:${port}`;

// 5) data debug yang bisa dilog dari layar mana pun
export const __CONFIG_DEBUG__ = {
  platform: Platform.OS,
  channel,
  extra,
  rawUrl,
  baseUrl,
  forcedLan: FORCE_LAN,
};
