// src/hooks/useAparList.ts
import { useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

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

export interface APAR {
  id_apar:            string;  // <- Primary key dari DB
  no_apar:            string;  // <- Yang ditampilkan, ex "EX001"
  lokasi_apar:        string;
  jenis_apar:         string;
  keperluan_check:    string;
  qr_code_apar:       string;
  status_apar:        APARStatus;
  tgl_exp:            string;
  tgl_terakhir_maintenance: string;
  interval_maintenance: number;
  keterangan:        string;
  // tambahan UI
  daysRemaining:     number;
  nextCheckDate:     string;
}

export function useAparList() {
  const baseUrl =
    Platform.OS === 'android'
      ? 'http://10.0.2.2:3000'
      : 'http://localhost:3000';
  const apiUrl = `${baseUrl}/api/apar`;

  const [loading, setLoading] = useState<boolean>(false);
  const [rawData, setRawData] = useState<AparRaw[]>([]);
  const [stats, setStats]   = useState({ total:0, trouble:0, expired:0 });

  // 1) fetch dari API
  useEffect(() => {
    const ac = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(apiUrl, { signal: ac.signal });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setRawData(await r.json());
      } catch(err:any) {
        if (err.name!=='AbortError') console.error(err);
      } finally {
        setLoading(false);
      }
    })();
    return () => ac.abort();
  }, [apiUrl]);

  // 2) map rawData → APAR[]
  const list = useMemo<APAR[]>(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return rawData.map(item => {
      const last = new Date(item.tgl_terakhir_maintenance); last.setHours(0,0,0,0);
      const next = new Date(last); next.setDate(last.getDate()+item.interval_maintenance);
      const diff = Math.ceil((next.getTime()-today.getTime())/(1000*60*60*24));
      const y = next.getFullYear(), m = String(next.getMonth()+1).padStart(2,'0'),
            d = String(next.getDate()).padStart(2,'0');
      return {
        // penting: simpan kedua field ini
        id_apar: item.id_apar,
        no_apar: item.no_apar,

        lokasi_apar: item.lokasi_apar,
        jenis_apar:  item.jenis_apar,
        keperluan_check:  item.keperluan_check,
        qr_code_apar:     item.qr_code_apar,
        status_apar:      item.status_apar,
        tgl_exp:          item.tgl_exp,
        tgl_terakhir_maintenance: item.tgl_terakhir_maintenance,
        interval_maintenance:     item.interval_maintenance,
        keterangan:       item.keterangan,

        daysRemaining: diff,
        nextCheckDate: `${y}-${m}-${d}`,
      };
    });
  }, [rawData]);

  // 3) hitung stats
  useEffect(() => {
    const total   = list.length;
  const trouble = list.filter(i=>i.status_apar==='Maintenance').length;
    const expired = list.filter(i=>i.status_apar==='Expired').length;
    setStats({ total, trouble, expired });
  }, [list]);

  return { loading, list, stats, refresh: () => {/* optional manual refresh */} };
}
