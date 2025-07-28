// hooks/useAparList.ts

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
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

  const apiUrl = `${baseUrl}/api/peralatan`; // ganti ke endpoint baru
  const CACHE_KEY = 'APAR_CACHE';

  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<AparRaw[]>([]);
  const [stats, setStats] = useState({ total: 0, trouble: 0, expired: 0 });

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const net = await NetInfo.fetch();
      const online = net.isConnected === true;

      if (online) {
        try {
          const res = await fetch(apiUrl);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data: AparRaw[] = await res.json();
// console.log('📦 DATA DARI API:', data);

          setRawData(data);

          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));

          for (const apar of data) {
            const key = `cached-apar-${apar.id_apar}`;
            await AsyncStorage.setItem(key, JSON.stringify(apar));
          }

        } catch (err: any) {
          console.error('Fetch error:', err);

          const cached = await AsyncStorage.getItem(CACHE_KEY);
          if (cached) {
            setRawData(JSON.parse(cached));
            Alert.alert('Offline Mode', 'Menampilkan data dari cache terakhir.');
          } else {
            Alert.alert('Gagal Memuat', 'Server tidak dapat diakses & cache kosong.');
          }
        }
      } else {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          setRawData(JSON.parse(cached));
        } else {
          Alert.alert('Offline', 'Tidak ada data cache. Silakan sambungkan ke internet.');
        }
      }

    } catch (e) {
      Alert.alert('Error', 'Terjadi masalah saat membaca data.');
    } finally {
      setLoading(false);
    }
  }, [apiUrl]);

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
    jenisList,
  };
}
