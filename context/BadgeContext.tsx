// src/context/BadgeContext.tsx
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
const STATUS_KEY = (id: number) => `APAR_STATUS_id=${id}`;   // value: StatusResp['data'] | null
const HISTORY_KEY = (id: number) => `APAR_HISTORY_id=${id}`; // value: HistoryItem[] (dibatasi)

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

          {/* progress bar */}
          <View
            style={{
              width: '100%',
              height: 8,
              backgroundColor: '#e5e7eb',
              borderRadius: 6,
              marginTop: 12,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${pct}%`,
                height: '100%',
                backgroundColor: '#D50000',   // <— tambahkan warna bar
                borderRadius: 6,
              }}
            />
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
const HISTORY_LIMIT = 1;              // berapa item riwayat terbaru yang diprefetch
const CONCURRENCY_STATUS = 5;         // concurrency untuk status/history

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
      nama: raw?.Nama ?? raw?.nama ?? raw?.EmployeeName ?? null,
      divisi: raw?.Divisi ?? raw?.divisi ?? null,
      departemen: raw?.Departemen ?? raw?.departemen ?? null,
      status: raw?.Status ?? raw?.status ?? null,
    }),
    []
  );

  const toPetugasInfo = useCallback((badge: string, raw: any, intervalDetail?: any): PetugasInfo => {
    const role =
      raw?.Role ?? raw?.role ?? raw?.petugas?.Role ?? raw?.petugas?.role ?? raw?.NamaRole ?? null;

    // dukungan nama field lokasi (berbagai casing)
    const lokasiId =
      raw?.LokasiId ?? raw?.lokasiId ?? raw?.IdLokasi ?? raw?.IDLokasi ??
      raw?.id_lokasi ?? raw?.petugas?.LokasiId ?? raw?.lokasi?.Id ?? null;

    const lokasiNama =
      raw?.LokasiNama ?? raw?.lokasiNama ?? raw?.NamaLokasi ?? raw?.nama_lokasi ??
      raw?.lokasi?.Nama ?? raw?.lokasi?.nama ?? raw?.Lokasi ?? raw?.lokasi ?? null;

    const intervalId =
      raw?.IntervalPetugasId ?? raw?.intervalPetugasId ?? raw?.petugas?.IntervalPetugasId ?? null;

    const intervalNama =
      raw?.IntervalNama ?? raw?.intervalNama ?? raw?.NamaInterval ?? intervalDetail?.NamaInterval ?? intervalDetail?.namaInterval ?? null;
    const intervalBulanNum =
      raw?.IntervalBulan ?? raw?.intervalBulan ?? intervalDetail?.Bulan ?? intervalDetail?.bulan ?? null;

    return {
      badge,
      role: role ?? null,
      lokasiId: lokasiId != null ? Number(lokasiId) : null,
      lokasiNama: lokasiNama ?? null,
      intervalId: intervalId != null ? Number(intervalId) : null,
      intervalNama: intervalNama ?? null,
      intervalBulan: intervalBulanNum != null ? Number(intervalBulanNum) : null,
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
      if (json && !json.offline && res.ok) return json;
    } catch {}
    return null;
  }, []);

  /* ---------- HTTP helper ---------- */
  const getJson = useCallback(async (url: string) => {
    const res = await safeFetchOffline(url, { method: 'GET' });
    let json: any = null;
    try { json = await res.json(); } catch {}
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
      role: raw?.role ?? null,
      lokasiId: raw?.lokasiId != null ? Number(raw?.lokasiId) : null,
      lokasiNama: raw?.lokasiNama ?? null,
      intervalId: raw?.intervalId != null ? Number(raw?.intervalId) : null,
      intervalNama: raw?.intervalNama ?? null,
      intervalBulan: raw?.intervalBulan != null ? Number(raw?.intervalBulan) : null,
    };
  }, []);

  /* ---------- VALIDASI: Employee → Petugas (dengan fallback) ---------- */
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
        if (empResp.res.status === 404) {
          Alert.alert('Badge Tidak Terdaftar', 'Tidak ditemukan di Employee.');
          return { emp: null, pet: null } as const;
        }
        if (!empResp.res.ok || !empResp.json) {
          Alert.alert('Gagal Verifikasi', `HTTP ${empResp.res.status}`);
          return { emp: null, pet: null } as const;
        }
        const emp = toEmployeeInfo(badge, empResp.json);

        // 2) Petugas (lama)
        const petResp = await getJson(`${baseUrl}/api/petugas/lokasi/${encodeURIComponent(badge)}`);
        if (petResp.offline) {
          Alert.alert('Gagal Verifikasi', 'Server bermasalah / offline.');
          return { emp, pet: null } as const;
        }

        if (petResp.res.ok && petResp.json) {
          const rawIntervalId =
            petResp.json?.IntervalPetugasId ??
            petResp.json?.intervalPetugasId ??
            petResp.json?.petugas?.IntervalPetugasId ??
            null;
          const intervalDetail = await fetchIntervalDetailIfNeeded(
            rawIntervalId ? Number(rawIntervalId) : null
          );
          const pet = toPetugasInfo(badge, petResp.json, intervalDetail);
          return { emp, pet } as const;
        }

        // 3) Fallback baru (non-breaking)
        const fbResp = await getJson(`${baseUrl}/api/lokasi/by-badge/${encodeURIComponent(badge)}/mode`);
        if (fbResp.res.ok && fbResp.json && !fbResp.offline) {
          const pet = mapFromBadgeMode(badge, fbResp.json);
          return { emp, pet } as const;
        }

        return { emp, pet: null } as const;
      } catch (e: any) {
        Alert.alert('Gagal Verifikasi', e?.message || 'Error');
        return { emp: null, pet: null } as const;
      } finally {
        setValidating(false);
      }
    },
    [fetchIntervalDetailIfNeeded, getJson, mapFromBadgeMode, toEmployeeInfo, toPetugasInfo]
  );

  /* ---------- Prefetch STATUS + HISTORY (ringan) ---------- */
  const prefetchStatusAndHistory = useCallback(
    async (badge: string) => {
      // Ambil daftar ID peralatan untuk petugas
      const r = await getJson(`${baseUrl}/api/peralatan/tokens-by-badge/${encodeURIComponent(badge)}`);
      if (!r.res.ok || !Array.isArray(r.json)) return;

      const rows: TokenRow[] = r.json;
      let done = 0;
      const total = rows.length;
      const bump = () => setSyncProgress(p => Math.min(1, p < 0.7 ? p : 0.7 + (0.3 * done) / Math.max(1, total)));

      // pool sederhana
      const q = [...rows];
      const workers: Promise<void>[] = [];
      for (let w = 0; w < CONCURRENCY_STATUS; w++) {
        workers.push((async () => {
          while (q.length) {
            const row = q.shift()!;
            const id = Number(row.id_apar);
            if (!id) { done++; bump(); continue; }

            try {
              // status (butuh badge)
              const sres = await safeFetchOffline(`${baseUrl}/api/perawatan/status/${id}?badge=${encodeURIComponent(badge)}`, { method: 'GET' });
              const sjson: StatusResp | any = await sres.json().catch(() => null);
              if (sjson && sres.ok && !sjson?.offline) {
                await AsyncStorage.setItem(STATUS_KEY(id), JSON.stringify(sjson.data ?? null));
              }

              // history terbatas: ambil semua lalu simpan TOP N secara lokal
              const hres = await safeFetchOffline(`${baseUrl}/api/perawatan/history/${id}`, { method: 'GET' });
              const hjson: { success: boolean; data: HistoryItem[] } | any = await hres.json().catch(() => null);
              if (hjson && hres.ok && !hjson?.offline && Array.isArray(hjson.data)) {
                const limited = hjson.data.slice(0, HISTORY_LIMIT);
                await AsyncStorage.setItem(HISTORY_KEY(id), JSON.stringify(limited));
              }
            } catch { /* skip */ }
            finally { done++; bump(); }
          }
        })());
      }
      await Promise.all(workers);
    },
    [getJson]
  );

  /* ---------- Jalankan FULL SYNC offline & hold UI sampai selesai ---------- */
  const runFullOfflineSync = useCallback(
    async (badge: string) => {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        Alert.alert('Tidak Terhubung', 'Perlu koneksi internet untuk menyiapkan data offline.');
        return false;
      }

      setIsSyncing(true);
      setSyncProgress(0);
      try {
        // Langkah 1: prefetch DETAIL (70% progress)
        await syncAparOffline(badge, {
          force: true,
          concurrency: 4,
          onProgress: (p) => setSyncProgress(Math.max(0, Math.min(0.7, p * 0.7))),
        });

        // Langkah 2: STATUS + HISTORY ringan (30% progress)
        await prefetchStatusAndHistory(badge);

        // Simpan flag preload
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
    [prefetchStatusAndHistory]
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

      // Jalankan sync penuh—modal global muncul dari sini
      await runFullOfflineSync(b);
    },
    [runFullOfflineSync, validateBadgeWithServer]
  );

  /* ---------- Clear ---------- */
  const clearBadgeNumber = useCallback(
    async () => {
      try {
        if (badgeNumber) await AsyncStorage.removeItem(PRELOAD_FLAG(badgeNumber));
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
    const hasLokasi = petugasInfo.lokasiId != null;
    return isRescue(petugasInfo.role) || hasLokasi;
  }, [petugasInfo]);

  // expose ensure ready API (optional, dipakai layar scan untuk token baru)
  // tetap tersedia via import langsung dari aparSync, tapi konteks ini sudah melakukan preload

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
