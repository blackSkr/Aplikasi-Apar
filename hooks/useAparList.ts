// hooks/useAparList.ts
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
  statusMaintenance: MaintenanceStatus;
  interval_maintenance: number;      // hari
  nextDueDate: string;               // ISO string atau ''
  last_inspection?: string;          // ISO string atau undefined
  tanggal_selesai?: string;          // ISO string atau undefined
  // petugas nggak tersedia di basic route
    badge_petugas?: string;    // ← baru

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
      const data = await res.json() as any[];

      // === mapping yang benar ===
      const mapped: AparRaw[] = data.map((d, idx) => ({
        id_apar: String(d.id_apar),
        no_apar: d.no_apar,
        lokasi_apar: d.lokasi_apar,
        jenis_apar: d.jenis_apar,
        statusMaintenance: d.last_inspection ? 'Sudah' : 'Belum',
        interval_maintenance: (d.kuota_per_bulan ?? 1) * 30,
        nextDueDate: d.next_due_date ?? '',
        last_inspection: d.last_inspection ?? undefined,
        tanggal_selesai: d.last_inspection ?? undefined,
        // <-- baru:
        badge_petugas: d.badge_petugas ?? '',      
      }));

      setRawData(mapped);
      await AsyncStorage.setItem('APAR_CACHE', JSON.stringify(mapped));
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
    return rawData.map((item) => {
      let days = 0;
      if (item.nextDueDate) {
        const nd = new Date(item.nextDueDate);
        nd.setHours(0,0,0,0);
        days = Math.ceil((nd.getTime() - today.getTime()) / (1000*60*60*24));
      }
      return { ...item, daysRemaining: days };
    });
  }, [rawData]);

  return { loading, list, refresh: fetchData };
}
