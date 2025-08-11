// hooks/useAparList.ts
import { useBadge } from '@/context/BadgeContext';
import { safeFetchOffline } from '@/utils/ManajemenOffline';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { baseUrl } from '@/src/config';

export type MaintenanceStatus = 'Belum' | 'Sudah';
export type OfflineReason = 'network' | 'server-5xx' | null;

export interface AparRaw { /* …sesuaikan field… */ }
export interface APAR extends AparRaw { daysRemaining: number; }

export function useAparList() {
  const { badgeNumber, clearBadgeNumber } = useBadge();
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<AparRaw[]>([]);
  const [offlineReason, setOfflineReason] = useState<OfflineReason>(null);

  useEffect(() => { setOfflineReason(null); }, [badgeNumber]);

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

      // coba parse json untuk deteksi offline flag
      try {
        const json = await res.json();
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

        // respons normal (bukan offline)
        setOfflineReason(null);

        if (res.status === 400 || res.status === 404) {
          Alert.alert(`Error ${res.status}`, (json as any).message || 'Kesalahan');
          clearBadgeNumber();
          setRawData([]);
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = json as any[];
        const mapped = data.map(d => ({
          id_apar: String(d.id_apar),
          no_apar: d.no_apar,
          lokasi_apar: d.lokasi_apar,
          jenis_apar: d.jenis_apar,
          statusMaintenance: d.last_inspection ? 'Sudah' : 'Belum',
          interval_maintenance: (d.kuota_per_bulan ?? 1) * 30,
          nextDueDate: d.next_due_date ?? '',
          last_inspection: d.last_inspection ?? undefined,
          tanggal_selesai: d.last_inspection ?? undefined,
          badge_petugas: d.badge_petugas ?? '',
        })) as AparRaw[];

        setRawData(mapped);
        await AsyncStorage.setItem('APAR_CACHE', JSON.stringify(mapped));
      } catch (parseErr) {
        // fallback ke cache jika parsing gagal
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
      // error tak terduga → fallback cache
      const cached = await AsyncStorage.getItem('APAR_CACHE');
      if (cached) {
        setRawData(JSON.parse(cached));
        Alert.alert(offlineReason === 'server-5xx' ? 'Server Bermasalah' : 'Offline Mode', 'Menampilkan data dari cache.');
      } else {
        Alert.alert('Gagal Memuat', e?.message || 'Terjadi kesalahan.');
        setRawData([]);
      }
    }
  }, [badgeNumber, clearBadgeNumber, offlineReason]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const list: APAR[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return rawData.map(item => {
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
