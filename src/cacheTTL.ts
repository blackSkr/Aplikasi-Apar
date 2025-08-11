// src/utils/cacheTTL.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DETAIL_ID_PREFIX = 'APAR_DETAIL_id=';
export const DETAIL_TOKEN_PREFIX = 'APAR_DETAIL_token=';
export const LIST_KEY = 'APAR_CACHE';

const INDEX_KEY = 'APAR_DETAIL_INDEX';
export const DEFAULT_TTL_DAYS = 30;

type IndexMap = Record<string, number>; // key -> timestamp (ms)

async function readIndex(): Promise<IndexMap> {
  try {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

async function writeIndex(map: IndexMap) {
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(map));
}

export async function touchDetailKey(key: string) {
  const idx = await readIndex();
  idx[key] = Date.now();
  await writeIndex(idx);
}

export async function purgeStaleDetails(ttlDays = DEFAULT_TTL_DAYS): Promise<number> {
  const idx = await readIndex();
  const now = Date.now();
  const ttlMs = ttlDays * 24 * 60 * 60 * 1000;

  const keys = await AsyncStorage.getAllKeys();
  const detailKeys = keys.filter(k =>
    k.startsWith(DETAIL_ID_PREFIX) || k.startsWith(DETAIL_TOKEN_PREFIX)
  );

  const toDelete: string[] = [];
  for (const k of detailKeys) {
    const last = idx[k] ?? 0;
    if (now - last > ttlMs) toDelete.push(k);
  }

  if (toDelete.length) {
    await AsyncStorage.multiRemove(toDelete);
    for (const k of toDelete) delete idx[k];
    await writeIndex(idx);
  }
  return toDelete.length;
}
