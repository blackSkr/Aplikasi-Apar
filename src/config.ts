// src/config.ts
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// 1. Baca manifest (fallback untuk SDK baru)
const manifest = Constants.manifest || (Constants as any).expoConfig || {};
const channel = (manifest.releaseChannel as string) || 'development';

// 2. Ambil extra URLs dari app.json
interface Extra {
  devApiUrl:  string;
  stagApiUrl: string;
  prodApiUrl?: string;
}
const extra = (manifest.extra || {}) as Extra;

// 3. Pilih rawUrl berdasarkan channel
let rawUrl = extra.devApiUrl;
if (channel === 'staging') {
  rawUrl = extra.stagApiUrl;
} else if (channel === 'production' && extra.prodApiUrl) {
  rawUrl = extra.prodApiUrl;
}

// 4. OVERRIDE CEPAT langsung ke Android emulator IP
//    uncomment baris di bawah ini untuk paksa pakai 10.0.2.2:3000
rawUrl = 'http://10.0.2.2:3000';

// 5. Ubah hostname untuk Android emulator (tetap 10.0.2.2) atau pakai hostname asli
const u = new URL(rawUrl);
const hostname =
  Platform.OS === 'android' && channel === 'development'
    ? '10.0.2.2'
    : u.hostname;

// 6. Rekonstruksi baseUrl lengkap dengan port
export const baseUrl = `${u.protocol}//${hostname}:${u.port}`;
