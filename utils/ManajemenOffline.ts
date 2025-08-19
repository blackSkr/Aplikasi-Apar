// src/utils/ManajemenOffline.ts
import { baseUrl } from '@/src/config';
import { emit } from '@/src/utils/EventBus';
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'OFFLINE_QUEUE';
const PENDING_MAP_KEY = 'OFFLINE_PENDING_APAR_MAP';

export interface PendingRequest {
  method: 'POST' | 'PUT' | 'DELETE' | string;
  pathOrUrl: string;
  bodyParts?: Array<[string, any]>;
  headers?: Record<string, string>;
  queuedAt?: number;
  attempts?: number;
}

type PendingApar = {
  id?: string;
  token?: string;
  badge?: string;
  localDoneAt: string;
  queuedAt: number;
};

const log  = (...a: any[]) => { if (__DEV__) console.log('[Offline]', ...a); };
const warn = (...a: any[]) => { if (__DEV__) console.warn('[Offline]', ...a); };

// ===== Queue primitives =====
async function readQueue(): Promise<PendingRequest[]> {
  const raw = (await AsyncStorage.getItem(QUEUE_KEY)) || '[]';
  try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr : []; } catch { return []; }
}
async function writeQueue(q: PendingRequest[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  log('writeQueue → len =', q.length);
}
async function enqueueRequest(req: PendingRequest) {
  const q = await readQueue();
  q.push({ ...req, queuedAt: Date.now(), attempts: (req.attempts ?? 0) });
  await writeQueue(q);
  log('enqueue', { method: req.method, path: req.pathOrUrl, parts: req.bodyParts?.length ?? 0 });
}
export async function getQueueCount(): Promise<number> {
  const q = await readQueue();
  console.log('[Debug][OfflineQueue] getQueueCount =', q.length);
  return q.length;
}

// ===== URL & headers =====
function toUrl(pathOrUrl: string) {
  const isFull = /^https?:\/\//i.test(pathOrUrl);
  return isFull ? pathOrUrl : `${baseUrl}${pathOrUrl}`;
}
function normalizeHeaders(h?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  if (Array.isArray(h)) for (const [k, v] of h) out[String(k)] = String(v);
  else if (h instanceof Headers) h.forEach((v, k) => (out[k] = v));
  else for (const k of Object.keys(h)) out[k] = String((h as any)[k]);
  return out;
}

// ===== Pending map (untuk overlay kartu) =====
type PendingMap = Record<string, PendingApar>;
async function readPendingMap(): Promise<PendingMap> {
  const raw = (await AsyncStorage.getItem(PENDING_MAP_KEY)) || '{}';
  try { const obj = JSON.parse(raw); return obj && typeof obj === 'object' ? obj : {}; } catch { return {}; }
}
async function writePendingMap(map: PendingMap) { await AsyncStorage.setItem(PENDING_MAP_KEY, JSON.stringify(map)); }
function keyFor(id?: string | number | null, token?: string | null) {
  if (token) return `tk:${String(token)}`;
  if (id != null) return `id:${String(id)}`;
  return '';
}
function extractFromBodyParts(parts: Array<[string, any]>) {
  let id: string | undefined;
  let token: string | undefined;
  let badge: string | undefined;
  let doneAtISO = new Date().toISOString();
  const pickStr = (v: any) => (v == null ? undefined : String(v));
  for (const [kRaw, v] of parts) {
    const k = String(kRaw).toLowerCase();
    if (!id && ['id_apar', 'aparid', 'peralatanid', 'id'].includes(k)) id = pickStr(v);
    if (!token && ['token', 'tokenqr', 'token_qr', 'qr', 'qr_token'].includes(k)) token = pickStr(v);
    if (!badge && ['badge', 'badgenumber', 'badge_petugas', 'badgepetugas'].includes(k)) badge = pickStr(v);
    if (['tanggal_pemeriksaan', 'tanggal', 'doneat', 'localdoneat'].includes(k) && v) {
      try { const d = new Date(String(v)); if (!isNaN(d.getTime())) doneAtISO = d.toISOString(); } catch {}
    }
  }
  return { id, token, badge, doneAtISO };
}
async function markAparPending(parts: Array<[string, any]>) {
  const { id, token, badge, doneAtISO } = extractFromBodyParts(parts);
  const k = keyFor(id, token); if (!k) return;
  const map = await readPendingMap();
  map[k] = { id, token, badge, localDoneAt: doneAtISO, queuedAt: Date.now() };
  await writePendingMap(map);
  log('markAparPending', k);
}
async function clearAparPending(parts: Array<[string, any]>) {
  const { id, token } = extractFromBodyParts(parts);
  const k = keyFor(id, token); if (!k) return;
  const map = await readPendingMap();
  if (map[k]) {
    delete map[k];
    await writePendingMap(map);
    log('clearAparPending', k);
  }
}

// ===== Offline response =====
function offlineResponse(
  reason: 'network' | 'server-5xx' = 'network'
): Response & { offline?: boolean; reason?: string } {
  return new Response(JSON.stringify({ offline: true, reason }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  }) as Response & { offline?: boolean; reason?: string };
}

// ===== safeFetchOffline =====
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
      return res as any;
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
    const headers = normalizeHeaders(options.headers);
    await enqueueRequest({ method, pathOrUrl, bodyParts: parts, headers });
    if (String(pathOrUrl).includes('/api/perawatan/submit')) {
      await markAparPending(parts);
    }
    return offlineResponse(reason);
  };

  try {
    const res = await fetch(url, options);
    console.log(`[Debug][safeFetchOffline][${method}] status`, res.status);

    if (res.status >= 500 || res.status === 429 || res.status === 503) {
      warn(`${method} got ${res.status} → enqueue for retry`);
      return await enqueueFromOptions('server-5xx');
    }

    // ✅ ONLINE SUCCESS: bila ini submit perawatan → bersihkan pending & emit refresh
    if (res.ok && String(pathOrUrl).includes('/api/perawatan/submit')) {
      const parts = extractBodyParts();
      await clearAparPending(parts);
      emit('apar:refresh', {}); // biar list revalidate segera
    }

    return res as any;
  } catch (err) {
    console.warn(`[Debug][safeFetchOffline][${method}] network error, enqueue`, err);
    return await enqueueFromOptions('network');
  }
}

// ===== flushQueue (emit refresh juga saat sukses) =====
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
    if (!req.pathOrUrl || !['POST', 'PUT', 'DELETE'].includes(method)) {
      console.log('[Debug][flushQueue] drop invalid item', req);
      continue;
    }
    const url = toUrl(req.pathOrUrl);
    const formData = new FormData();

    if (Array.isArray(req.bodyParts)) {
      for (const [k, v] of req.bodyParts) {
        const preview =
          typeof v === 'string' ? (v.length > 60 ? v.slice(0, 60) + '…' : v)
          : isFilePart(v) ? `{file uri=${v?.uri} type=${v?.type} name=${v?.name}}`
          : JSON.stringify(v).slice(0, 60) + '…';
        console.log('[Debug][flushQueue] append', k, '→', preview);

        if (isFilePart(v)) {
          const file: any = { uri: v.uri, name: v.name || 'upload.jpg', type: v.type || 'application/octet-stream' };
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
      const res = await fetch(url, { method, body: formData, headers: { Accept: 'application/json', ...(req.headers || {}) } });
      console.log('[Debug][flushQueue] response', res.status);

      if (!res.ok || res.status === 429 || res.status === 503) {
        const text = await res.text().catch(() => '');
        console.warn('[Debug][flushQueue] server response not ok:', res.status, text);
        remaining.push({ ...req, attempts: (req.attempts ?? 0) + 1 });
      } else {
        console.log('[Debug][flushQueue] success', url);
        if (String(req.pathOrUrl).includes('/api/perawatan/submit')) {
          await clearAparPending(req.bodyParts || []);
          emit('apar:refresh', {}); // 🔔 minta list reload cache
        }
      }
    } catch (err) {
      console.error('[Debug][flushQueue] network error', String(err), '→', url);
      remaining.push({ ...req, attempts: (req.attempts ?? 0) + 1 });
    }
  }

  console.log('[Debug][flushQueue] remaining =', remaining.length);
  await writeQueue(remaining);
  return remaining.length;
}

// (Opsional) debug
export async function __debugGetPendingAparMap(): Promise<Record<string, PendingApar>> {
  const raw = (await AsyncStorage.getItem(PENDING_MAP_KEY)) || '{}';
  try { return JSON.parse(raw); } catch { return {}; }
}
