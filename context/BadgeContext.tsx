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
import { isRescue, PetugasInfo } from '@/src/types/petugas';
import { safeFetchOffline } from '@/utils/ManajemenOffline';

const BADGE_KEY = 'BADGE_NUMBER';
const BADGE_TIMESTAMP_KEY = 'BADGE_TIMESTAMP';
const PETUGAS_INFO_KEY = 'PETUGAS_INFO';

interface BadgeContextValue {
  badgeNumber: string;
  petugasInfo: PetugasInfo | null;
  offlineCapable: boolean; // rescue ATAU punya lokasi
  setBadgeNumber: (b: string) => Promise<void>;
  clearBadgeNumber: () => Promise<void>;
}

const BadgeContext = createContext<BadgeContextValue>({
  badgeNumber: '',
  petugasInfo: null,
  offlineCapable: false,
  setBadgeNumber: async () => {},
  clearBadgeNumber: async () => {},
});

export const useBadge = () => useContext(BadgeContext);

/** ====== UI Modal Input Badge ====== */
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

/** ====== Provider ====== */
export const BadgeProvider = ({ children }: { children: ReactNode }) => {
  const [badgeNumber, setBadge] = useState('');
  const [petugasInfo, setPetugasInfo] = useState<PetugasInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [ready, setReady] = useState(false);
  const [validating, setValidating] = useState(false);

  /** Normalisasi respons server menjadi PetugasInfo */
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

  /** Cek cache badge+info (TTL 1 jam) */
  const checkBadgeValidity = useCallback(async () => {
    const [[, b], [, ts], [, infoStr]] = await AsyncStorage.multiGet([
      BADGE_KEY,
      BADGE_TIMESTAMP_KEY,
      PETUGAS_INFO_KEY,
    ]);

    if (!b || !ts) {
      setBadge('');
      setPetugasInfo(null);
      setShowModal(true);
      return;
    }

    const diff = Date.now() - parseInt(ts, 10);
    const oneHour = 60 * 60 * 1000;
    if (!Number.isFinite(diff) || diff > oneHour) {
      await AsyncStorage.multiRemove([BADGE_KEY, BADGE_TIMESTAMP_KEY, PETUGAS_INFO_KEY]);
      setBadge('');
      setPetugasInfo(null);
      setShowModal(true);
      return;
    }

    setBadge(b);
    if (infoStr) {
      try {
        setPetugasInfo(JSON.parse(infoStr));
      } catch {
        setPetugasInfo(null);
      }
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

  /** Validasi ke backend: TIDAK boleh login saat offline */
  const validateBadgeWithServer = useCallback(async (badge: string): Promise<PetugasInfo | null> => {
    try {
      setValidating(true);
      const res = await safeFetchOffline(
        `${baseUrl}/api/petugas/lokasi/${encodeURIComponent(badge)}`,
        { method: 'GET' }
      );

      const json = await res.json().catch(() => null);

      // offline/network/server-5xx → larang login baru
      if (json && (json as any).offline) {
        Alert.alert(
          'Gagal Verifikasi',
          (json as any).reason === 'server-5xx'
            ? 'Server sedang bermasalah. Coba lagi nanti.'
            : 'Tidak ada koneksi. Pastikan internet aktif untuk verifikasi badge.'
        );
        return null;
      }

      if (res.status === 404 || res.status === 400) {
        Alert.alert('Badge Tidak Terdaftar', 'Silakan periksa kembali badge number Anda.');
        return null;
      }
      if (!res.ok || !json) {
        Alert.alert('Gagal Verifikasi', `Server mengembalikan status ${res.status}.`);
        return null;
      }

      // Ambil detail interval jika belum lengkap
      const rawIntervalId =
        json?.IntervalPetugasId ?? json?.intervalPetugasId ?? json?.petugas?.IntervalPetugasId ?? null;
      const intervalDetail = await fetchIntervalDetailIfNeeded(
        rawIntervalId ? Number(rawIntervalId) : null
      );

      return toPetugasInfo(badge, json, intervalDetail);
    } catch (e: any) {
      Alert.alert('Gagal Verifikasi', e?.message || 'Terjadi kesalahan jaringan.');
      return null;
    } finally {
      setValidating(false);
    }
  }, [fetchIntervalDetailIfNeeded, toPetugasInfo]);

  /** Set badge + cache info */
  const setBadgeNumber = useCallback(async (b: string) => {
    const info = await validateBadgeWithServer(b);
    if (!info) return;

    const now = Date.now().toString();
    await AsyncStorage.multiSet([
      [BADGE_KEY, b],
      [BADGE_TIMESTAMP_KEY, now],
      [PETUGAS_INFO_KEY, JSON.stringify(info)],
    ]);

    setBadge(b);
    setPetugasInfo(info);
    setShowModal(false);
  }, [validateBadgeWithServer]);

  /** Clear badge (logout) */
  const clearBadgeNumber = useCallback(async () => {
    // bersihkan juga flag preload per badge
    try {
      if (badgeNumber) {
        const flagKey = `PRELOAD_FULL_FOR_${badgeNumber}`;
        await AsyncStorage.removeItem(flagKey);
      }
    } catch {}

    await AsyncStorage.multiRemove([BADGE_KEY, BADGE_TIMESTAMP_KEY, PETUGAS_INFO_KEY]);
    setBadge('');
    setPetugasInfo(null);
    setShowModal(true);
  }, [badgeNumber]);

  /** Rescue atau punya lokasi → offline capable */
  const offlineCapable = useMemo(() => {
    const hasLokasi = !!petugasInfo?.lokasiId;
    return isRescue(petugasInfo?.role) || hasLokasi;
  }, [petugasInfo]);

  if (!ready) return null;

  return (
    <BadgeContext.Provider
      value={{ badgeNumber, setBadgeNumber, clearBadgeNumber, petugasInfo, offlineCapable }}
    >
      {children}
      {showModal && <BadgeModal onSave={setBadgeNumber} loading={validating} />}
    </BadgeContext.Provider>
  );
};

/** ====== Styles ====== */
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
