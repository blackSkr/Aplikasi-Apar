// src/offline/aparSync.ts
import { DETAIL_ID_PREFIX, DETAIL_TOKEN_PREFIX, touchDetailKey } from '@/src/cacheTTL';
import { baseUrl } from '@/src/config';
import AsyncStorage from '@react-native-async-storage/async-storage';

type TokenRow = {
  id_apar: number;
  token_qr: string;
  kode?: string;
  lokasi_nama?: string;
  jenis_nama?: string;
};

export type AparSyncOptions = {
  /** paksa sync walau sudah dilakukan hari ini */
  force?: boolean;
  /** jumlah request paralel (default 4) */
  concurrency?: number;
  /** callback progres (0..1) */
  onProgress?: (progress01: number) => void;
};

const LAST_SYNC_AT = (badge: string) => `OFFLINE_SYNC_AT_${badge}`;

/** GET util aman (abaikan error, balikan null kalau gagal) */
async function tryGetJson<T = any>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Simpan detail + mapping dengan key standar + sentuh TTL index */
async function persistDetail(json: any, token?: string | null) {
  if (!json || typeof json !== 'object') return;
  const idVal =
    json?.id_apar ?? json?.Id ?? json?.id ??
    (typeof json?.data === 'object' ? (json.data.id_apar ?? json.data.Id ?? json.data.id) : 0);
  const id = String(idVal || '');

  const pairs: [string, string][] = [];
  if (id) pairs.push([`${DETAIL_ID_PREFIX}${id}`, JSON.stringify(json)]);
  if (token) {
    pairs.push([`${DETAIL_TOKEN_PREFIX}${token}`, JSON.stringify(json)]);
    pairs.push([`APAR_TOKEN_${token}`, id]);
  }
  if (pairs.length) await AsyncStorage.multiSet(pairs);

  if (id) await touchDetailKey(`${DETAIL_ID_PREFIX}${id}`);
  if (token) await touchDetailKey(`${DETAIL_TOKEN_PREFIX}${token}`);
}

/**
 * Prefetch detail APAR (dari BE mobile) berdasarkan ID.
 * Endpoint tetap: /api/peralatan/with-checklist?id=...&badge=...
 */
async function prefetchById(id: number, badge: string): Promise<boolean> {
  const url = `${baseUrl}/api/peralatan/with-checklist?id=${encodeURIComponent(
    String(id)
  )}&badge=${encodeURIComponent(badge)}`;
  const json = await tryGetJson<any>(url);
  if (!json) return false;
  await persistDetail(json);
  return true;
}

/**
 * Prefetch detail APAR berdasarkan TOKEN QR.
 * Endpoint tetap: /api/perawatan/with-checklist/by-token?token=...&badge=...
 */
async function prefetchByToken(token: string, badge: string): Promise<boolean> {
  const url = `${baseUrl}/api/perawatan/with-checklist/by-token?token=${encodeURIComponent(
    token
  )}&badge=${encodeURIComponent(badge)}`;
  const json = await tryGetJson<any>(url);
  if (!json) return false;
  await persistDetail(json, token);
  return true;
}

/**
 * Sinkronisasi offline:
 * - Ambil daftar {id_apar, token_qr} untuk petugas
 * - Prefetch detail setiap APAR (pakai ID, fallback TOKEN bila perlu)
 * - Simpan mapping APAR_TOKEN_<token> → <id>
 */
export async function syncAparOffline(badgeNumber: string, opts: AparSyncOptions = {}) {
  const badge = (badgeNumber || '').trim();
  if (!badge) return;

  const { force = false, concurrency = 4, onProgress } = opts;

  // Hindari sync berulang-ulang dalam 1 hari (kecuali force)
  if (!force) {
    const last = Number(await AsyncStorage.getItem(LAST_SYNC_AT(badge))) || 0;
    const oneDay = 24 * 60 * 60 * 1000;
    if (Date.now() - last < oneDay) return;
  }

  // 1) Ambil daftar token/id per petugas
  const listUrl = `${baseUrl}/api/peralatan/tokens-by-badge/${encodeURIComponent(badge)}`;
  const rows = (await tryGetJson<TokenRow[]>(listUrl)) || [];
  if (!rows.length) {
    await AsyncStorage.setItem(LAST_SYNC_AT(badge), String(Date.now()));
    return;
  }

  // 2) Prefetch dengan concurrency sederhana
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
          const token = String(row.token_qr || '').trim();

          // simpan mapping token→id dulu (agar ScanQr bisa pakai fallback)
          if (token && id) {
            await AsyncStorage.setItem(`APAR_TOKEN_${token}`, String(id));
          }

          // prefetch detail
          let ok = false;
          if (id) ok = await prefetchById(id, badge);
          if (!ok && token) ok = await prefetchByToken(token, badge);

          tick();
        }
      })()
    );
  }

  await Promise.all(workers);
  await AsyncStorage.setItem(LAST_SYNC_AT(badge), String(Date.now()));
}

/**
 * Pastikan 1 token siap offline:
 * - Kalau belum ada cache & sedang online, ambil dari server lalu tulis cache.
 * - Dipakai saat user scan token baru yang belum pernah dibuka.
 */
export async function ensureAparOfflineReady(tokenOrId: string, badgeNumber: string) {
  const badge = (badgeNumber || '').trim();
  if (!badge) return false;

  // Cek apakah token atau id
  const looksLikeId = /^\d+$/.test(tokenOrId);
  if (looksLikeId) {
    // cek cache ID
    const v = await AsyncStorage.getItem(`${DETAIL_ID_PREFIX}${tokenOrId}`);
    if (v) return true;
    return prefetchById(Number(tokenOrId), badge);
  }

  // token case
  const token = tokenOrId;
  const kToken = `${DETAIL_TOKEN_PREFIX}${token}`;
  const vToken = await AsyncStorage.getItem(kToken);
  if (vToken) return true;

  // ada mapping token→id?
  const mappedId = await AsyncStorage.getItem(`APAR_TOKEN_${token}`);
  if (mappedId) {
    const vId = await AsyncStorage.getItem(`${DETAIL_ID_PREFIX}${mappedId}`);
    if (vId) return true;
    return prefetchById(Number(mappedId), badge);
  }

  // prefetch via token
  return prefetchByToken(token, badge);
}
