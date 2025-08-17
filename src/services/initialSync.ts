// src/services/initialSync.ts
import {
    DETAIL_ID_PREFIX,
    DETAIL_TOKEN_PREFIX,
    LIST_KEY,
    purgeStaleDetails,
    touchDetailKey,
} from '@/src/cacheTTL';
import { baseUrl } from '@/src/config';
import { safeFetchOffline } from '@/utils/ManajemenOffline';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SyncProgress = {
  total: number;
  done: number;
  phase: 'prepare' | 'list' | 'details' | 'finalize';
  message?: string;
};

export type AparItem = {
  id_apar?: number;
  token_qr?: string;
  Id?: number;
  id?: number;
  TokenQR?: string;
  token?: string;
};

const dbg = (...a: any[]) => { if (__DEV__) console.log('[InitialSync]', ...a); };

async function getJson(url: string) {
  const res: any = await safeFetchOffline(url, { method: 'GET' });
  if ((res as any)?.offline) throw new Error('offline');
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`GET ${url} -> ${res.status} ${t?.slice(0, 180)}`);
  }
  return res.json();
}

export async function fetchProfileByBadge(badge: string) {
  return getJson(`${baseUrl}/api/petugas/profile/${encodeURIComponent(badge)}`);
}

async function fetchAparListForBadge(badge: string): Promise<AparItem[]> {
  const data = await getJson(`${baseUrl}/api/peralatan?badge=${encodeURIComponent(badge)}`);
  return Array.isArray((data as any)?.items) ? (data as any).items : (Array.isArray(data) ? data : []);
}

/** Optional helper: peta id→token jika list tidak membawa token. Abaikan jika 404. */
async function fetchTokenMapForBadge(badge: string): Promise<Record<number, string>> {
  try {
    const rows = await getJson(`${baseUrl}/api/peralatan/tokens-by-badge/${encodeURIComponent(badge)}`);
    const map: Record<number, string> = {};
    for (const r of (rows as any[] || [])) {
      const id = r.id_apar ?? r.Id ?? r.id;
      const tk = r.token_qr ?? r.TokenQR ?? r.token;
      if (id != null && tk) map[id] = tk;
    }
    return map;
  } catch {
    return {};
  }
}

/** Ambil detail prioritas: by-token-with-badge → by-token → peralatan with-checklist by id → detail/id */
async function fetchAparDetail(item: AparItem, badge: string) {
  const id = item.id_apar ?? item.Id ?? item.id;
  const token = item.token_qr ?? item.TokenQR ?? item.token;

  const tries: Array<() => Promise<any>> = [];

  // 1) ✅ yang terbukti sukses di log kamu
  if (token) tries.push(() => getJson(
    `${baseUrl}/api/perawatan/with-checklist/by-token?token=${encodeURIComponent(token)}&badge=${encodeURIComponent(badge)}`
  ));

  // 2) Fallback token lama (kalau ternyata tersedia di BE tertentu)
  if (token) tries.push(() => getJson(`${baseUrl}/api/perawatan/with-checklist/${encodeURIComponent(token)}`));

  // 3) BE kamu minta id di /api/peralatan/with-checklist → coba pakai id
  if (id != null) tries.push(() => getJson(`${baseUrl}/api/peralatan/with-checklist?id=${id}`));

  // 4) Fallback lain by id (kalau ada)
  if (id != null) tries.push(() => getJson(`${baseUrl}/api/peralatan/details/${id}`));
  if (id != null) tries.push(() => getJson(`${baseUrl}/api/peralatan/${id}`));

  let lastErr: any;
  for (const fn of tries) {
    try { return await fn(); }
    catch (e) { lastErr = e; }
  }
  throw lastErr ?? new Error('No detail endpoint available');
}

export async function runInitialSync(
  badge: string,
  onProgress?: (p: SyncProgress) => void
): Promise<{ total: number; success: number; failed: number }> {
  const emit = (p: Partial<SyncProgress>) =>
    onProgress?.({ total: 0, done: 0, phase: 'prepare', ...p } as SyncProgress);

  emit({ phase: 'prepare', message: 'Menyiapkan sinkronisasi…' });

  try { await fetchProfileByBadge(badge); } catch {}

  // 1) LIST
  emit({ phase: 'list', message: 'Mengunduh daftar peralatan…' });
  const list = await fetchAparListForBadge(badge);
  await AsyncStorage.setItem(LIST_KEY, JSON.stringify(list ?? []));

  // 1b) Token map (jika list tidak mengandung token)
  const needTokenMap = !list.some(i => (i as any).token_qr || (i as any).TokenQR || (i as any).token);
  const tokenMap = needTokenMap ? await fetchTokenMapForBadge(badge) : {};

  // 2) DETAIL
  const total = list.length;
  let done = 0, success = 0, failed = 0;
  emit({ phase: 'details', total, done, message: total ? 'Mengunduh detail & checklist…' : 'Tidak ada peralatan untuk disinkronkan.' });

  for (const it of list) {
    const id = it.id_apar ?? it.Id ?? it.id;
    const token = (it.token_qr ?? it.TokenQR ?? it.token) || (id != null ? tokenMap[id] : undefined);

    try {
      const detail = await fetchAparDetail(
        { ...it, token_qr: token, id_apar: id },
        badge
      );

      // simpan pakai token bila ada; fallback id
      if (token) {
        const key = `${DETAIL_TOKEN_PREFIX}${token}`;
        await AsyncStorage.setItem(key, JSON.stringify(detail));
        await touchDetailKey(key);
      } else if (id != null) {
        const key = `${DETAIL_ID_PREFIX}${id}`;
        await AsyncStorage.setItem(key, JSON.stringify(detail));
        await touchDetailKey(key);
      } else {
        throw new Error('Missing id/token on list item');
      }

      success++;
    } catch (e: any) {
      failed++;
      dbg('detail failed for', { id, token, err: String(e?.message || e) });
    } finally {
      done++;
      emit({ phase: 'details', total, done, message: `Menyimpan ${done}/${total}…` });
    }
  }

  // 3) Finalize
  emit({ phase: 'finalize', total, done, message: 'Membersihkan cache lama…' });
  try { await purgeStaleDetails(); } catch {}

  emit({ phase: 'finalize', total, done, message: 'Sinkronisasi selesai.' });
  dbg('result', { total, success, failed });
  return { total, success, failed };
}
