// src/utils/ManajemenOffline.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { baseUrl } from '@/src/config';

const QUEUE_KEY = 'OFFLINE_QUEUE';

export interface PendingRequest {
  method: 'POST' | 'PUT' | 'DELETE' | string;
  path: string;                   // full URL atau path "/api/…"
  bodyParts?: Array<[string, any]>;
}

const log  = (...a: any[]) => { if (__DEV__) console.log('[Offline]', ...a); };
const warn = (...a: any[]) => { if (__DEV__) console.warn('[Offline]', ...a); };

async function readQueue(): Promise<PendingRequest[]> {
  const raw = (await AsyncStorage.getItem(QUEUE_KEY)) || '[]';
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeQueue(q: PendingRequest[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  log('writeQueue → len =', q.length);
}

async function enqueueRequest(req: PendingRequest) {
  const q = await readQueue();
  q.push(req);
  await writeQueue(q);
  log('enqueue', { method: req.method, path: req.path, parts: req.bodyParts?.length ?? 0 });
}

export async function getQueueCount(): Promise<number> {
  const q = await readQueue();
  const len = q.length;
  console.log('[Debug][OfflineQueue] getQueueCount =', len);
  return len;
}

function toUrl(pathOrUrl: string) {
  const isFullUrl = /^https?:\/\//i.test(pathOrUrl);
  return isFullUrl ? pathOrUrl : `${baseUrl}${pathOrUrl}`;
}

function offlineResponse(
  reason: 'network' | 'server-5xx' = 'network'
): Response & { offline?: boolean; reason?: string } {
  return new Response(JSON.stringify({ offline: true, reason }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }) as Response & { offline?: boolean; reason?: string };
}

/**
 * safeFetchOffline
 * - GET:
 *    - 2xx/3xx/4xx → return response
 *    - 5xx / network error → return { offline:true, reason }
 * - POST/PUT/DELETE:
 *    - network error → enqueue + { offline:true, reason:'network' }
 *    - 5xx           → enqueue + { offline:true, reason:'server-5xx' }
 *    - else          → return response
 */
export async function safeFetchOffline(
  pathOrUrl: string,
  options: RequestInit = {}
): Promise<Response & { offline?: boolean; reason?: string }> {
  const method = (options.method || 'GET').toUpperCase();
  const url = toUrl(pathOrUrl);

  console.log(`[Debug][safeFetchOffline] → ${method} ${url}`);

  if (method === 'GET') {
    try {
      const res = await fetch(url, options);
      console.log('[Debug][safeFetchOffline][GET] status', res.status);
      if (res.status >= 500) {
        warn('GET got 5xx → treat as offline');
        return offlineResponse('server-5xx');
      }
      return res as any;
    } catch (err) {
      console.warn('[Debug][safeFetchOffline][GET] network error, fallback offline', err);
      return offlineResponse('network');
    }
  }

  const extractBodyParts = (): Array<[string, any]> => {
    const b: any = options.body;
    if (b && Array.isArray(b._parts)) return b._parts as Array<[string, any]>; // RN FormData
    if (b && typeof b === 'object')   return Object.entries(b) as Array<[string, any]>;
    if (typeof b === 'string')        return [['__raw', b]];
    return [];
  };

  const enqueueFromOptions = async (reason: 'network' | 'server-5xx') => {
    const parts = extractBodyParts();
    await enqueueRequest({ method, path: pathOrUrl, bodyParts: parts });
    return offlineResponse(reason);
  };

  try {
    const res = await fetch(url, options);
    console.log(`[Debug][safeFetchOffline][${method}] status`, res.status);
    if (res.status >= 500) {
      warn(`${method} got ${res.status} → enqueue for retry`);
      return await enqueueFromOptions('server-5xx');
    }
    return res as any;
  } catch (err) {
    console.warn(`[Debug][safeFetchOffline][${method}] network error, enqueue`, err);
    return await enqueueFromOptions('network');
  }
}

/**
 * flushQueue
 * - kirim item satu-satu (FIFO)
 * - rebuild FormData dari bodyParts (mendukung file { uri, name, type })
 * - success (2xx)  → remove dari queue
 * - non-ok         → tahan (akan dicoba lagi kemudian)
 */
export async function flushQueue(): Promise<number> {
  let queue = await readQueue();
  console.log('[Debug][flushQueue] start, queue size =', queue.length);

  const remaining: PendingRequest[] = [];

  for (const req of queue) {
    const method = (req.method || '').toUpperCase();
    if (!req.path || !['POST', 'PUT', 'DELETE'].includes(method)) {
      console.log('[Debug][flushQueue] drop invalid item', req);
      continue;
    }

    const url = toUrl(req.path);

    const formData = new FormData();
    if (Array.isArray(req.bodyParts)) {
      for (const [k, v] of req.bodyParts) {
        formData.append(k, v as any);
      }
    }

    console.log('[Debug][flushQueue] sending', method, url);
    try {
      const res = await fetch(url, { method, body: formData });
      if (!res.ok) {
        console.warn('[Debug][flushQueue] server response', res.status);
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
  await writeQueue(remaining);
  return remaining.length;
}
// (auto-flush dikendalikan oleh hook/useOfflineQueue)
