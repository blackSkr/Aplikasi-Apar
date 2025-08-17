import { useBadge } from '@/context/BadgeContext';
import {
  DETAIL_ID_PREFIX,
  DETAIL_TOKEN_PREFIX,
  purgeStaleDetails,
  touchDetailKey,
} from '@/src/cacheTTL';
import { baseUrl } from '@/src/config';
import { safeFetchOffline } from '@/utils/ManajemenOffline';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

export type MaintenanceStatus = 'Belum' | 'Sudah';
export type OfflineReason = 'network' | 'server-5xx' | null;

export interface AparRaw {
  id_apar: string;
  no_apar?: string;
  lokasi_apar?: string;
  jenis_apar?: string;
  statusMaintenance?: MaintenanceStatus;
  interval_maintenance?: number;
  nextDueDate?: string;
  last_inspection?: string;
  tanggal_selesai?: string;
  badge_petugas?: string;
}
export interface APAR extends AparRaw {
  daysRemaining: number;
}

const CONCURRENCY = 3;
const PRELOAD_FLAG_PREFIX = 'PRELOAD_FULL_FOR_';

function pickArrayAnywhere(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;

  // umum: { items: [...] } / { data: [...] }
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.data)) return json.data;

  // kadang: { result: { items: [...] } } / { payload: { data: [...] } }
  if (Array.isArray(json.result?.items)) return json.result.items;
  if (Array.isArray(json.result?.data)) return json.result.data;
  if (Array.isArray(json.payload?.items)) return json.payload.items;
  if (Array.isArray(json.payload?.data)) return json.payload.data;

  // fallback: cari properti array pertama
  for (const k of Object.keys(json)) {
    if (Array.isArray((json as any)[k])) return (json as any)[k];
  }
  return [];
}

function mapRecord(d: any): AparRaw {
  return {
    id_apar: String(d?.id_apar ?? d?.Id ?? d?.ID ?? d?.id ?? ''),
    no_apar: d?.no_apar ?? d?.NoApar ?? d?.noApar ?? d?.No_APAR ?? d?.no,
    lokasi_apar:
      d?.lokasi_apar ??
      d?.Lokasi ??
      d?.lokasi ??
      d?.NamaLokasi ??
      d?.nama_lokasi ??
      d?.lokasiNama,
    jenis_apar: d?.jenis_apar ?? d?.Jenis ?? d?.jenis ?? d?.JenisApar,
    statusMaintenance: d?.last_inspection || d?.tanggal_selesai ? 'Sudah' : 'Belum',
    interval_maintenance: (d?.kuota_per_bulan ?? d?.IntervalHari ?? 1) * 30,
    nextDueDate: d?.next_due_date ?? d?.NextDueDate ?? d?.nextDueDate ?? '',
    last_inspection: d?.last_inspection ?? d?.LastInspection ?? d?.tanggal_selesai ?? undefined,
    tanggal_selesai: d?.tanggal_selesai ?? d?.last_inspection ?? undefined,
    badge_petugas: d?.badge_petugas ?? d?.BadgePetugas ?? '',
  };
}

export function useAparList() {
  const { badgeNumber, clearBadgeNumber } = useBadge();

  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<AparRaw[]>([]);
  const [offlineReason, setOfflineReason] = useState<OfflineReason>(null);

  const preloadingRef = useRef(false);

  useEffect(() => {
    setOfflineReason(null);
  }, [badgeNumber]);

  useEffect(() => {
    (async () => {
      try {
        const removed = await purgeStaleDetails();
        if (__DEV__ && removed) console.log('[TTL] removed old detail:', removed);
      } catch (e) {
        if (__DEV__) console.warn('[TTL] purge error', e);
      }
    })();
  }, []);

  // ===== Helpers =====
  const saveDetailToCache = async (detail: any, id: string, token?: string | null) => {
    if (!detail || typeof detail !== 'object') return;
    if (detail.id_apar == null) detail.id_apar = Number(id);

    const idKey = `${DETAIL_ID_PREFIX}${encodeURIComponent(id)}`;
    await AsyncStorage.setItem(idKey, JSON.stringify(detail));
    await touchDetailKey(idKey);

    if (token) {
      const tkKey = `${DETAIL_TOKEN_PREFIX}${encodeURIComponent(token)}`;
      await AsyncStorage.setItem(tkKey, JSON.stringify(detail));
      await touchDetailKey(tkKey);
      await AsyncStorage.setItem(`APAR_TOKEN_${token}`, String(id)); // mapping token→id
    }
  };

  const fetchTokenForId = async (id: string): Promise<string | null> => {
    try {
      const res = await safeFetchOffline(
        `${baseUrl}/api/peralatan/admin/${encodeURIComponent(id)}`,
        { method: 'GET' }
      );
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (!res.ok || (json && json.offline)) return null;
      const token = json?.TokenQR || json?.tokenQR || json?.token || null;
      if (!token || String(token).trim() === '') return null;
      return String(token).trim();
    } catch {
      return null;
    }
  };

  const fetchDetailByToken = async (token: string, badge: string): Promise<any | null> => {
    try {
      const url = `${baseUrl}/api/perawatan/with-checklist/by-token?token=${encodeURIComponent(
        token
      )}&badge=${encodeURIComponent(badge)}`;
      const res = await safeFetchOffline(url, { method: 'GET' });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if ((json && json.offline) || !res.ok) return null;
      if (!json || typeof json !== 'object' || json.id_apar == null) return null;
      return json;
    } catch {
      return null;
    }
  };

  const fetchDetailById = async (id: string, badge: string): Promise<any | null> => {
    try {
      const url = `${baseUrl}/api/peralatan/with-checklist?id=${encodeURIComponent(
        id
      )}&badge=${encodeURIComponent(badge)}`;
      const res = await safeFetchOffline(url, { method: 'GET' });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if ((json && json.offline) || !res.ok) return null;
      if (!json || typeof json !== 'object' || json.id_apar == null) return null;
      return json;
    } catch {
      return null;
    }
  };

  const preloadAllDetailsForBadge = useCallback(
    async (ids: string[], badge: string) => {
      if (!ids.length || !badge) return;
      if (preloadingRef.current) return;

      const flagKey = `${PRELOAD_FLAG_PREFIX}${badge}`;
      const already = await AsyncStorage.getItem(flagKey);
      if (already) return;

      preloadingRef.current = true;
      try {
        const queue = [...ids];
        const worker = async () => {
          while (queue.length) {
            const net = await NetInfo.fetch();
            if (!net.isConnected) {
              queue.length = 0;
              break;
            }

            const id = queue.shift()!;
            const token = await fetchTokenForId(id);

            let detail: any | null = null;
            if (token) detail = await fetchDetailByToken(token, badge);
            if (!detail) detail = await fetchDetailById(id, badge);

            if (detail) {
              await saveDetailToCache(detail, id, token ?? undefined);
            }
          }
        };

        await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
        await AsyncStorage.setItem(flagKey, new Date().toISOString());
      } finally {
        preloadingRef.current = false;
      }
    },
    []
  );

  // ===== Fetch List =====
  const fetchData = useCallback(async () => {
    if (!badgeNumber) {
      setRawData([]);
      setOfflineReason(null);
      return;
    }

    try {
      const url = `${baseUrl}/api/peralatan?badge=${encodeURIComponent(badgeNumber)}`;
      console.log('[useAparList] GET', url);
      const res = await safeFetchOffline(url, { method: 'GET' });

      // 5xx = server bermasalah (bukan offline)
      if (res.status >= 500) {
        setOfflineReason('server-5xx');
        const cached = await AsyncStorage.getItem('APAR_CACHE');
        if (cached) {
          setRawData(JSON.parse(cached));
          Alert.alert('Server Bermasalah', 'Menampilkan data dari cache.');
        } else {
          Alert.alert('Gagal Memuat', `Server bermasalah (HTTP ${res.status}) dan tidak ada cache lokal.`);
          setRawData([]);
        }
        return;
      }

      try {
        const json = await res.json().catch(() => null);
        console.log('[useAparList] status', res.status, 'type', typeof json, 'keys', json && Object.keys(json));

        // safeFetchOffline menandai offline (network)
        if ((json as any)?.offline) {
          const reason = (json as any)?.reason === 'server-5xx' ? 'server-5xx' : 'network';
          setOfflineReason(reason);

          const cached = await AsyncStorage.getItem('APAR_CACHE');
          if (cached) {
            setRawData(JSON.parse(cached));
            Alert.alert(reason === 'server-5xx' ? 'Server Bermasalah' : 'Offline Mode', 'Menampilkan data dari cache.');
          } else {
            Alert.alert('Gagal Memuat', 'Tidak ada cache lokal.');
            setRawData([]);
          }
          return;
        }

        setOfflineReason(null);

        if (res.status === 400 || res.status === 404) {
          Alert.alert(`Error ${res.status}`, (json as any)?.message || 'Kesalahan');
          clearBadgeNumber();
          setRawData([]);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        // ⬇️ Ambil array di mana pun dia berada
        const dataArr = pickArrayAnywhere(json);
        console.log('[useAparList] parsed items:', dataArr.length);

        const mapped: AparRaw[] = dataArr.map(mapRecord).filter(r => r.id_apar !== '');

        setRawData(mapped);
        await AsyncStorage.setItem('APAR_CACHE', JSON.stringify(mapped));

        // Preload detail agar scan/akses offline tetap jalan
        const ids = dataArr
          .map((d: any) => d?.id_apar ?? d?.Id ?? d?.id)
          .filter((v: any) => v != null)
          .map((v: any) => String(v));
        preloadAllDetailsForBadge(ids, badgeNumber).catch(() => {});
      } catch (parseErr) {
        console.warn('[useAparList] parse error', parseErr);
        const cached = await AsyncStorage.getItem('APAR_CACHE');
        if (cached) {
          setRawData(JSON.parse(cached));
          Alert.alert(offlineReason === 'server-5xx' ? 'Server Bermasalah' : 'Offline Mode', 'Menampilkan data dari cache.');
        } else {
          Alert.alert('Gagal Memuat', 'Kesalahan parsing data.');
          setRawData([]);
        }
      }
    } catch (e: any) {
      console.warn('[useAparList] fetch error', e?.message || e);
      const cached = await AsyncStorage.getItem('APAR_CACHE');
      if (cached) {
        setRawData(JSON.parse(cached));
        Alert.alert(offlineReason === 'server-5xx' ? 'Server Bermasalah' : 'Offline Mode', 'Menampilkan data dari cache.');
      } else {
        Alert.alert('Gagal Memuat', e?.message || 'Terjadi kesalahan.');
        setRawData([]);
      }
    }
  }, [badgeNumber, clearBadgeNumber, offlineReason, preloadAllDetailsForBadge]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  // ===== Mapping ke APAR dengan daysRemaining =====
  const list: APAR[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rawData.map((item) => {
      let days = 0;
      if ((item as any).nextDueDate) {
        const nd = new Date((item as any).nextDueDate);
        nd.setHours(0, 0, 0, 0);
        days = Math.ceil((nd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      }
      return { ...(item as any), daysRemaining: days };
    });
  }, [rawData]);

  return { loading, list, refresh: fetchData, offlineReason };
}
