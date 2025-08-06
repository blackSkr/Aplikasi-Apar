// src/utils/ManajemenOffline.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = 'OFFLINE_QUEUE';

export interface PendingRequest {
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  bodyParts: Array<[string, any]>;    // store array of [key, value]
}

async function enqueueRequest(req: PendingRequest) {
  const raw = (await AsyncStorage.getItem(QUEUE_KEY)) || '[]';
  const q: PendingRequest[] = JSON.parse(raw);
  q.push(req);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export async function safeFetchOffline(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const state = await NetInfo.fetch();
  const online = !!state.isConnected && state.isInternetReachable === true;

  // kalau kita offline ➔ enqueue & return fake response
  if (!online && (options.method || 'GET') !== 'GET') {
    // ekstrak FormData parts (React Native)
    let parts: Array<[string, any]> = [];
    const body = options.body as any;
    if (body && Array.isArray(body._parts)) {
      parts = body._parts as Array<[string, any]>;
    } else if (body && typeof body === 'object') {
      // fallback: flatten simple object
      parts = Object.entries(body);
    }

    await enqueueRequest({
      method: (options.method as any) || 'POST',
      url,
      bodyParts: parts,
    });

    // kembalikan response success agar caller nggak crash
    return new Response(JSON.stringify({ offline: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // kalau online (atau GET) jalankan fetch normal
  return fetch(url, options);
}
