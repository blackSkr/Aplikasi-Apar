// src/config.ts
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// 1. Baca channel (development, staging, production)
const manifest = Constants.manifest || (Constants as any).expoConfig || {};
const channel  = (manifest.releaseChannel as string) || 'development';

// 2. Ambil URL dari app.json → extra
interface Extra {
  devApiUrl:  string;
  stagApiUrl: string;
  prodApiUrl?: string;
}
const extra = (manifest.extra || {}) as Extra;

// 3. Pilih rawUrl berdasarkan channel
let rawUrl = extra.devApiUrl;
if (channel === 'staging')   rawUrl = extra.stagApiUrl;
if (channel === 'production' && extra.prodApiUrl) rawUrl = extra.prodApiUrl;

// 4. Ubah hostname untuk Android emulator
//    - Android emulator: localhost → 10.0.2.2
//    - iOS simulator / real device tetap pakai hostname asli
const u = new URL(rawUrl);
const hostname = Platform.OS === 'android' && channel === 'development'
  ? '10.0.2.2'
  : u.hostname;

// 5. Rekonstruksi baseUrl dengan port dan protocol
export const baseUrl = `${u.protocol}//${hostname}:${u.port}`;
