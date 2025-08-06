// src/utils/ManajemenOffline.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = 'OFFLINE_QUEUE';

export interface PendingRequest {
  method: 'POST' | 'PUT' | 'DELETE';
  url: string;
  body?: any;
}

export async function enqueueRequest(req: PendingRequest) {
  const raw = (await AsyncStorage.getItem(QUEUE_KEY)) || '[]';
  const q: PendingRequest[] = JSON.parse(raw);
  q.push(req);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
}

export async function flushQueue() {
  const raw = (await AsyncStorage.getItem(QUEUE_KEY)) || '[]';
  const q: PendingRequest[] = JSON.parse(raw);
  const remaining: PendingRequest[] = [];

  for (const req of q) {
    try {
      const formData = new FormData();
      for (const key in req.body) {
        const value = req.body[key];
        if (
          typeof value === 'object' &&
          value !== null &&
          'uri' in value &&
          'name' in value &&
          'type' in value
        ) {
          formData.append(key, value as any);
        } else {
          formData.append(key, value);
        }
      }

      const res = await fetch(req.url, {
        method: req.method,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // success
    } catch (err) {
      remaining.push(req); // gagal, simpan lagi
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
}

export async function safeFetchOffline(url: string, options: RequestInit): Promise<Response> {
  const state = await NetInfo.fetch();
  const isConnected = !!state.isConnected;

  if (isConnected) {
    return fetch(url, options);
  } else {
    const formDataObj: any = {};
    if (options.body instanceof FormData) {
      for (let [key, value] of (options.body as FormData).entries()) {
        if (
          typeof value === 'object' &&
          value !== null &&
          'uri' in value &&
          'name' in value &&
          'type' in value
        ) {
          formDataObj[key] = {
            uri: value.uri,
            name: value.name,
            type: value.type,
          };
        } else {
          formDataObj[key] = value;
        }
      }
    }

    await enqueueRequest({
      method: options.method as 'POST' | 'PUT' | 'DELETE',
      url,
      body: formDataObj,
    });

    return new Response(JSON.stringify({ success: true, offline: true }), {
      status: 200,
      statusText: 'Offline - queued',
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function getQueueCount(): Promise<number> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return 0;
  const queue = JSON.parse(raw);
  return queue.length;
}



// auto-flush saat online
// NetInfo.addEventListener(state => {
//   if (state.isConnected) {
//     flushQueue();
//   }
// });
