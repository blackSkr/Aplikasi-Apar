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
  interval_maintenance?: number; // hari
  nextDueDate?: string;
  last_inspection?: string;
  tanggal_selesai?: string;
  badge_petugas?: string;
}
export interface APAR extends AparRaw { daysRemaining: number; }

const CONCURRENCY = 3;
const PRELOAD_FLAG_PREFIX = 'PRELOAD_FULL_FOR_';
const APAR_CACHE_KEY = 'APAR_CACHE';

const OFFLINE_TOKEN_INDEX = (badge: string) => `OFF_APAR_TOKEN_INDEX_for_${badge}`;
const OFFLINE_DETAIL_BY_TOKEN = (token: string) => `OFF_APAR_DETAIL_token=${token}`;
const OFFLINE_TOKEN_TO_ID = (token: string) => `OFF_TOKEN_TO_ID_${token}`;

function isRescueRole(role?: string | null) {
  if (!role) return false;
  const r = String(role).toLowerCase();
  return r === 'rescue' || r.includes('rescue');
}

function pickArrayAnywhere(json: any): any[] {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.result?.items)) return json.result.items;
  if (Array.isArray(json.result?.data)) return json.result.data;
  if (Array.isArray(json.payload?.items)) return json.payload.items;
  if (Array.isArray(json.payload?.data)) return json.payload.data;
  for (const k of Object.keys(json)) {
    if (Array.isArray((json as any)[k])) return (json as any)[k];
  }
  return [];
}

function mapRecord(d: any): AparRaw {
  return {
    id_apar: String(d?.id_apar ?? d?.Id ?? d?.ID ?? d?.id ?? ''),
    no_apar: d?.no_apar ?? d?.NoApar ?? d?.noApar ?? d?.No_APAR ?? d?.no ?? d?.kode,
    lokasi_apar:
      d?.lokasi_apar ?? d?.Lokasi ?? d?.lokasi ?? d?.NamaLokasi ?? d?.nama_lokasi ??
      d?.lokasiNama ?? d?.lokasi_nama,
    jenis_apar: d?.jenis_apar ?? d?.Jenis ?? d?.jenis ?? d?.JenisApar ?? d?.jenis_nama,
    statusMaintenance:
      d?.statusMaintenance ?? (d?.tanggal_selesai || d?.last_inspection ? 'Sudah' : 'Belum'),
    interval_maintenance:
      (d?.kuota_per_bulan != null
        ? Number(d.kuota_per_bulan) * 30
        : d?.IntervalHari != null
        ? Number(d.IntervalHari)
        : d?.defaultIntervalBulan != null
        ? Number(d.defaultIntervalBulan) * 30
        : d?.effectiveIntervalBulan != null
        ? Number(d.effectiveIntervalBulan) * 30
        : 30) || 30,
    nextDueDate: d?.next_due_date ?? d?.NextDueDate ?? d?.nextDueDate ?? '',
    last_inspection:
      d?.last_inspection ?? d?.LastInspection ?? d?.tanggal_selesai ?? d?.last_inspection_date,
    tanggal_selesai: d?.tanggal_selesai ?? d?.last_inspection,
    badge_petugas: d?.badge_petugas ?? d?.BadgePetugas ?? '',
  };
}

export function useAparList() {
  const { badgeNumber, petugasInfo }: any = useBadge();

  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<AparRaw[]>([]);
  const [offlineReason, setOfflineReason] = useState<OfflineReason>(null);

  // —— gunakan string stabil, bukan object
  const roleStr = useMemo(() => String(petugasInfo?.role ?? ''), [petugasInfo?.role]);
  const rescue = useMemo(() => isRescueRole(roleStr), [roleStr]);

  // —— single-flight guard & request freshness
  const inFlightRef = useRef<string | null>(null); // key: `${badge}|${role}|${refreshKey}`
  const latestReqId = useRef(0);

  // —— counter untuk manual refresh; tidak bergantung ke fungsi
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = useCallback(() => setRefreshKey((x) => x + 1), []);

  // —— simpan offlineReason terakhir di ref (untuk Alert)
  const offlineReasonRef = useRef<OfflineReason>(null);
  useEffect(() => { offlineReasonRef.current = offlineReason; }, [offlineReason]);

  // Bersihkan TTL sekali
  useEffect(() => { purgeStaleDetails().catch(() => {}); }, []);

  // ===== Helpers (stable) =====
  const saveDetailToCache = useCallback(async (detail: any, id: string, token?: string | null) => {
    if (!detail || typeof detail !== 'object') return;
    if (detail.id_apar == null) detail.id_apar = Number(id);

    const idKey = `${DETAIL_ID_PREFIX}${encodeURIComponent(id)}`;
    await AsyncStorage.setItem(idKey, JSON.stringify(detail));
    await touchDetailKey(idKey);

    if (token) {
      const tkKey = `${DETAIL_TOKEN_PREFIX}${encodeURIComponent(token)}`;
      await AsyncStorage.setItem(tkKey, JSON.stringify(detail));
      await touchDetailKey(tkKey);
      await AsyncStorage.setItem(`APAR_TOKEN_${token}`, String(id));
      await AsyncStorage.setItem(OFFLINE_TOKEN_TO_ID(token), String(id));
    }
  }, []);

  const fetchTokenForId = useCallback(async (id: string): Promise<string | null> => {
    try {
      const res = await safeFetchOffline(`${baseUrl}/api/peralatan/admin/${encodeURIComponent(id)}`, { method: 'GET' });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if (!res.ok || (json && json.offline)) return null;
      const token = json?.TokenQR || json?.tokenQR || json?.token || null;
      return token ? String(token).trim() : null;
    } catch { return null; }
  }, []);

  const fetchDetailByToken = useCallback(async (token: string, badge: string): Promise<any | null> => {
    try {
      const url = `${baseUrl}/api/perawatan/with-checklist/by-token-safe?token=${encodeURIComponent(token)}&badge=${encodeURIComponent(badge)}`;
      const res = await safeFetchOffline(url, { method: 'GET' });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if ((json && json.offline) || !res.ok) return null;
      const data = json?.data ?? json;
      return data && data.id_apar != null ? data : null;
    } catch { return null; }
  }, []);

  const fetchDetailById = useCallback(async (id: string, badge: string): Promise<any | null> => {
    try {
      const url = `${baseUrl}/api/peralatan/with-checklist?id=${encodeURIComponent(id)}&badge=${encodeURIComponent(badge)}`;
      const res = await safeFetchOffline(url, { method: 'GET' });
      const text = await res.text();
      const json = text ? JSON.parse(text) : null;
      if ((json && json.offline) || !res.ok) return null;
      return json && json.id_apar != null ? json : null;
    } catch { return null; }
  }, []);

  const preloadAllDetailsForBadge = useCallback(
    async (ids: string[], badge: string) => {
      if (!ids.length || !badge) return;
      const flagKey = `${PRELOAD_FLAG_PREFIX}${badge}`;
      const already = await AsyncStorage.getItem(flagKey);
      if (already) return;

      const queue = [...ids];
      const worker = async () => {
        while (queue.length) {
          const net = await NetInfo.fetch();
          if (!net.isConnected) { queue.length = 0; break; }
          const id = queue.shift()!;
          const token = await fetchTokenForId(id);
          let detail: any | null = null;
          if (token) detail = await fetchDetailByToken(token, badge);
          if (!detail) detail = await fetchDetailById(id, badge);
          if (detail) await saveDetailToCache(detail, id, token ?? undefined);
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
      await AsyncStorage.setItem(flagKey, new Date().toISOString());
    },
    [fetchTokenForId, fetchDetailByToken, fetchDetailById, saveDetailToCache]
  );

  const buildListFromRescueCache = useCallback(async (badge: string): Promise<AparRaw[]> => {
    const idxStr = await AsyncStorage.getItem(OFFLINE_TOKEN_INDEX(badge));
    const tokens: string[] = idxStr ? JSON.parse(idxStr) : [];
    if (!Array.isArray(tokens) || !tokens.length) return [];
    const out: AparRaw[] = [];
    for (const tk of tokens) {
      const s = await AsyncStorage.getItem(OFFLINE_DETAIL_BY_TOKEN(tk));
      if (!s) continue;
      const d = JSON.parse(s);
      out.push(mapRecord({
        id_apar: d?.id_apar,
        kode: d?.kode,
        lokasi_nama: d?.lokasi_nama,
        jenis_nama: d?.jenis_nama,
        defaultIntervalBulan: d?.defaultIntervalBulan ?? d?.effectiveIntervalBulan,
        nextDueDate: d?.nextDueDate,
        last_inspection: d?.last_inspection_date,
      }));
    }
    return out;
  }, []);

  const buildListFromRescueBE = useCallback(async (badge: string): Promise<AparRaw[]> => {
    const allTokens: string[] = [];
    const PAGE = 300;
    for (let page = 1; page <= 50; page++) {
      const url = `${baseUrl}/api/peralatan/offline/manifest?badge=${encodeURIComponent(badge)}&daysAhead=7&fields=minimal&page=${page}&pageSize=${PAGE}`;
      const r = await safeFetchOffline(url, { method: 'GET' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !Array.isArray(j) || !j.length) break;
      allTokens.push(...j.map((x: any) => x?.token_qr).filter(Boolean));
      if (j.length < PAGE) break;
    }
    if (!allTokens.length) return [];

    const detailsRes = await safeFetchOffline(`${baseUrl}/api/peralatan/offline/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tokens: allTokens }),
    });
    const details: any[] = (await detailsRes.json().catch(() => null)) || [];
    const mapped: AparRaw[] = [];

    for (const d of details) {
      const ar = mapRecord({
        id_apar: d?.id_apar,
        kode: d?.kode,
        lokasi_nama: d?.lokasi_nama,
        jenis_nama: d?.jenis_nama,
        defaultIntervalBulan: d?.defaultIntervalBulan ?? d?.effectiveIntervalBulan,
        nextDueDate: d?.nextDueDate,
        last_inspection: d?.last_inspection_date,
      });
      mapped.push(ar);

      const token = d?.token_qr ? String(d.token_qr) : null;
      if (token && d?.id_apar) {
        await saveDetailToCache(
          {
            id_apar: d.id_apar,
            no_apar: d.kode,
            lokasi_apar: d.lokasi_nama,
            jenis_apar: d.jenis_nama,
            defaultIntervalBulan: d.defaultIntervalBulan,
            nextDueDate: d.nextDueDate,
            last_inspection: d.last_inspection_date,
            checklist: d.checklist,
          },
          String(d.id_apar),
          token
        );
      }
    }
    await AsyncStorage.setItem(OFFLINE_TOKEN_INDEX(badge), JSON.stringify(allTokens));

    // perkaya via status-lite-batch (opsional)
    try {
      const ids = mapped.map((m) => parseInt(String(m.id_apar), 10)).filter(Number.isFinite);
      const CHUNK = 200;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        const s = await safeFetchOffline(`${baseUrl}/api/perawatan/status-lite-batch?ids=${slice.join(',')}`, { method: 'GET' });
        const js = await s.json().catch(() => null);
        if (Array.isArray(js)) {
          const byId = new Map<number, any>(js.map((x: any) => [Number(x?.aparId), x]));
          mapped.forEach((m) => {
            const row = byId.get(Number(m.id_apar));
            if (row) {
              m.nextDueDate = m.nextDueDate || row?.NextDueDate || row?.nextDueDate || m.nextDueDate;
              if (!m.last_inspection && row?.TanggalPemeriksaan) m.last_inspection = row.TanggalPemeriksaan;
            }
          });
        }
      }
    } catch {}

    return mapped;
  }, [saveDetailToCache]);

  const fetchPrimaryList = useCallback(async (badge: string): Promise<AparRaw[] | 'EMPTY' | 'ERROR'> => {
    const url = `${baseUrl}/api/peralatan?badge=${encodeURIComponent(badge)}`;
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000));
    try {
      const r = await Promise.race([safeFetchOffline(url, { method: 'GET' }), timeout]);
      const json = await r.json().catch(() => null);

      if (r.status >= 500) return 'ERROR';
      if ((json as any)?.offline) {
        return (json as any)?.reason === 'server-5xx' ? 'ERROR' : 'EMPTY';
      }
      if (r.status === 400 || r.status === 404) return 'ERROR';
      if (!r.ok) return 'ERROR';

      const arr = pickArrayAnywhere(json);
      const mapped = arr.map(mapRecord).filter((x: AparRaw) => x.id_apar !== '');
      return mapped.length ? mapped : 'EMPTY';
    } catch {
      return 'EMPTY';
    }
  }, []);

  // ========== EFFECT TUNGGAL & STABIL: memuat data ==========
  useEffect(() => {
    // key fetch—stabil; perubahan di luar ini tidak akan memicu ulang
    const badge = badgeNumber;
    const reqKey = `${badge}|${roleStr}|${refreshKey}`;

    // reset bila badge kosong
    if (!badge) {
      inFlightRef.current = null;
      setRawData([]);
      setOfflineReason(null);
      setLoading(false);
      return;
    }

    // single-flight: bila request key sama, jangan jalan lagi
    if (inFlightRef.current === reqKey) return;
    inFlightRef.current = reqKey;

    let isActive = true; // untuk mengabaikan setState kalau efek sudah unmount/berganti
    const reqId = ++latestReqId.current;

    (async () => {
      // 1) Hydrate cepat dari cache
      try {
        const cached = await AsyncStorage.getItem(APAR_CACHE_KEY);
        if (cached && isActive && reqId === latestReqId.current) {
          const parsed: AparRaw[] = JSON.parse(cached);
          if (parsed.length) {
            setRawData(parsed);
            setLoading(false);
          }
        }
      } catch {}

      // 2) Revalidate (primary/rescue)
      try {
        let winner: AparRaw[] = [];
        if (rescue) {
          const [primary, rescueList] = await Promise.all([
            (async () => {
              const p = await fetchPrimaryList(badge);
              return Array.isArray(p) ? p : [];
            })(),
            (async () => {
              const fromCache = await buildListFromRescueCache(badge);
              if (fromCache.length) return fromCache;
              return await buildListFromRescueBE(badge);
            })(),
          ]);
          winner = primary.length ? primary : rescueList;
        } else {
          const p = await fetchPrimaryList(badge);
          winner = Array.isArray(p) ? p : [];
        }

        if (!winner.length) {
          const cached = await AsyncStorage.getItem(APAR_CACHE_KEY);
          if (cached) winner = JSON.parse(cached);
        }

        if (isActive && reqId === latestReqId.current) {
          setRawData(winner);
          await AsyncStorage.setItem(APAR_CACHE_KEY, JSON.stringify(winner));
          setOfflineReason(null);
        }

        const ids = winner.map((d) => d.id_apar).filter(Boolean);
        if (ids.length && !rescue) preloadAllDetailsForBadge(ids, badge).catch(() => {});
      } catch (e: any) {
        if (isActive && reqId === latestReqId.current) {
          const cached = await AsyncStorage.getItem(APAR_CACHE_KEY);
          if (cached) {
            setRawData(JSON.parse(cached));
            Alert.alert(
              offlineReasonRef.current === 'server-5xx' ? 'Server Bermasalah' : 'Offline Mode',
              'Menampilkan data dari cache.'
            );
          } else {
            Alert.alert('Gagal Memuat', e?.message || 'Terjadi kesalahan.');
            setRawData([]);
          }
        }
      } finally {
        if (isActive && reqId === latestReqId.current) {
          setLoading(false);
        }
      }
    })();

    // cleanup: biar setState setelah unmount tidak jalan
    return () => { isActive = false; };
  }, [
    badgeNumber,     // stabil (string)
    roleStr,         // stabil (string)
    refreshKey,      // angka counter manual
    rescue,          // boolean dari roleStr (stabil)
    fetchPrimaryList,
    buildListFromRescueCache,
    buildListFromRescueBE,
    preloadAllDetailsForBadge,
  ]);

  // ===== Derive daysRemaining =====
  const list: APAR[] = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
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

  return { loading, list, refresh, offlineReason };
}
