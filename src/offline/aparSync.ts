// src/offline/aparSync.ts
import { DETAIL_ID_PREFIX, DETAIL_TOKEN_PREFIX, touchDetailKey } from '@/src/cacheTTL';
import { baseUrl } from '@/src/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* =========================
   Helpers: token & parsing
   ========================= */
const toToken = (s: string) => String(s || '').trim().toLowerCase();
const isGuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || '').trim());
const looksNumeric = (s: string) => /^\d+$/.test(String(s || '').trim());

/** Menerima apa pun dari QR: GUID, ID, atau JSON string */
export function parseTokenOrId(raw: string | any): { token?: string; id?: number } {
  try {
    if (typeof raw === 'string') {
      const txt = raw.trim();
      // JSON string?
      if ((txt.startsWith('{') && txt.endsWith('}')) || (txt.startsWith('"') && txt.endsWith('"'))) {
        const j = JSON.parse(txt);
        const t = j?.id ?? j?.token ?? j?.TokenQR ?? j?.qr ?? j?.qrId;
        const id = j?.id_apar ?? j?.Id ?? j?.peralatanId;
        if (t && isGuid(String(t))) return { token: String(t) };
        if (id != null && looksNumeric(String(id))) return { id: Number(id) };
      }
      // GUID mentah
      if (isGuid(txt)) return { token: txt };
      // ID mentah
      if (looksNumeric(txt)) return { id: Number(txt) };
    } else if (raw && typeof raw === 'object') {
      const t = raw.id ?? raw.token ?? raw.TokenQR ?? raw.qr ?? raw.qrId;
      const id = raw.id_apar ?? raw.Id ?? raw.peralatanId;
      if (t && isGuid(String(t))) return { token: String(t) };
      if (id != null && looksNumeric(String(id))) return { id: Number(id) };
    }
  } catch {}
  return {};
}

/* =========================
   Types dari preload
   ========================= */
type TokenRow = {
  id_apar: number;
  token_qr: string | null;
  kode?: string;
  lokasi_nama?: string;
  jenis_nama?: string;
};

export type AparSyncOptions = {
  force?: boolean;
  concurrency?: number;
  onProgress?: (progress01: number) => void;
};

const LAST_SYNC_AT = (badge: string) => `OFFLINE_SYNC_AT_${badge}`;

/* =========================
   Util HTTP aman
   ========================= */
async function tryGetJson<T = any>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* =========================
   Persist cache
   ========================= */
async function persistDetailInternal(json: any, token?: string | null) {
  if (!json || typeof json !== 'object') return;

  const idVal =
    json?.id_apar ?? json?.Id ?? json?.id ??
    (typeof json?.data === 'object' ? (json.data.id_apar ?? json.data.Id ?? json.data.id) : 0);
  const id = String(idVal || '');

  const pairs: [string, string][] = [];
  if (id) pairs.push([`${DETAIL_ID_PREFIX}${id}`, JSON.stringify(json)]);

  if (token) {
    const tokOrig = String(token);
    const tokNorm = toToken(tokOrig);
    // simpan 2 key token agar backward compatible
    pairs.push([`${DETAIL_TOKEN_PREFIX}${tokOrig}`, JSON.stringify(json)]);
    if (tokNorm !== tokOrig) pairs.push([`${DETAIL_TOKEN_PREFIX}${tokNorm}`, JSON.stringify(json)]);
    // mapping token→id pakai NORMAL
    if (id) pairs.push([`APAR_TOKEN_${tokNorm}`, id]);
  }

  if (pairs.length) await AsyncStorage.multiSet(pairs);

  if (id) await touchDetailKey(`${DETAIL_ID_PREFIX}${id}`);
  if (token) {
    const tokOrig = String(token);
    const tokNorm = toToken(tokOrig);
    await touchDetailKey(`${DETAIL_TOKEN_PREFIX}${tokOrig}`);
    if (tokNorm !== tokOrig) await touchDetailKey(`${DETAIL_TOKEN_PREFIX}${tokNorm}`);
  }
}

export const persistDetail = persistDetailInternal;

/* =========================
   Prefetch by id/token
   ========================= */
async function prefetchById(id: number, badge: string, retry = 0): Promise<boolean> {
  const url = `${baseUrl}/api/peralatan/with-checklist?id=${encodeURIComponent(String(id))}&badge=${encodeURIComponent(badge)}`;
  const json = await tryGetJson<any>(url);
  if (!json && retry < 1) return prefetchById(id, badge, retry + 1);
  if (!json) return false;
  await persistDetailInternal(json);
  return true;
}

async function prefetchByToken(token: string, badge: string, retry = 0): Promise<boolean> {
  const t = String(token);
  const url = `${baseUrl}/api/perawatan/with-checklist/by-token-safe?token=${encodeURIComponent(t)}&badge=${encodeURIComponent(badge)}`;
  const json = await tryGetJson<any>(url);
  if (!json && retry < 1) return prefetchByToken(t, badge, retry + 1);
  if (!json) return false;
  await persistDetailInternal(json, t);
  return true;
}

/* =========================
   Full sync untuk badge
   ========================= */
export async function syncAparOffline(badgeNumber: string, opts: AparSyncOptions = {}) {
  const badge = (badgeNumber || '').trim();
  if (!badge) return;

  const { force = false, concurrency = 4, onProgress } = opts;

  if (!force) {
    const last = Number(await AsyncStorage.getItem(LAST_SYNC_AT(badge))) || 0;
    const oneDay = 24 * 60 * 60 * 1000;
    if (Date.now() - last < oneDay) return;
  }

  const listUrl = `${baseUrl}/api/peralatan/tokens-by-badge/${encodeURIComponent(badge)}`;
  const rows = (await tryGetJson<TokenRow[]>(listUrl)) || [];
  if (!rows.length) {
    await AsyncStorage.setItem(LAST_SYNC_AT(badge), String(Date.now()));
    return;
  }

  // simpan mapping token→id lebih awal (pakai NORMAL)
  for (const r of rows) {
    const id = Number(r.id_apar);
    const tok = r.token_qr ? toToken(String(r.token_qr)) : null;
    if (id && tok) await AsyncStorage.setItem(`APAR_TOKEN_${tok}`, String(id));
  }

  let done = 0;
  const total = rows.length;
  const tick = () => onProgress?.(++done / total);

  const queue = [...rows];
  const workers: Promise<void>[] = [];

  for (let w = 0; w < Math.max(1, concurrency); w++) {
    workers.push(
      (async () => {
        while (queue.length) {
          const row = queue.shift()!;
          const id = Number(row.id_apar);
          const tokOrig = row.token_qr ? String(row.token_qr) : null;

          let ok = false;
          if (id) ok = await prefetchById(id, badge);
          if (!ok && tokOrig) ok = await prefetchByToken(tokOrig, badge);

          tick();
        }
      })()
    );
  }

  await Promise.all(workers);
  await AsyncStorage.setItem(LAST_SYNC_AT(badge), String(Date.now()));
}

/* =========================
   Offline-first getters
   ========================= */
export async function getCachedAparDetail(tokenOrId: string): Promise<any | null> {
  // Numeric id?
  if (looksNumeric(tokenOrId)) {
    const v = await AsyncStorage.getItem(`${DETAIL_ID_PREFIX}${tokenOrId}`);
    if (v) { await touchDetailKey(`${DETAIL_ID_PREFIX}${tokenOrId}`); return JSON.parse(v); }
    return null;
  }

  // token case: cek NORMAL lalu ORIGINAL
  const tokNorm = toToken(tokenOrId);
  const v1 = await AsyncStorage.getItem(`${DETAIL_TOKEN_PREFIX}${tokNorm}`);
  if (v1) { await touchDetailKey(`${DETAIL_TOKEN_PREFIX}${tokNorm}`); return JSON.parse(v1); }

  const v2 = await AsyncStorage.getItem(`${DETAIL_TOKEN_PREFIX}${tokenOrId}`);
  if (v2) { await touchDetailKey(`${DETAIL_TOKEN_PREFIX}${tokenOrId}`); return JSON.parse(v2); }

  // coba lewat mapping token→id
  const idMapped = await AsyncStorage.getItem(`APAR_TOKEN_${tokNorm}`);
  if (idMapped) {
    const v3 = await AsyncStorage.getItem(`${DETAIL_ID_PREFIX}${idMapped}`);
    if (v3) { await touchDetailKey(`${DETAIL_ID_PREFIX}${idMapped}`); return JSON.parse(v3); }
  }
  return null;
}

export async function fetchAndCacheAparDetail(tokenOrId: string, badge: string): Promise<any | null> {
  // jika id
  if (looksNumeric(tokenOrId)) {
    try {
      const url = `${baseUrl}/api/peralatan/with-checklist?id=${encodeURIComponent(tokenOrId)}&badge=${encodeURIComponent(badge)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const json = await res.json();
      await persistDetailInternal(json);
      return json;
    } catch { return null; }
  }

  // token
  try {
    const url = `${baseUrl}/api/perawatan/with-checklist/by-token-safe?token=${encodeURIComponent(tokenOrId)}&badge=${encodeURIComponent(badge)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    await persistDetailInternal(json, tokenOrId);
    return json;
  } catch { return null; }
}

export async function getAparDetailOfflineFirst(raw: string, badge: string) {
  const { token, id } = parseTokenOrId(raw);
  const key = token ?? (id != null ? String(id) : String(raw));

  const cached = await getCachedAparDetail(key);
  if (cached) return { data: cached, from: 'cache' as const };

  const online = await fetchAndCacheAparDetail(key, badge);
  if (online) return { data: online, from: 'network' as const };

  return { data: null, from: 'none' as const };
}

/* =========================
   Auto-route helpers
   ========================= */
export function shouldAutoGoToHistory(detail: any): boolean {
  if (!detail) return false;
  const d = detail?.data && typeof detail.data === 'object' ? detail.data : detail;
  const last = d?.last_inspection_date ?? null;
  const canInspect = Number(d?.canInspect ?? 1);
  return !!last && canInspect === 0;
}

export function extractAparIdentity(detail: any): { id?: number; no?: string } {
  const d = detail?.data && typeof detail.data === 'object' ? detail.data : detail;
  const idRaw =
    d?.id_apar ?? d?.Id ?? d?.id ?? (typeof d?.peralatan === 'object' ? d?.peralatan?.Id : undefined);
  const noRaw =
    d?.no_apar ?? d?.Kode ?? d?.AparKode ?? (typeof d?.peralatan === 'object' ? d?.peralatan?.Kode : undefined);
  const id = Number(idRaw);
  return { id: Number.isFinite(id) ? id : undefined, no: noRaw != null ? String(noRaw) : undefined };
}

/* =========================
   Ensure ready from scan
   ========================= */
export async function ensureAparOfflineReady(raw: string, badgeNumber: string) {
  const { token, id } = parseTokenOrId(raw);
  const badge = (badgeNumber || '').trim();
  if (!badge) return false;

  // Sudah ada cache?
  const existing = await getCachedAparDetail(token ?? (id != null ? String(id) : String(raw)));
  if (existing) return true;

  // Online fetch (bila ada koneksi)
  if (id != null) return prefetchById(id, badge);
  if (token) return prefetchByToken(token, badge);

  // fallback terakhir (tidak ideal, tapi aman)
  return false;
}
