import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { baseUrl } from '@/src/config';
import { syncAparOffline } from '@/src/offline/aparSync';
import { safeFetchOffline } from '@/utils/ManajemenOffline';

/* =========================
   Types
   ========================= */
export interface PetugasInfo {
  badge: string;
  role?: string | null;
  lokasiId?: number | null;
  lokasiNama?: string | null;
  intervalId?: number | null;
  intervalNama?: string | null;
  intervalBulan?: number | null;
}
export interface EmployeeInfo {
  badge: string;
  nama?: string | null;
  divisi?: string | null;
  departemen?: string | null;
  status?: string | null;
}
function isRescue(role?: string | null) {
  if (!role) return false;
  const r = String(role).toLowerCase();
  return r === 'rescue' || r.includes('rescue');
}

/* =========================
   Storage Keys
   ========================= */
const BADGE_KEY = 'BADGE_NUMBER';
const BADGE_TIMESTAMP_KEY = 'BADGE_TIMESTAMP';
const PETUGAS_INFO_KEY = 'PETUGAS_INFO';
const EMPLOYEE_INFO_KEY = 'EMPLOYEE_INFO';
const PRELOAD_FLAG = (badge: string) => `PRELOAD_FULL_FOR_${badge}`;

export const getPreloadFlagKey = PRELOAD_FLAG;

// cache tambahan untuk status/history (dipakai saat offline)
const STATUS_KEY = (id: number) => `APAR_STATUS_id=${id}`;
const HISTORY_KEY = (id: number) => `APAR_HISTORY_id=${id}`;

// cache baru utk offline scan (by token)
const OFFLINE_DETAIL_BY_TOKEN = (token: string) => `OFF_APAR_DETAIL_token=${token}`;
const OFFLINE_TOKEN_INDEX = (badge: string) => `OFF_APAR_TOKEN_INDEX_for_${badge}`;
const OFFLINE_TOKEN_TO_ID = (token: string) => `OFF_TOKEN_TO_ID_${token}`;

/* =========================
   BE response types (ringkas)
   ========================= */
type StatusResp = {
  success: boolean;
  data: {
    Id: number;
    TanggalPemeriksaan: string;
    Kondisi?: string | null;
    AparKode: string;
    LokasiNama: string;
    JenisNama: string;
    PetugasBadge?: string | null;
    NamaInterval?: string | null;
    IntervalBulan?: number | null;
    NextDueDate?: string | null;
  } | null;
};
type HistoryItem = {
  Id: number;
  TanggalPemeriksaan: string;
  Kondisi?: string | null;
  CatatanMasalah?: string | null;
  Rekomendasi?: string | null;
  TindakLanjut?: string | null;
  Tekanan?: number | null;
  JumlahMasalah?: number | null;
  PetugasBadge?: string | null;
  PetugasRole?: string | null;
  NamaInterval?: string | null;
  IntervalBulan?: number | null;
  NextDueDateAtTime?: string | null;
  AparKode: string;
  LokasiNama: string;
  JenisNama: string;
};
type TokenRow = { id_apar: number; token_qr: string; kode?: string; lokasi_nama?: string; jenis_nama?: string };
type ManifestRow = TokenRow & { last_inspection?: string | null; next_due_date?: string | null };
type OfflineDetail = {
  id_apar: number;
  token_qr: string;
  kode: string;
  lokasi_nama: string;
  jenis_nama: string;
  defaultIntervalBulan: number | null;
  last_inspection_date: string | null;
  nextDueDate: string | null;
  daysUntilDue: number | null;
  checklist: { checklistId: number; Pertanyaan: string }[];
};

/* =========================
   Utils (normalisasi id/teks)
   ========================= */
const normalizeId = (v: unknown): number | null => {
  // terima string/number/bool/null, hasil valid kalau > 0
  const n = Number(String(v ?? '').trim());
  if (!Number.isFinite(n)) return null;
  return n > 0 ? n : null;
};
const normalizeText = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
};

/* =========================
   Context
   ========================= */
interface BadgeContextValue {
  badgeNumber: string;
  petugasInfo: PetugasInfo | null;
  employeeInfo: EmployeeInfo | null;
  isEmployeeOnly: boolean;
  offlineCapable: boolean;
  isSyncing: boolean;
  syncProgress: number;              // 0..1
  setBadgeNumber: (b: string) => Promise<void>;
  clearBadgeNumber: () => Promise<void>;
}
const BadgeContext = createContext<BadgeContextValue>({
  badgeNumber: '',
  petugasInfo: null,
  employeeInfo: null,
  isEmployeeOnly: false,
  offlineCapable: false,
  isSyncing: false,
  syncProgress: 0,
  setBadgeNumber: async () => {},
  clearBadgeNumber: async () => {},
});
export const useBadge = () => useContext(BadgeContext);

/* =========================
   Modal UI: input badge
   ========================= */
function BadgeModal({ onSave, loading }: { onSave: (badge: string) => void; loading: boolean }) {
  const [input, setInput] = useState('');
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Image source={require('../assets/images/kpc-logo.png')} style={styles.logo} resizeMode="contain" />
          <Text style={styles.title}>Masukkan Badge Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: ABC123"
            value={input}
            onChangeText={setInput}
            autoCapitalize="characters"
            placeholderTextColor="#aaa"
            editable={!loading}
            onSubmitEditing={() => input.trim() && onSave(input.trim())}
          />
          <Pressable
            style={[styles.button, loading && { opacity: 0.7 }]}
            disabled={loading}
            onPress={() => input.trim() && onSave(input.trim())}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>SIMPAN</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/* =========================
   Modal UI: progress sync (GLOBAL)
   ========================= */
function BlockingSyncModal({ visible, progress = 0 }: { visible: boolean; progress?: number }) {
  const pct = Math.max(0, Math.min(100, Math.round((progress || 0) * 100)));
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.container, { paddingTop: 28, paddingBottom: 20 }]}>
          <ActivityIndicator size="large" />
          <Text style={{ marginTop: 12, fontWeight: '600', color: '#111' }}>
            Menyiapkan data offline… ({pct}%)
          </Text>
          <View style={{ width: '100%', height: 8, backgroundColor: '#e5e7eb', borderRadius: 6, marginTop: 12, overflow: 'hidden' }}>
            <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#D50000', borderRadius: 6 }} />
          </View>
          <Text style={{ marginTop: 8, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
            Mohon tunggu hingga selesai agar scan & maintenance bisa berfungsi saat offline.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

/* =========================
   Provider
   ========================= */
const HISTORY_LIMIT = 1;
const CONCURRENCY_STATUS = 5;

// rescue flow
const MANIFEST_PAGE_SIZE = 300;
const DETAILS_CHUNK = 200;

export const BadgeProvider = ({ children }: { children: ReactNode }) => {
  const [badgeNumber, setBadge] = useState('');
  const [petugasInfo, setPetugasInfo] = useState<PetugasInfo | null>(null);
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [ready, setReady] = useState(false);
  const [validating, setValidating] = useState(false);

  // global sync modal
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0); // 0..1

  /* ---------- helpers normalisasi ---------- */
  const toEmployeeInfo = useCallback(
    (badge: string, raw: any): EmployeeInfo => ({
      badge,
      nama: normalizeText(raw?.Nama ?? raw?.nama ?? raw?.EmployeeName),
      divisi: normalizeText(raw?.Divisi ?? raw?.divisi),
      departemen: normalizeText(raw?.Departemen ?? raw?.departemen),
      status: normalizeText(raw?.Status ?? raw?.status),
    }),
    []
  );

  const toPetugasInfo = useCallback((badge: string, raw: any, intervalDetail?: any): PetugasInfo => {
    const role =
      raw?.Role ?? raw?.role ?? raw?.petugas?.Role ?? raw?.petugas?.role ?? raw?.NamaRole ?? null;

    // dukungan nama field lokasi (semua variasi umum)
    const lokasiId =
      normalizeId(
        raw?.LokasiId ?? raw?.lokasiId ?? raw?.IdLokasi ?? raw?.IDLokasi ??
        raw?.LokasiID ?? raw?.lokasi_id ?? raw?.LocationId ??
        raw?.id_lokasi ?? raw?.petugas?.LokasiId ?? raw?.lokasi?.Id
      );

    const lokasiNama =
      normalizeText(
        raw?.LokasiNama ?? raw?.lokasiNama ?? raw?.NamaLokasi ?? raw?.nama_lokasi ??
        raw?.lokasi?.Nama ?? raw?.lokasi?.nama ?? raw?.Lokasi ?? raw?.lokasi
      );

    const intervalId = normalizeId(
      raw?.IntervalPetugasId ?? raw?.intervalPetugasId ?? raw?.petugas?.IntervalPetugasId
    );

    const intervalNama = normalizeText(
      raw?.IntervalNama ?? raw?.intervalNama ?? raw?.NamaInterval ??
      intervalDetail?.NamaInterval ?? intervalDetail?.namaInterval
    );
    const intervalBulanNum = normalizeId(
      raw?.IntervalBulan ?? raw?.intervalBulan ?? intervalDetail?.Bulan ?? intervalDetail?.bulan
    );

    return {
      badge,
      role: normalizeText(role),
      lokasiId,
      lokasiNama,
      intervalId,
      intervalNama,
      intervalBulan: intervalBulanNum,
    };
  }, []);

  const fetchIntervalDetailIfNeeded = useCallback(async (intervalId?: number | null) => {
    if (!intervalId) return null;
    try {
      const res = await safeFetchOffline(
        `${baseUrl}/api/interval-petugas/${encodeURIComponent(String(intervalId))}`,
        { method: 'GET' }
      );
      const json = await res.json().catch(() => null);
      if (json && !json?.offline && (res as any).ok) return json;
    } catch {}
    return null;
  }, []);

  /* ---------- HTTP helpers ---------- */
  const getJson = useCallback(async (url: string) => {
    const res = await safeFetchOffline(url, { method: 'GET' });
    let json: any = null;
    try { json = await (res as any).json(); } catch {}
    const offline = !!json?.offline;
    return { res, json, offline };
  }, []);

  const postJson = useCallback(async (url: string, body: any) => {
    const res = await safeFetchOffline(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    let json: any = null;
    try { json = await (res as any).json(); } catch {}
    const offline = !!json?.offline;
    return { res, json, offline };
  }, []);

  /* ---------- cache badge (TTL 7 hari) ---------- */
  const checkBadgeValidity = useCallback(async () => {
    const [[, b], [, ts], [, petStr], [, empStr]] = await AsyncStorage.multiGet([
      BADGE_KEY,
      BADGE_TIMESTAMP_KEY,
      PETUGAS_INFO_KEY,
      EMPLOYEE_INFO_KEY,
    ]);

    if (!b || !ts) {
      setBadge('');
      setPetugasInfo(null);
      setEmployeeInfo(null);
      setShowModal(true);
      return;
    }
    const diff = Date.now() - parseInt(ts, 10);
    const BADGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(diff) || diff > BADGE_TTL_MS) {
      await AsyncStorage.multiRemove([BADGE_KEY, BADGE_TIMESTAMP_KEY, PETUGAS_INFO_KEY, EMPLOYEE_INFO_KEY]);
      setBadge('');
      setPetugasInfo(null);
      setEmployeeInfo(null);
      setShowModal(true);
      return;
    }

    setBadge(b);
    if (petStr) { try { setPetugasInfo(JSON.parse(petStr)); } catch {} }
    if (empStr) { try { setEmployeeInfo(JSON.parse(empStr)); } catch {} }
  }, []);

  useEffect(() => { checkBadgeValidity().then(() => setReady(true)); }, [checkBadgeValidity]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s: AppStateStatus) => {
      if (s === 'active') checkBadgeValidity();
    });
    return () => sub.remove();
  }, [checkBadgeValidity]);
  useEffect(() => {
    const t = setInterval(checkBadgeValidity, 60_000);
    return () => clearInterval(t);
  }, [checkBadgeValidity]);

  /* ---------- Fallback mapper untuk /api/lokasi/by-badge/:badge/mode ---------- */
  const mapFromBadgeMode = useCallback((badge: string, raw: any): PetugasInfo => {
    return {
      badge,
      role: normalizeText(raw?.role),
      lokasiId: normalizeId(raw?.lokasiId ?? raw?.LokasiId ?? raw?.lokasi_id ?? raw?.LokasiID),
      lokasiNama: normalizeText(raw?.lokasiNama ?? raw?.LokasiNama),
      intervalId: normalizeId(raw?.intervalId ?? raw?.IntervalPetugasId),
      intervalNama: normalizeText(raw?.intervalNama ?? raw?.NamaInterval),
      intervalBulan: normalizeId(raw?.intervalBulan ?? raw?.IntervalBulan),
    };
  }, []);

  /* ---------- VALIDASI: Employee → Petugas (dengan fallback & merge) ---------- */
  const validateBadgeWithServer = useCallback(
    async (badge: string) => {
      setValidating(true);
      try {
        // 1) Employee (wajib)
        const empResp = await getJson(`${baseUrl}/api/employee/by-badge/${encodeURIComponent(badge)}`);
        if (empResp.offline) {
          Alert.alert('Gagal Verifikasi', 'Tidak ada koneksi.');
          return { emp: null, pet: null } as const;
        }
        if ((empResp.res as any).status === 404) {
          Alert.alert('Badge Tidak Terdaftar', 'Tidak ditemukan di Employee.');
          return { emp: null, pet: null } as const;
        }
        if (!(empResp.res as any).ok || !empResp.json) {
          Alert.alert('Gagal Verifikasi', `HTTP ${(empResp.res as any).status}`);
          return { emp: null, pet: null } as const;
        }
        const emp = toEmployeeInfo(badge, empResp.json);

        // 2) Petugas (utama)
        const petResp = await getJson(`${baseUrl}/api/petugas/lokasi/${encodeURIComponent(badge)}`);
        let pet: PetugasInfo | null = null;

        if (!petResp.offline && (petResp.res as any).ok && petResp.json) {
          const rawIntervalId =
            petResp.json?.IntervalPetugasId ??
            petResp.json?.intervalPetugasId ??
            petResp.json?.petugas?.IntervalPetugasId ??
            null;

          const intervalDetail = await fetchIntervalDetailIfNeeded(
            rawIntervalId ? Number(rawIntervalId) : null
          );
          pet = toPetugasInfo(badge, petResp.json, intervalDetail);
        }

        // 3) Fallback/merge jika lokasiId tidak valid namun badge sebenarnya punya lokasi
        if ((!pet || !normalizeId(pet.lokasiId)) && !isRescue(pet?.role)) {
          const fbResp = await getJson(`${baseUrl}/api/lokasi/by-badge/${encodeURIComponent(badge)}/mode`);
          if (!fbResp.offline && (fbResp.res as any).ok && fbResp.json) {
            const fromFb = mapFromBadgeMode(badge, fbResp.json);
            // merge tanpa menimpa data yang sudah valid
            pet = {
              badge,
              role: pet?.role ?? fromFb.role ?? null,
              lokasiId: normalizeId(pet?.lokasiId) ?? normalizeId(fromFb.lokasiId),
              lokasiNama: pet?.lokasiNama ?? fromFb.lokasiNama ?? null,
              intervalId: normalizeId(pet?.intervalId) ?? normalizeId(fromFb.intervalId),
              intervalNama: pet?.intervalNama ?? fromFb.intervalNama ?? null,
              intervalBulan: normalizeId(pet?.intervalBulan) ?? normalizeId(fromFb.intervalBulan),
            };
          }
        }

        // (opsional) log ringan untuk diagnosa di perangkat (tidak crash)
        // console.log('[Badge] mapped petugas:', pet);

        return { emp, pet } as const;
      } catch (e: any) {
        Alert.alert('Gagal Verifikasi', e?.message || 'Error');
        return { emp: null, pet: null } as const;
      } finally {
        setValidating(false);
      }
    },
    [fetchIntervalDetailIfNeeded, getJson, mapFromBadgeMode, toEmployeeInfo, toPetugasInfo]
  );

  /* ---------- RESCUE: MANIFEST (paging) ---------- */
  const fetchRescueManifest = useCallback(
    async (badge: string): Promise<ManifestRow[]> => {
      const all: ManifestRow[] = [];
      let page = 1;
      while (true) {
        const url =
          `${baseUrl}/api/peralatan/offline/manifest?` +
          `badge=${encodeURIComponent(badge)}&daysAhead=7&fields=minimal&page=${page}&pageSize=${MANIFEST_PAGE_SIZE}`;
        const r = await getJson(url);
        if (!(r.res as any).ok || !Array.isArray(r.json)) break;
        const batch = r.json as ManifestRow[];
        all.push(...batch);
        if (batch.length < MANIFEST_PAGE_SIZE) break;
        page++;
        setSyncProgress((p) => Math.min(0.15, p + 0.02));
      }
      return all;
    },
    [getJson]
  );

  /* ---------- RESCUE: DETAILS (bulk) ---------- */
  const fetchRescueDetails = useCallback(
    async (tokens: string[]): Promise<OfflineDetail[]> => {
      const chunks: string[][] = [];
      for (let i = 0; i < tokens.length; i += DETAILS_CHUNK) {
        chunks.push(tokens.slice(i, i + DETAILS_CHUNK));
      }
      const collected: OfflineDetail[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const r = await postJson(`${baseUrl}/api/peralatan/offline/details`, { tokens: chunks[i] });
        if ((r.res as any).ok && Array.isArray(r.json)) {
          collected.push(...(r.json as OfflineDetail[]));
        }
        const start = 0.15, end = 0.70;
        const frac = (i + 1) / chunks.length;
        setSyncProgress(start + (end - start) * frac);
      }
      return collected;
    },
    [postJson]
  );

  /* ---------- Prefetch STATUS + HISTORY ---------- */
  const prefetchStatusAndHistory = useCallback(
    async (badge: string, pet?: PetugasInfo | null, idsIfRescue?: number[]) => {
      if (isRescue(pet?.role)) {
        const ids = Array.isArray(idsIfRescue) ? idsIfRescue : [];
        if (!ids.length) return;

        const CHUNK = 200;
        const chunks: number[][] = [];
        for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));

        let processed = 0;
        for (let i = 0; i < chunks.length; i++) {
          const q = await getJson(
            `${baseUrl}/api/perawatan/status-lite-batch?ids=${chunks[i].join(',')}`
          );
          if ((q.res as any).ok && Array.isArray(q.json)) {
            for (const row of q.json) {
              const id = Number(row?.aparId ?? row?.Id ?? 0);
              if (!id) continue;
              const data = {
                Id: row?.Id ?? null,
                TanggalPemeriksaan: row?.TanggalPemeriksaan ?? null,
                Kondisi: null,
                AparKode: row?.AparKode ?? '',
                LokasiNama: row?.LokasiNama ?? '',
                JenisNama: row?.JenisNama ?? '',
                PetugasBadge: null,
                NamaInterval: null,
                IntervalBulan: row?.IntervalBulan ?? null,
                NextDueDate: row?.NextDueDate ?? null,
              } as StatusResp['data'];
              await AsyncStorage.setItem(STATUS_KEY(id), JSON.stringify(data));
            }
          }
          processed += chunks[i].length;
          const start = 0.70, end = 0.95;
          const frac = processed / Math.max(1, ids.length);
          setSyncProgress(start + (end - start) * frac);
        }
        return;
      }

      const r = await getJson(`${baseUrl}/api/peralatan/tokens-by-badge/${encodeURIComponent(badge)}`);
      if (!(r.res as any).ok || !Array.isArray(r.json)) return;

      const rows: TokenRow[] = r.json;
      let done = 0;
      const total = rows.length;
      const bump = () =>
        setSyncProgress((p) =>
          Math.min(1, p < 0.7 ? p : 0.7 + (0.3 * done) / Math.max(1, total || 1))
        );

      const q = [...rows];
      const workers: Promise<void>[] = [];
      for (let w = 0; w < CONCURRENCY_STATUS; w++) {
        workers.push(
          (async () => {
            while (q.length) {
              const row = q.shift()!;
              const id = Number(row.id_apar);
              if (!id) {
                done++;
                bump();
                continue;
              }

              try {
                const statusUrl = `${baseUrl}/api/perawatan/status/${id}?badge=${encodeURIComponent(badge)}`;
                const sres = await safeFetchOffline(statusUrl, { method: 'GET' });
                const sjson: StatusResp | any = await (sres as any).json().catch(() => null);
                if (sjson && (sres as any).ok && !sjson?.offline) {
                  await AsyncStorage.setItem(STATUS_KEY(id), JSON.stringify(sjson.data ?? null));
                }

                const hres = await safeFetchOffline(`${baseUrl}/api/perawatan/history/${id}`, { method: 'GET' });
                const hjson: { success: boolean; data: HistoryItem[] } | any = await (hres as any).json().catch(() => null);
                if (hjson && (hres as any).ok && !hjson?.offline && Array.isArray(hjson.data)) {
                  const limited = hjson.data.slice(0, HISTORY_LIMIT);
                  await AsyncStorage.setItem(HISTORY_KEY(id), JSON.stringify(limited));
                }
              } catch {
                // skip
              } finally {
                done++;
                bump();
              }
            }
          })()
        );
      }
      await Promise.all(workers);
    },
    [getJson]
  );

  /* ---------- RESCUE: persist details for offline scan ---------- */
  const persistOfflineDetails = useCallback(
    async (badge: string, details: OfflineDetail[]) => {
      const tokens: string[] = [];
      const kv: [string, string][] = [];
      const idMap: [string, string][] = [];

      for (const d of details) {
        if (!d?.token_qr) continue;
        tokens.push(d.token_qr);
        kv.push([OFFLINE_DETAIL_BY_TOKEN(d.token_qr), JSON.stringify(d)]);
        if (d.id_apar) idMap.push([OFFLINE_TOKEN_TO_ID(d.token_qr), String(d.id_apar)]);
      }

      if (kv.length) await AsyncStorage.multiSet(kv);
      if (idMap.length) await AsyncStorage.multiSet(idMap);
      await AsyncStorage.setItem(OFFLINE_TOKEN_INDEX(badge), JSON.stringify(tokens));
    },
    []
  );

  /* ---------- Jalankan FULL SYNC offline & hold UI sampai selesai ---------- */
  const runFullOfflineSync = useCallback(
    async (badge: string, pet?: PetugasInfo | null) => {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        Alert.alert('Tidak Terhubung', 'Perlu koneksi internet untuk menyiapkan data offline.');
        return false;
      }

      setIsSyncing(true);
      setSyncProgress(0);
      try {
        if (isRescue(pet?.role)) {
          const manifest = await fetchRescueManifest(badge);
          const tokens = manifest.map(m => m.token_qr).filter(Boolean);
          const ids = manifest.map(m => m.id_apar).filter((x): x is number => Number.isFinite(x));

          const details = tokens.length ? await fetchRescueDetails(tokens) : [];
          await persistOfflineDetails(badge, details);

          await syncAparOffline(badge, {
            force: true,
            concurrency: 4,
            tokensOverride: tokens,
            onProgress: (p: number) => {
              const base = 0.70;
              setSyncProgress(Math.max(base, Math.min(0.80, base + p * 0.10)));
            },
          } as any);

          await prefetchStatusAndHistory(badge, pet, ids);
          await AsyncStorage.setItem(PRELOAD_FLAG(badge), '1');
          setSyncProgress(1);
          return true;
        }

        await syncAparOffline(badge, {
          force: true,
          concurrency: 4,
          onProgress: (p) => setSyncProgress(Math.max(0, Math.min(0.7, p * 0.7))),
        });

        await prefetchStatusAndHistory(badge, pet);

        await AsyncStorage.setItem(PRELOAD_FLAG(badge), '1');
        setSyncProgress(1);
        return true;
      } catch (e: any) {
        Alert.alert('Sinkronisasi Gagal', e?.message || 'Tidak dapat menyiapkan data offline.');
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [fetchRescueDetails, fetchRescueManifest, persistOfflineDetails, prefetchStatusAndHistory]
  );

  /* ---------- Set badge + cache + HOLD UI untuk sync ---------- */
  const setBadgeNumber = useCallback(
    async (b: string) => {
      const { emp, pet } = await validateBadgeWithServer(b);
      if (!emp && !pet) return;

      const now = Date.now().toString();
      await AsyncStorage.multiSet([
        [BADGE_KEY, b],
        [BADGE_TIMESTAMP_KEY, now],
        [EMPLOYEE_INFO_KEY, emp ? JSON.stringify(emp) : ''],
        [PETUGAS_INFO_KEY, pet ? JSON.stringify(pet) : ''],
      ]);

      setBadge(b);
      setEmployeeInfo(emp ?? null);
      setPetugasInfo(pet ?? null);
      setShowModal(false);

      await runFullOfflineSync(b, pet ?? null);
    },
    [runFullOfflineSync, validateBadgeWithServer]
  );

  /* ---------- Clear ---------- */
  const clearBadgeNumber = useCallback(
    async () => {
      try {
        if (badgeNumber) {
          await AsyncStorage.removeItem(PRELOAD_FLAG(badgeNumber));
          await AsyncStorage.removeItem(OFFLINE_TOKEN_INDEX(badgeNumber));
        }
      } catch {}
      await AsyncStorage.multiRemove([BADGE_KEY, BADGE_TIMESTAMP_KEY, PETUGAS_INFO_KEY, EMPLOYEE_INFO_KEY]);
      setBadge('');
      setPetugasInfo(null);
      setEmployeeInfo(null);
      setShowModal(true);
    },
    [badgeNumber]
  );

  /* ---------- Derivatives ---------- */
  const isEmployeeOnly = useMemo(() => !!(!petugasInfo && employeeInfo), [petugasInfo, employeeInfo]);
  const offlineCapable = useMemo(() => {
    if (!petugasInfo) return false;
    const hasLokasi = normalizeId(petugasInfo.lokasiId) !== null;
    return isRescue(petugasInfo.role) || hasLokasi;
  }, [petugasInfo]);

  if (!ready) return null;

  return (
    <BadgeContext.Provider
      value={{
        badgeNumber,
        setBadgeNumber,
        clearBadgeNumber,
        petugasInfo,
        employeeInfo,
        isEmployeeOnly,
        offlineCapable,
        isSyncing,
        syncProgress,
      }}
    >
      {children}
      {showModal && <BadgeModal onSave={setBadgeNumber} loading={validating} />}
      <BlockingSyncModal visible={isSyncing} progress={syncProgress} />
    </BadgeContext.Provider>
  );
};

/* =========================
   Styles
   ========================= */
const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  container: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 8,
  },
  logo: { width: 100, height: 50, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '600', color: '#222', marginBottom: 16, textAlign: 'center' },
  input: { width: '100%', borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 10, fontSize: 16, marginBottom: 20, color: '#333' },
  button: { backgroundColor: '#D50000', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 6, width: '100%', alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
