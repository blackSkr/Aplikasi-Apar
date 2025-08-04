// src/hooks/useAparList.ts

import { useBadge } from '@/context/BadgeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

export type APARStatus = 'Sehat' | 'Maintenance' | 'Expired';

export interface AparRaw {
  id_apar: string;
  no_apar: string;
  lokasi_apar: string;
  jenis_apar: string;
  status_apar: APARStatus;
  tgl_terakhir_maintenance: string;
  interval_maintenance: number;
  keterangan: string;
  tgl_exp: string;
}

export interface APAR extends AparRaw {
  daysRemaining: number;
  nextCheckDate: string;
}

export function useAparList() {
  const { badgeNumber, clearBadgeNumber } = useBadge();
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [rawData, setRawData] = useState<AparRaw[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState({ total: 0, trouble: 0, expired: 0 });

  // Tentukan serverHost sesuai environment
  const manifest = Constants.manifest || (Constants as any).expoConfig;
  const hostFromManifest = manifest?.debuggerHost?.split(':')[0];
  const serverHost =
    Platform.OS === 'android'
      ? '10.0.2.2'
      : hostFromManifest || 'localhost';
  const baseUrl = `http://${serverHost}:3000`;

  // Helper membuat URL dengan query params
  const makeUrl = (pageToFetch: number) => {
    const params: Record<string, string> = {
      page: String(pageToFetch),
      limit: '20',
    };
    if (badgeNumber) params.badge = badgeNumber;
    const qs = new URLSearchParams(params).toString();
    return `${baseUrl}/api/peralatan?${qs}`;
  };

  const fetchPage = useCallback(
    async (pageToFetch: number) => {
      const url = makeUrl(pageToFetch);
      console.log('👉 FETCH URL:', url);
      try {
        const res = await fetch(url);
        const text = await res.text();
        console.log('👀 RESPONSE START:', text.slice(0, 200));

        // Khusus 400 / 404: tampilkan alert lalu clear badge
        if (res.status === 400 || res.status === 404) {
          let msg = 'Terjadi kesalahan.';
          try {
            const errJson = JSON.parse(text);
            msg = errJson.message || msg;
          } catch {}
          await new Promise<void>(resolve =>
            Alert.alert(
              `Error ${res.status}`,
              msg,
              [{ text: 'OK', onPress: () => resolve() }],
              { cancelable: false }
            )
          );
          clearBadgeNumber();        // munculkan modal input badge
          setRawData([]);            // kosongkan data
          setHasMore(false);         // hentikan paging
          return;
        }

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data: AparRaw[] = JSON.parse(text);
        console.log('✅ RAW DATA FROM API:', data);

        if (pageToFetch === 1) {
          setRawData(data);
          await AsyncStorage.setItem('APAR_CACHE', JSON.stringify(data));
        } else {
          setRawData(prev => [...prev, ...data]);
        }

        if (data.length < 20) {
          setHasMore(false);
        }
      } catch (err: any) {
        console.error('🔴 Fetch error:', err);
        if (pageToFetch === 1) {
          const cached = await AsyncStorage.getItem('APAR_CACHE');
          if (cached) {
            setRawData(JSON.parse(cached));
            Alert.alert('Offline Mode', 'Menampilkan data dari cache terakhir.');
          } else {
            Alert.alert('Gagal Memuat', err.message);
          }
        }
      }
    },
    [badgeNumber, clearBadgeNumber]
  );

  // Load handler: jika badge kosong, batalkan fetch
  const load = useCallback(() => {
    setPage(1);
    setHasMore(true);
    setLoading(true);

    if (!badgeNumber) {
      setRawData([]);
      setLoading(false);
      return;
    }

    fetchPage(1).finally(() => setLoading(false));
  }, [badgeNumber, fetchPage]);

  // Load more handler: guard badgeNumber
  const loadMore = useCallback(() => {
    if (!hasMore || !badgeNumber) return;
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  }, [hasMore, page, fetchPage, badgeNumber]);

  // Reload setiap badgeNumber berubah
  useEffect(() => {
    load();
  }, [load, badgeNumber]);

  // Transform rawData → APAR dengan daysRemaining & nextCheckDate
  const list: APAR[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return rawData.map(item => {
      const last = new Date(item.tgl_terakhir_maintenance);
      last.setHours(0, 0, 0, 0);

      const next = new Date(last);
      next.setDate(next.getDate() + item.interval_maintenance);

      const diff = Math.ceil(
        (next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );

      const y = next.getFullYear();
      const m = String(next.getMonth() + 1).padStart(2, '0');
      const d = String(next.getDate()).padStart(2, '0');

      return {
        ...item,
        daysRemaining: diff,
        nextCheckDate: `${y}-${m}-${d}`,
      };
    });
  }, [rawData]);

  // Update stats (total, trouble, expired)
  useEffect(() => {
    setStats({
      total: list.length,
      trouble: list.filter(i => i.status_apar === 'Maintenance').length,
      expired: list.filter(i => i.status_apar === 'Expired').length,
    });
  }, [list]);

  const jenisList = useMemo(() => {
    return Array.from(new Set(list.map(i => i.jenis_apar)));
  }, [list]);

  return {
    loading,
    list,
    stats,
    refresh: load,
    loadMore,
    hasMore,
    jenisList,
  };
}
