// hooks/useAparList.ts - FIXED VERSION
import { useBadge } from '@/context/BadgeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

export type MaintenanceStatus = 'Belum' | 'Sudah';

export interface AparRaw {
  id_apar: string;
  no_apar: string;
  lokasi_apar: string;
  jenis_apar: string;
  statusMaintenance: 'Belum' | 'Sudah';
  interval_maintenance: number;
  nextDueDate: string;
  last_petugas_badge?: string;
  badge_petugas?: string;
  badgeNumber?: string;
  tanggal_selesai?: string;
}

export interface APAR extends AparRaw {
  daysRemaining: number;
}

export function useAparList() {
  const { badgeNumber, clearBadgeNumber } = useBadge();
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<AparRaw[]>([]);

  const manifest = Constants.manifest || (Constants as any).expoConfig;
  const host = Platform.OS === 'android'
    ? '10.0.2.2'
    : manifest?.debuggerHost?.split(':')[0] || 'localhost';
  const baseUrl = `http://${host}:3000`;
  // const baseUrl = 'http://172.16.34.189:3000'; // <-- Ganti dengan IP sesuai ipconfig

  const fetchData = useCallback(async () => {
    if (!badgeNumber) {
      setRawData([]);
      return;
    }
    try {
      const res = await fetch(`${baseUrl}/api/peralatan?badge=${badgeNumber}`);
      if (res.status === 400 || res.status === 404) {
        const err = await res.json();
        Alert.alert(`Error ${res.status}`, err.message || 'Kesalahan');
        clearBadgeNumber();
        setRawData([]);
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AparRaw[] = await res.json();
      setRawData(data);
      await AsyncStorage.setItem('APAR_CACHE', JSON.stringify(data));
    } catch (e: any) {
      const cached = await AsyncStorage.getItem('APAR_CACHE');
      if (cached) {
        setRawData(JSON.parse(cached));
        Alert.alert('Offline Mode', 'Menampilkan data dari cache.');
      } else {
        Alert.alert('Gagal Memuat', e.message);
      }
    }
  }, [badgeNumber, baseUrl, clearBadgeNumber]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const list: APAR[] = useMemo(() => {
    const today = new Date(); 
    today.setHours(0,0,0,0);
    return rawData.map((item, index) => {
      let days = 0;
      if (item.nextDueDate) {
        const nd = new Date(item.nextDueDate);
        nd.setHours(0,0,0,0);
        days = Math.ceil((nd.getTime() - today.getTime()) / (1000*60*60*24));
      } else {
        days = 0;
      }
      return { 
        ...item, 
        daysRemaining: days,
        // Ensure unique id
        id_apar: item.id_apar || `apar_${index}_${Date.now()}`
      };
    });
  }, [rawData]);

  return { loading, list, refresh: fetchData };
}
