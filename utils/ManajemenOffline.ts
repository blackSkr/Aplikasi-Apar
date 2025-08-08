// src/utils/ManajemenOffline.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { baseUrl } from '../src/config';

const QUEUE_KEY = 'OFFLINE_QUEUE';

export interface PendingRequest {
  method: 'POST' | 'PUT' | 'DELETE' | string;
  path: string;                   // either a full URL or just “/api/…” path
  bodyParts?: Array<[string, any]>;
}

async function enqueueRequest(req: PendingRequest) {
  const raw = (await AsyncStorage.getItem(QUEUE_KEY)) || '[]';
  const queue: PendingRequest[] = JSON.parse(raw);
  queue.push(req);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  console.log('[Debug][OfflineQueue] enqueue → size =', queue.length);
}

export async function getQueueCount(): Promise<number> {
  const raw = (await AsyncStorage.getItem(QUEUE_KEY)) || '[]';
  const queue: PendingRequest[] = JSON.parse(raw);
  const len = Array.isArray(queue) ? queue.length : 0;
  console.log('[Debug][OfflineQueue] getQueueCount =', len);
  return len;
}

/**
 * safeFetchOffline:
 * - If you pass a full URL (http…): use it, else prefix baseUrl.
 * - GET: always try fetch(); on throw → fallback offline.
 * - non-GET: try fetch(); on throw → enqueue + fake offline response.
 */
export async function safeFetchOffline(
  pathOrUrl: string,
  options: RequestInit = {}
): Promise<Response> {
  const method = (options.method || 'GET').toUpperCase();
  const isFullUrl = /^https?:\/\//i.test(pathOrUrl);
  const url = isFullUrl ? pathOrUrl : `${baseUrl}${pathOrUrl}`;

  console.log(`[Debug][safeFetchOffline] → ${method} ${url}`);

  if (method === 'GET') {
    try {
      const res = await fetch(url, options);
      console.log('[Debug][safeFetchOffline][GET] success', res.status);
      return res;
    } catch (err) {
      console.warn('[Debug][safeFetchOffline][GET] failed, fallback offline', err);
      return new Response(JSON.stringify({ offline: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // POST/PUT/DELETE
  try {
    const res = await fetch(url, options);
    console.log(`[Debug][safeFetchOffline][${method}] success`, res.status);
    return res;
  } catch (err) {
    console.warn(`[Debug][safeFetchOffline][${method}] network error, enqueue`, err);

    // extract bodyParts for FormData re-build
    let parts: Array<[string, any]> = [];
    const body = options.body as any;
    if (body && Array.isArray(body._parts)) parts = body._parts;
    else if (body && typeof body === 'object') parts = Object.entries(body);

    await enqueueRequest({ method, path: pathOrUrl, bodyParts: parts });

    return new Response(JSON.stringify({ offline: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * flushQueue: attempt to send all queued POST/PUT/DELETE items.
 *   - re-builds full URL if needed
 *   - re-builds FormData
 *   - on success: drop item; on failure: keep in remaining
 */
export async function flushQueue(): Promise<number> {
  const raw = (await AsyncStorage.getItem(QUEUE_KEY)) || '[]';
  let queue: PendingRequest[];
  try {
    queue = JSON.parse(raw);
  } catch (err) {
    console.error('[Debug][flushQueue] JSON.parse error', err);
    queue = [];
  }
  console.log('[Debug][flushQueue] start, queue size =', queue.length);

  const remaining: PendingRequest[] = [];

  for (const req of queue) {
    const method = (req.method || '').toUpperCase();
    if (!req.path || !['POST','PUT','DELETE'].includes(method)) {
      console.log('[Debug][flushQueue] drop invalid item', req);
      continue;
    }

    const isFullUrl = /^https?:\/\//i.test(req.path);
    const url = isFullUrl ? req.path : `${baseUrl}${req.path}`;

    const formData = new FormData();
    if (req.bodyParts) {
      for (const [k, v] of req.bodyParts) {
        formData.append(k, v);
      }
    }

    console.log('[Debug][flushQueue] sending', method, url);
    try {
      // allow RN to set multipart boundary
      const res = await fetch(url, { method, body: formData });
      if (!res.ok) {
        console.warn('[Debug][flushQueue] server error', res.status);
        remaining.push(req);
      } else {
        console.log('[Debug][flushQueue] success', url);
      }
    } catch (err) {
      console.error('[Debug][flushQueue] network error', err);
      remaining.push(req);
    }
  }

  console.log('[Debug][flushQueue] remaining =', remaining.length);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  return remaining.length;
}



// auto-flush saat online
// NetInfo.addEventListener(state => {
//   if (state.isConnected) {
//     flushQueue();
//   }
// });
