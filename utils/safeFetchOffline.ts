// src/utils/safeFetchOffline.ts
import NetInfo from '@react-native-community/netinfo';

/**
 * Wrapper fetch yang memeriksa koneksi dulu.
 * @throws Error('Offline') jika device tidak terhubung
 */
export async function safeFetchOffline(
  input: RequestInfo,
  init?: RequestInit
): Promise<Response> {
  const state = await NetInfo.fetch();
  if (!state.isConnected) {
    throw new Error('Offline');
  }
  return fetch(input, init);
}
