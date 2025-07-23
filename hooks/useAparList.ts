// src/hooks/useAparList.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { safeFetchOffline } from '../utils/safeFetchOffline';

export type APARStatus = 'Sehat' | 'Maintenance' | 'Expired';

export interface AparRaw {
  id_apar: string;
  no_apar: string;
  lokasi_apar: string;
  jenis_apar: string;
  keperluan_check: string;
  qr_code_apar: string;
  status_apar: APARStatus;
  tgl_exp: string;
  tgl_terakhir_maintenance: string;
  interval_maintenance: number;
  keterangan: string;
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
  const apiUrl = `${baseUrl}/api/apar`;
  const CACHE_KEY = 'APAR_CACHE';

  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<AparRaw[]>([]);
  const [stats, setStats] = useState({ total: 0, trouble: 0, expired: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    const net = await NetInfo.fetch();
    if (net.isConnected) {
      // jika online, fetch dan update cache
      try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: AparRaw[] = await res.json();
        setRawData(data);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } catch (e: any) {
        console.warn('Fetch error, fallback ke cache:', e);
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          setRawData(JSON.parse(cached));
        } else {
          Alert.alert('Error', e.message);
        }
      }
    } else {
      // offline: ambil list dari cache
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        setRawData(JSON.parse(cached));
      } else {
        Alert.alert('Offline', 'Tidak ada cache. Nyalakan koneksi dulu.');
      }
    }
    setLoading(false);
  }, [apiUrl]);

  useEffect(() => {
    load();
  }, [load]);

  // hitung daysRemaining & nextCheckDate
  const list: APAR[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rawData.map(item => {
      const last = new Date(item.tgl_terakhir_maintenance);
      last.setHours(0, 0, 0, 0);
      const next = new Date(last);
      next.setDate(next.getDate() + item.interval_maintenance);
      const diff =
        Math.ceil((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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

  // hitung stats
  useEffect(() => {
    const total = list.length;
    const trouble = list.filter(i => i.status_apar === 'Maintenance').length;
    const expired = list.filter(i => i.status_apar === 'Expired').length;
    setStats({ total, trouble, expired });
  }, [list]);

  return { loading, list, stats, refresh: load };
}
