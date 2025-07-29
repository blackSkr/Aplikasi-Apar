// hooks/useAparList.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
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
    const baseUrl =
      Platform.OS === 'android'
        ? 'http://10.0.2.2:3000'
        : 'http://localhost:3000';

    const apiUrl = `${baseUrl}/api/peralatan`;
    const CACHE_KEY = 'APAR_CACHE';

    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [rawData, setRawData] = useState<AparRaw[]>([]);
    const [hasMore, setHasMore] = useState(true);
    const [stats, setStats] = useState({ total: 0, trouble: 0, expired: 0 });

    const fetchPage = useCallback(async (pageToFetch: number) => {
      try {
        const res = await fetch(`${apiUrl}?page=${pageToFetch}&limit=20`);
        const data: AparRaw[] = await res.json();

        if (data.length < 20) setHasMore(false);
        if (pageToFetch === 1) {
          setRawData(data);
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
        } else {
          setRawData(prev => [...prev, ...data]);
        }
      } catch (err) {
        console.error('Fetch error:', err);
        if (pageToFetch === 1) {
          const cached = await AsyncStorage.getItem(CACHE_KEY);
          if (cached) {
            setRawData(JSON.parse(cached));
            Alert.alert('Offline Mode', 'Menampilkan data dari cache terakhir.');
          } else {
            Alert.alert('Gagal Memuat', 'Server tidak dapat diakses & cache kosong.');
          }
        }
      }
    }, [apiUrl]);

    const load = useCallback(() => {
      setPage(1);
      setHasMore(true);
      setLoading(true);
      fetchPage(1).finally(() => setLoading(false));
    }, [fetchPage]);

    const loadMore = useCallback(() => {
      if (!hasMore) return;
      const nextPage = page + 1;
      setPage(nextPage);
      fetchPage(nextPage);
    }, [hasMore, page, fetchPage]);

    useEffect(() => {
      load();
    }, [load]);

    const list: APAR[] = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return rawData.map(item => {
        const last = new Date(item.tgl_terakhir_maintenance);
        last.setHours(0, 0, 0, 0);

        const next = new Date(last);
        next.setDate(next.getDate() + item.interval_maintenance);

        const diff = Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

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

    useEffect(() => {
      const total = list.length;
      const trouble = list.filter(i => i.status_apar === 'Maintenance').length;
      const expired = list.filter(i => i.status_apar === 'Expired').length;
      setStats({ total, trouble, expired });
    }, [list]);

    const jenisList = useMemo(() => {
      const set = new Set(list.map(i => i.jenis_apar));
      return Array.from(set);
    }, [list]);

    return {
      loading,
      list,
      stats,
      refresh: load,
      loadMore, // <== TAMBAH INI
      hasMore,
      jenisList,
    };
  }
