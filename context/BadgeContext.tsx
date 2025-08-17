// context/BadgeContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { safeFetchOffline } from '@/utils/ManajemenOffline';

// ===== Types =====
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

// ===== Storage keys =====
const BADGE_KEY = 'BADGE_NUMBER';
const BADGE_TIMESTAMP_KEY = 'BADGE_TIMESTAMP';
const PETUGAS_INFO_KEY = 'PETUGAS_INFO';
const EMPLOYEE_INFO_KEY = 'EMPLOYEE_INFO';

// ===== Context =====
interface BadgeContextValue {
  badgeNumber: string;
  petugasInfo: PetugasInfo | null;
  employeeInfo: EmployeeInfo | null;
  isEmployeeOnly: boolean;   // true jika hanya employee (bukan petugas)
  offlineCapable: boolean;   // rescue ATAU punya lokasi (khusus petugas)
  setBadgeNumber: (b: string) => Promise<void>;
  clearBadgeNumber: () => Promise<void>;
}
const BadgeContext = createContext<BadgeContextValue>({
  badgeNumber: '',
  petugasInfo: null,
  employeeInfo: null,
  isEmployeeOnly: false,
  offlineCapable: false,
  setBadgeNumber: async () => {},
  clearBadgeNumber: async () => {},
});

export const useBadge = () => useContext(BadgeContext);

// ===== Modal UI =====
function BadgeModal({
  onSave,
  loading,
}: {
  onSave: (badge: string) => void;
  loading: boolean;
}) {
  const [input, setInput] = useState('');

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Image
            source={require('../assets/images/kpc-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Masukkan Badge Number</Text>
          <TextInput
            style={styles.input}
            placeholder="Contoh: ABC123"
            value={input}
            onChangeText={setInput}
            autoCapitalize="characters"
            placeholderTextColor="#aaa"
            editable={!loading}
            onSubmitEditing={() => {
              const trimmed = input.trim();
              if (trimmed) onSave(trimmed);
            }}
          />
          <Pressable
            style={[styles.button, loading && { opacity: 0.7 }]}
            disabled={loading}
            onPress={() => {
              const trimmed = input.trim();
              if (trimmed) onSave(trimmed);
            }}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>SIMPAN</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ===== Provider =====
export const BadgeProvider = ({ children }: { children: ReactNode }) => {
  const [badgeNumber, setBadge] = useState('');
  const [petugasInfo, setPetugasInfo] = useState<PetugasInfo | null>(null);
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [ready, setReady] = useState(false);
  const [validating, setValidating] = useState(false);

  // ---- helpers normalisasi ----
  const toEmployeeInfo = useCallback((badge: string, raw: any): EmployeeInfo => {
    return {
      badge,
      nama: raw?.Nama ?? raw?.nama ?? raw?.EmployeeName ?? null,
      divisi: raw?.Divisi ?? raw?.divisi ?? null,
      departemen: raw?.Departemen ?? raw?.departemen ?? null,
      status: raw?.Status ?? raw?.status ?? null,
    };
  }, []);

  const toPetugasInfo = useCallback((badge: string, raw: any, intervalDetail?: any): PetugasInfo => {
    const role =
      raw?.Role ?? raw?.role ?? raw?.petugas?.Role ?? raw?.petugas?.role ?? null;
    const lokasiId =
      raw?.LokasiId ?? raw?.lokasiId ?? raw?.petugas?.LokasiId ?? raw?.lokasi?.Id ?? null;
    const lokasiNama =
      raw?.LokasiNama ?? raw?.lokasiNama ?? raw?.lokasi?.Nama ?? null;
    const intervalId =
      raw?.IntervalPetugasId ?? raw?.intervalPetugasId ?? raw?.petugas?.IntervalPetugasId ?? null;

    const intervalNama =
      raw?.IntervalNama ?? raw?.intervalNama ?? intervalDetail?.NamaInterval ?? intervalDetail?.namaInterval ?? null;
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

  // ---- HTTP helper ----
  const getJson = useCallback(async (url: string) => {
    const res = await safeFetchOffline(url, { method: 'GET' });
    let json: any = null;
    try { json = await res.json(); } catch {}
    const offline = !!json?.offline;
    return { res, json, offline };
  }, []);

  // ---- cache badge (TTL 1 jam) ----
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
    const oneHour = 60 * 60 * 1000;
    if (!Number.isFinite(diff) || diff > oneHour) {
      await AsyncStorage.multiRemove([BADGE_KEY, BADGE_TIMESTAMP_KEY, PETUGAS_INFO_KEY, EMPLOYEE_INFO_KEY]);
      setBadge('');
      setPetugasInfo(null);
      setEmployeeInfo(null);
      setShowModal(true);
      return;
    }

    setBadge(b);
    if (petStr) {
      try { setPetugasInfo(JSON.parse(petStr)); } catch { setPetugasInfo(null); }
    }
    if (empStr) {
      try { setEmployeeInfo(JSON.parse(empStr)); } catch { setEmployeeInfo(null); }
    }
  }, []);

  useEffect(() => {
    checkBadgeValidity().then(() => setReady(true));
  }, [checkBadgeValidity]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'active') checkBadgeValidity();
    });
    return () => sub.remove();
  }, [checkBadgeValidity]);

  useEffect(() => {
    const interval = setInterval(checkBadgeValidity, 60_000);
    return () => clearInterval(interval);
  }, [checkBadgeValidity]);

  // ---- VALIDASI: Employee → Petugas ----
  const validateBadgeWithServer = useCallback(async (badge: string) => {
    setValidating(true);
    try {
      // 1) Employee by badge (endpoint baru pasti)
      const empResp = await getJson(
        `${baseUrl}/api/employee/by-badge/${encodeURIComponent(badge)}`
      );
      if (empResp.offline) {
        Alert.alert('Gagal Verifikasi', 'Tidak ada koneksi. Validasi badge membutuhkan internet.');
        return { emp: null, pet: null } as const;
      }
      if (empResp.res.status === 404) {
        Alert.alert('Badge Tidak Terdaftar', 'Badge tidak ditemukan di Employee.');
        return { emp: null, pet: null } as const;
      }
      if (!empResp.res.ok || !empResp.json) {
        Alert.alert('Gagal Verifikasi', `Server mengembalikan status ${empResp.res.status}.`);
        return { emp: null, pet: null } as const;
      }
      const emp = toEmployeeInfo(badge, empResp.json);

      // 2) Petugas (opsional)
      const petResp = await getJson(
        `${baseUrl}/api/petugas/lokasi/${encodeURIComponent(badge)}`
      );
      if (petResp.offline) {
        Alert.alert('Gagal Verifikasi', 'Server sedang bermasalah atau offline. Coba lagi nanti.');
        return { emp, pet: null } as const;
      }

      if (petResp.res.ok && petResp.json) {
        const rawIntervalId =
          petResp.json?.IntervalPetugasId ?? petResp.json?.intervalPetugasId ??
          petResp.json?.petugas?.IntervalPetugasId ?? null;
        const intervalDetail = await fetchIntervalDetailIfNeeded(
          rawIntervalId ? Number(rawIntervalId) : null
        );
        const pet = toPetugasInfo(badge, petResp.json, intervalDetail);
        return { emp, pet } as const;
      }

      // Tidak ada di petugas → employee-only
      return { emp, pet: null } as const;
    } catch (e: any) {
      Alert.alert('Gagal Verifikasi', e?.message || 'Terjadi kesalahan jaringan.');
      return { emp: null, pet: null } as const;
    } finally {
      setValidating(false);
    }
  }, [fetchIntervalDetailIfNeeded, getJson, toEmployeeInfo, toPetugasInfo]);

  // ---- Set badge + cache ----
  const setBadgeNumber = useCallback(async (b: string) => {
    const { emp, pet } = await validateBadgeWithServer(b);
    if (!emp && !pet) return; // tolak login

    const now = Date.now().toString();
    const kv: [string, string][] = [
      [BADGE_KEY, b],
      [BADGE_TIMESTAMP_KEY, now],
      [EMPLOYEE_INFO_KEY, emp ? JSON.stringify(emp) : ''],
      [PETUGAS_INFO_KEY, pet ? JSON.stringify(pet) : ''],
    ];
    await AsyncStorage.multiSet(kv);

    setBadge(b);
    setEmployeeInfo(emp ?? null);
    setPetugasInfo(pet ?? null);
    setShowModal(false);
  }, [validateBadgeWithServer]);

  // ---- Clear badge (logout) ----
  const clearBadgeNumber = useCallback(async () => {
    try {
      if (badgeNumber) {
        const flagKey = `PRELOAD_FULL_FOR_${badgeNumber}`;
        await AsyncStorage.removeItem(flagKey);
      }
    } catch {}
    await AsyncStorage.multiRemove([
      BADGE_KEY,
      BADGE_TIMESTAMP_KEY,
      PETUGAS_INFO_KEY,
      EMPLOYEE_INFO_KEY,
    ]);
    setBadge('');
    setPetugasInfo(null);
    setEmployeeInfo(null);
    setShowModal(true);
  }, [badgeNumber]);

  // ---- Derivatives ----
  const isEmployeeOnly = useMemo(() => !!(!petugasInfo && employeeInfo), [petugasInfo, employeeInfo]);
  const offlineCapable = useMemo(() => {
    if (!petugasInfo) return false;
    const hasLokasi = !!petugasInfo.lokasiId;
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
      }}
    >
      {children}
      {showModal && <BadgeModal onSave={setBadgeNumber} loading={validating} />}
    </BadgeContext.Provider>
  );
};

// ===== Styles =====
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#222',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    marginBottom: 20,
    color: '#333',
  },
  button: {
    backgroundColor: '#D50000',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 6,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
