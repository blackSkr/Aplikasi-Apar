// hooks/useAparList.ts
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
  // tambahkan field lain kalau perlu…
}
export interface APAR extends AparRaw {
  daysRemaining: number;
}

const CONCURRENCY = 3;
const PRELOAD_FLAG_PREFIX = 'PRELOAD_FULL_FOR_';

export function useAparList() {
  const { badgeNumber, clearBadgeNumber } = useBadge();

  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<AparRaw[]>([]);
  const [offlineReason, setOfflineReason] = useState<OfflineReason>(null);

  const preloadingRef = useRef(false);

  // reset flag offline tiap ganti badge
  useEffect(() => {
    setOfflineReason(null);
  }, [badgeNumber]);

  // bersihkan cache detail yang kedaluwarsa (TTL)
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
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ===== Fetch List =====
  const fetchData = useCallback(async () => {
    if (!badgeNumber) {
      setRawData([]);
      setOfflineReason(null);
      return;
    }

    try {
      const res = await safeFetchOffline(
        `${baseUrl}/api/peralatan?badge=${encodeURIComponent(badgeNumber)}`,
        { method: 'GET' }
      );

      // 🔴 Penting: 5xx = server bermasalah (bukan offline)
      if (res.status >= 500) {
        setOfflineReason('server-5xx');
        const cached = await AsyncStorage.getItem('APAR_CACHE');
        if (cached) {
          setRawData(JSON.parse(cached));
          Alert.alert('Server Bermasalah', 'Menampilkan data dari cache.');
        } else {
          Alert.alert(
            'Gagal Memuat',
            `Server bermasalah (HTTP ${res.status}) dan tidak ada cache lokal.`
          );
          setRawData([]);
        }
        return;
      }

      // parse body
      try {
        const json = await res.json();

        // jika safeFetchOffline menandai offline (network)
        if ((json as any)?.offline) {
          const reason =
            (json as any)?.reason === 'server-5xx' ? 'server-5xx' : 'network';
          setOfflineReason(reason);

          const cached = await AsyncStorage.getItem('APAR_CACHE');
          if (cached) {
            setRawData(JSON.parse(cached));
            Alert.alert(
              reason === 'server-5xx' ? 'Server Bermasalah' : 'Offline Mode',
              'Menampilkan data dari cache.'
            );
          } else {
            Alert.alert('Gagal Memuat', 'Tidak ada cache lokal.');
            setRawData([]);
          }
          return;
        }

        setOfflineReason(null);

        if (res.status === 400 || res.status === 404) {
          Alert.alert(`Error ${res.status}`, (json as any).message || 'Kesalahan');
          clearBadgeNumber();
          setRawData([]);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = json as any[];
        const mapped: AparRaw[] = (data || []).map((d: any) => ({
          id_apar: String(d.id_apar),
          no_apar: d.no_apar,
          lokasi_apar: d.lokasi_apar,
          jenis_apar: d.jenis_apar,
          statusMaintenance: d.last_inspection
            ? ('Sudah' as MaintenanceStatus)
            : ('Belum' as MaintenanceStatus),
          interval_maintenance: (d.kuota_per_bulan ?? 1) * 30,
          nextDueDate: d.next_due_date ?? '',
          last_inspection: d.last_inspection ?? undefined,
          tanggal_selesai: d.last_inspection ?? undefined,
          badge_petugas: d.badge_petugas ?? '',
        }));

        setRawData(mapped);
        await AsyncStorage.setItem('APAR_CACHE', JSON.stringify(mapped));

        // Preload detail agar scan/akses offline tetap jalan
        const ids = (data || [])
          .map((d: any) => d.id_apar)
          .filter((v: any) => v != null)
          .map((v: any) => String(v));
        preloadAllDetailsForBadge(ids, badgeNumber).catch(() => {});
      } catch (parseErr) {
        const cached = await AsyncStorage.getItem('APAR_CACHE');
        if (cached) {
          setRawData(JSON.parse(cached));
          Alert.alert(
            offlineReason === 'server-5xx' ? 'Server Bermasalah' : 'Offline Mode',
            'Menampilkan data dari cache.'
          );
        } else {
          Alert.alert('Gagal Memuat', 'Kesalahan parsing data.');
          setRawData([]);
        }
      }
    } catch (e: any) {
      const cached = await AsyncStorage.getItem('APAR_CACHE');
      if (cached) {
        setRawData(JSON.parse(cached));
        Alert.alert(
          offlineReason === 'server-5xx' ? 'Server Bermasalah' : 'Offline Mode',
          'Menampilkan data dari cache.'
        );
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
