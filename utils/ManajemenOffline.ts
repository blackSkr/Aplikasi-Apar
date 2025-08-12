// src/utils/ManajemenOffline.ts
import { baseUrl } from '@/src/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'OFFLINE_QUEUE';

export interface PendingRequest {
  method: 'POST' | 'PUT' | 'DELETE' | string;
  path: string;                   // bisa full URL atau path "/api/…"
  bodyParts?: Array<[string, any]>;
}

const log  = (...a: any[]) => { if (__DEV__) console.log('[Offline]', ...a); };
const warn = (...a: any[]) => { if (__DEV__) console.warn('[Offline]', ...a); };

async function readQueue(): Promise<PendingRequest[]> {
  const raw = (await AsyncStorage.getItem(QUEUE_KEY)) || '[]';
  try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
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
  console.log('[Debug][OfflineQueue] getQueueCount =', q.length);
  return q.length;
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
 *    - return response asli (2xx/3xx/4xx/5xx) → caller yang bedakan
 *    - network error → { offline:true, reason:'network' }
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
      return res as any; // biarkan caller bedakan statusnya
    } catch (err) {
      console.warn('[Debug][safeFetchOffline][GET] network error → offline', err);
      return offlineResponse('network');
    }
  }

  const extractBodyParts = (): Array<[string, any]> => {
    const b: any = (options as any).body;
    if (b && Array.isArray(b?._parts)) return b._parts as Array<[string, any]>;
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

export async function flushQueue(): Promise<number> {
  let queue = await readQueue();
  console.log('[Debug][flushQueue] start, queue size =', queue.length);

  const remaining: PendingRequest[] = [];

  const isFilePart = (v: any) =>
    v && typeof v === 'object' &&
    (('uri' in v && (String(v.uri).startsWith('file://') || String(v.uri).startsWith('content://')))
      || ('type' in v && 'name' in v));

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
        const preview =
          typeof v === 'string'
            ? (v.length > 60 ? v.slice(0, 60) + '…' : v)
            : isFilePart(v)
            ? `{file uri=${v?.uri} type=${v?.type} name=${v?.name}}`
            : JSON.stringify(v).slice(0, 60) + '…';
        console.log('[Debug][flushQueue] append', k, '→', preview);

        if (isFilePart(v)) {
          const file: any = {
            uri: v.uri,
            name: v.name || 'upload.jpg',
            type: v.type || 'application/octet-stream',
          };
          formData.append(k, file as any);
        } else if (typeof v === 'string') {
          formData.append(k, v);
        } else if (v == null) {
          formData.append(k, '');
        } else {
          formData.append(k, JSON.stringify(v));
        }
      }
    }

    console.log('[Debug][flushQueue] sending', method, url);
    try {
      const res = await fetch(url, {
        method,
        body: formData,
        headers: { Accept: 'application/json' },
      });
      console.log('[Debug][flushQueue] response', res.status);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.warn('[Debug][flushQueue] server response not ok:', res.status, text);
        remaining.push(req);
      } else {
        console.log('[Debug][flushQueue] success', url);
      }
    } catch (err) {
      console.error('[Debug][flushQueue] network error', String(err), '→', url);
      remaining.push(req);
    }
  }

  console.log('[Debug][flushQueue] remaining =', remaining.length);
  await writeQueue(remaining);
  return remaining.length;
}
