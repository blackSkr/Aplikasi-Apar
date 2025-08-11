// hooks/usePreloadCache.ts
import { useBadge } from '@/context/BadgeContext';
import { baseUrl } from '@/src/config';
import { safeFetchOffline } from '@/utils/ManajemenOffline';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';

type PreloadStatus = 'idle' | 'running' | 'done' | 'skipped' | 'error';

export type PreloadSummary = {
  startedAt?: string;
  finishedAt?: string;
  listCount: number;
  detailRequested: number;
  detailSaved: number;
  detailFailed: number;
  failedIds: Array<string | number>;
  note?: string;
};

const PRELOAD_FLAG_PREFIX = 'PRELOAD_DONE_FOR_';
const CONCURRENCY = 4;

// bantu ambil token di berbagai kemungkinan nama field dari list
function pickToken(obj: any): string | null {
  const cand =
    obj?.token_qr ??
    obj?.tokenQR ??
    obj?.TokenQR ??
    obj?.token ??
    obj?.Token ??
    null;
  if (cand == null) return null;
  const s = String(cand).trim();
  return s ? s : null;
}

export function usePreloadCache(options?: { force?: boolean; showToast?: boolean }) {
  const { badgeNumber } = useBadge();
  const [status, setStatus] = useState<PreloadStatus>('idle');
  const [summary, setSummary] = useState<PreloadSummary>({
    listCount: 0,
    detailRequested: 0,
    detailSaved: 0,
    detailFailed: 0,
    failedIds: [],
  });
  const runningRef = useRef(false);

  useEffect(() => {
    (async () => {
      if (!badgeNumber) return;
      if (runningRef.current) return;

      const flagKey = `${PRELOAD_FLAG_PREFIX}${badgeNumber}`;
      const already = await AsyncStorage.getItem(flagKey);
      if (already && !options?.force) {
        setStatus('skipped');
        setSummary(s => ({
          ...s,
          note: 'skip: sudah pernah preload',
          finishedAt: new Date().toISOString(),
        }));
        if (__DEV__) console.log('[Preload] skipped (already done)');
        return;
      }

      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        setStatus('skipped');
        setSummary(s => ({
          ...s,
          note: 'skip: offline',
          finishedAt: new Date().toISOString(),
        }));
        if (__DEV__) console.log('[Preload] skipped (offline)');
        return;
      }

      runningRef.current = true;
      setStatus('running');
      setSummary({
        startedAt: new Date().toISOString(),
        finishedAt: undefined,
        listCount: 0,
        detailRequested: 0,
        detailSaved: 0,
        detailFailed: 0,
        failedIds: [],
        note: undefined,
      });

      try {
        // 1) ambil list dan cache-kan
        if (__DEV__) console.log('[Preload] fetching list…', `${baseUrl}/api/peralatan?badge=${badgeNumber}`);
        const listRes = await safeFetchOffline(
          `${baseUrl}/api/peralatan?badge=${encodeURIComponent(badgeNumber)}`,
          { method: 'GET' }
        );
        const listJson = await listRes.json();

        if ((listJson as any)?.offline) {
          setStatus('skipped');
          setSummary(s => ({
            ...s,
            note: 'skip: safeFetchOffline → offline',
            finishedAt: new Date().toISOString(),
          }));
          runningRef.current = false;
          return;
        }
        if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`);

        const listData = (listJson as any[]) ?? [];
        await AsyncStorage.setItem('APAR_CACHE', JSON.stringify(listData));
        if (__DEV__) console.log('[Preload] list saved → count:', listData.length);

        // 2) bentuk antrian: token dulu, kalau nggak ada pakai id_apar
        type KeyParam = { kind: 'token' | 'id'; value: string };
        const items: KeyParam[] = listData
          .map(d => {
            const token = pickToken(d);
            if (token) return { kind: 'token' as const, value: token };
            const id = d?.id_apar ?? d?.Id ?? d?.ID ?? null;
            if (id == null) return null;
            return { kind: 'id' as const, value: String(id) };
          })
          .filter(Boolean) as KeyParam[];

        const queue = [...items];
        setSummary(s => ({
          ...s,
          listCount: listData.length,
          detailRequested: items.length,
        }));

        // 3) worker paralel (batasi CONCURRENCY)
        const worker = async () => {
          while (queue.length) {
            const item = queue.shift();
            if (!item) break;

            // stop jika offline di tengah jalan
            const netNow = await NetInfo.fetch();
            if (!netNow.isConnected) {
              if (__DEV__) console.log('[Preload] offline mid-run, stop workers');
              queue.length = 0;
              break;
            }

            // PILIH endpoint sesuai BE TANPA DIUBAH:
            // token → /api/perawatan/with-checklist/by-token
            // id    → /api/peralatan/with-checklist
            const keyParam =
              item.kind === 'token'
                ? `token=${encodeURIComponent(item.value)}`
                : `id=${encodeURIComponent(item.value)}`;

            const url =
              item.kind === 'token'
                ? `${baseUrl}/api/perawatan/with-checklist/by-token?${keyParam}&badge=${encodeURIComponent(badgeNumber)}`
                : `${baseUrl}/api/peralatan/with-checklist?${keyParam}&badge=${encodeURIComponent(badgeNumber)}`;

            try {
              if (__DEV__) console.log('[Preload] detail →', url);
              const res = await safeFetchOffline(url, { method: 'GET' });
              const json = await res.json();

              if ((json as any)?.offline) {
                if (__DEV__) console.log('[Preload] detail → offline flag, stop');
                queue.length = 0;
                break;
              }

              const cacheKey = `APAR_DETAIL_${keyParam}`;
              await AsyncStorage.setItem(cacheKey, JSON.stringify(json));
              setSummary(s => ({ ...s, detailSaved: s.detailSaved + 1 }));
            } catch (e) {
              if (__DEV__) console.warn('[Preload] gagal detail', item, e);
              setSummary(s => ({
                ...s,
                detailFailed: s.detailFailed + 1,
                failedIds: [...s.failedIds, item.value],
              }));
            }
          }
        };

        await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

        await AsyncStorage.setItem(flagKey, new Date().toISOString());
        setStatus('done');
        setSummary(s => ({ ...s, finishedAt: new Date().toISOString() }));

        if (options?.showToast) {
          Alert.alert(
            'Sinkronisasi Selesai',
            `List: ${listData.length}\nDetail diminta: ${items.length}\nSebagian besar detail telah tersimpan untuk offline.`
          );
        }
      } catch (e: any) {
        console.error('[Preload] error', e);
        setStatus('error');
        setSummary(s => ({
          ...s,
          note: e?.message || 'error',
          finishedAt: new Date().toISOString(),
        }));
        if (options?.showToast) {
          Alert.alert('Gagal Sinkronisasi', e?.message || 'Terjadi kesalahan.');
        }
      } finally {
        runningRef.current = false;
      }
    })();
  }, [badgeNumber, options?.force, options?.showToast]);

  return { status, summary };
}
