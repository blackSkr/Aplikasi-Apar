// src/utils/ManajemenOffline.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { safeFetchOffline } from './safeFetchOffline';

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
      const res = await safeFetchOffline(req.url, {
        method: req.method,
        headers: { 'Content-Type': 'application/json' },
        body: req.body != null ? JSON.stringify(req.body) : undefined,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      // sukses, skip
    } catch {
      remaining.push(req);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
}

// auto‑flush saat online
NetInfo.addEventListener(state => {
  if (state.isConnected) {
    flushQueue();
  }
});
