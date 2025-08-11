// src/config.ts
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// baca extra dari app.json
const extra: any =
  Constants.expoConfig?.extra ??
  (Constants as any).manifest?.extra ??
  {};

// prioritas: env → (dev? devApi : stagApi)
const envUrl = process.env.EXPO_PUBLIC_API_URL || extra.apiUrl;
const devUrl = extra.devApiUrl || 'http://localhost:3000';
const stagUrl = extra.stagApiUrl || devUrl;

let rawUrl: string = envUrl || (__DEV__ ? devUrl : stagUrl);
const u = new URL(rawUrl);

// Android emulator dev: kalau host localhost/127.0.0.1 → ganti ke 10.0.2.2
if (
  Platform.OS === 'android' &&
  __DEV__ &&
  (u.hostname === 'localhost' || u.hostname === '127.0.0.1')
) {
  u.hostname = '10.0.2.2';
}

// pastikan ada port
if (!u.port) {
  u.port = u.protocol === 'https:' ? '443' : '80';
}

export const baseUrl = `${u.protocol}//${u.hostname}:${u.port}`;

if (__DEV__) {
  console.log('[config] baseUrl =', baseUrl);
}
