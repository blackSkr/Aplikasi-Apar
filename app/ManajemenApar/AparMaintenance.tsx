// app/ManajemenApar/AparMaintenance.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import styled from 'styled-components/native';

import { useBadge } from '@/context/BadgeContext';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import {
  DETAIL_ID_PREFIX,
  DETAIL_TOKEN_PREFIX,
  touchDetailKey,
} from '@/src/cacheTTL';
import { baseUrl } from '@/src/config';
import { flushQueue, safeFetchOffline } from '@/utils/ManajemenOffline';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/* ============ Types ============ */
type ChecklistItemState = {
  checklistId?: number;
  item: string;
  condition: 'Baik' | 'Tidak Baik' | null;
  alasan: string;
};

type AparData = {
  id_apar: number;
  no_apar: string;
  lokasi_apar: string;
  jenis_apar: string;
  intervalPetugasId: number | null;
  defaultIntervalBulan: number;
  namaIntervalPetugas?: string;
  bulanIntervalPetugas?: number;
  nextDueDate?: string | null;
  keperluan_check: any;
  canInspect?: 0 | 1;
};

function normalizeApar(raw: any): AparData {
  const id = Number(raw?.id_apar ?? raw?.Id ?? raw?.id ?? 0);
  const no = String(raw?.no_apar ?? raw?.Kode ?? raw?.kode ?? '');
  const lokasi = String(raw?.lokasi_apar ?? raw?.LokasiNama ?? raw?.lokasi ?? '');
  const jenis = String(raw?.jenis_apar ?? raw?.JenisNama ?? raw?.jenis ?? '');
  const defaultInterval = Number(
    raw?.defaultIntervalBulan ?? raw?.IntervalPemeriksaanBulan ?? 0
  );
  const namaInt = raw?.namaIntervalPetugas ?? raw?.NamaInterval ?? undefined;
  const blnInt = raw?.bulanIntervalPetugas ?? raw?.IntervalBulan ?? undefined;
  const nextDue = raw?.nextDueDate ?? raw?.next_due_date ?? null;

  let kc: any = raw?.keperluan_check ?? raw?.checklist ?? '[]';
  if (typeof kc === 'string') {
    try { kc = JSON.parse(kc); } catch {}
  }

  return {
    id_apar: id,
    no_apar: no,
    lokasi_apar: lokasi,
    jenis_apar: jenis,
    intervalPetugasId: raw?.intervalPetugasId ?? raw?.IntervalPetugasId ?? null,
    defaultIntervalBulan: defaultInterval,
    namaIntervalPetugas: namaInt,
    bulanIntervalPetugas: blnInt,
    nextDueDate: nextDue,
    keperluan_check: kc,
    canInspect: typeof raw?.canInspect === 'number' ? raw.canInspect : undefined,
  };
}

export default function AparMaintenance() {
  const navigation = useNavigation();
  useLayoutEffect(() => { navigation.setOptions({ title: 'Inspeksi Alat' }); }, [navigation]);

  const insets = useSafeAreaInsets();
  const router = useRouter();

  const scrollRef = useRef<ScrollView | null>(null);

  /* ---------- Route & states ---------- */
  const route = useRoute();
  const { badgeNumber } = useBadge();
  const { refreshQueue } = useOfflineQueue();

  const params = (route.params as any) || {};
  const keyParam = params.id
    ? `id=${encodeURIComponent(params.id)}`
    : params.token
    ? `token=${encodeURIComponent(params.token)}`
    : '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [data, setData] = useState<AparData | null>(null);
  const [checklistStates, setChecklistStates] = useState<ChecklistItemState[]>([]);
  const [fotoUris, setFotoUris] = useState<string[]>([]);
  const [intervalLabel, setIntervalLabel] = useState('—');
  const [kondisi, setKondisi] = useState('');
  const [catatanMasalah, setCatatanMasalah] = useState('');
  const [rekomendasi, setRekomendasi] = useState('');
  const [tindakLanjut, setTindakLanjut] = useState('');
  const [tekanan, setTekanan] = useState('');
  const [jumlahMasalah, setJumlahMasalah] = useState('');

  // Refs (tanpa auto-focus / autoscroll)
  const alasanRefs = useRef<Array<React.RefObject<TextInput>>>([]);
  const kondisiRef = useRef<TextInput>(null);
  const catatanRef = useRef<TextInput>(null);
  const rekomRef = useRef<TextInput>(null);
  const tindakRef = useRef<TextInput>(null);
  const tekananRef = useRef<TextInput>(null);
  const jumlahRef = useRef<TextInput>(null);

  /* ---------- GPS opsional (unchanged) ---------- */
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locFetching, setLocFetching] = useState(false);
  const format6 = (n: number | null) => (n == null ? '' : Number(n).toFixed(6));
  const getLocationOnce = async () => {
    try {
      setLocFetching(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const last = await Location.getLastKnownPositionAsync({});
      if (last?.coords) { setLatitude(last.coords.latitude); setLongitude(last.coords.longitude); }
      const pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('gps-timeout')), 4000)),
      ]).catch(() => null as any);
      if (pos?.coords) { setLatitude(pos.coords.latitude); setLongitude(pos.coords.longitude); }
    } finally { setLocFetching(false); }
  };
  useEffect(() => { getLocationOnce().catch(() => {}); }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(async state => {
      if (state.isConnected) {
        const remaining = await flushQueue();
        await refreshQueue();
        if (__DEV__) console.log('[AparMaintenance] flushQueue remaining:', remaining);
      }
    });
    return () => unsub();
  }, [refreshQueue]);

  const initApar = (raw: any, source: 'online'|'cache') => {
    const apar = normalizeApar(raw);
    if (__DEV__) console.log('[AparMaintenance] initApar from', source, apar);

    setData(apar);

    let arr: any[] = [];
    const kc = apar.keperluan_check;
    if (typeof kc === 'string') { try { arr = JSON.parse(kc); } catch { arr = []; } }
    else if (Array.isArray(kc)) { arr = kc; }

    const mapped = arr.map((o: any) => ({
      checklistId: o.checklistId ?? o.Id ?? o.id,
      item: o.question || o.Pertanyaan || o.pertanyaan || '(no question)',
      condition: null,
      alasan: '',
    }));
    setChecklistStates(mapped);
    alasanRefs.current = mapped.map(() => React.createRef<TextInput>());

    if (apar.namaIntervalPetugas && apar.bulanIntervalPetugas) {
      setIntervalLabel(`${apar.namaIntervalPetugas} (${apar.bulanIntervalPetugas} bulan)`);
    } else {
      setIntervalLabel(`Default (${apar.defaultIntervalBulan} bulan)`);
    }

    if (apar.id_apar && (!apar.intervalPetugasId || apar.canInspect === 0)) {
      router.replace({ pathname: '/ManajemenApar/AparHistory', params: { id: String(apar.id_apar), no: apar.no_apar || '' } });
    }
  };

  const persistDetailCache = async (json: any) => {
    const apar = normalizeApar(json);
    const idStr = String(apar.id_apar);
    const routeParams: any = route.params || {};
    const tokenStr = routeParams.token || json?.TokenQR || json?.token || json?.Token || null;

    const pairs: [string, string][] = [
      [`${DETAIL_ID_PREFIX}${idStr}`, JSON.stringify(json)],
      [`APAR_DETAIL_${keyParam}`, JSON.stringify(json)],
    ];

    if (tokenStr) {
      pairs.push(
        [`${DETAIL_TOKEN_PREFIX}${tokenStr}`, JSON.stringify(json)],
        [`APAR_TOKEN_${tokenStr}`, idStr]
      );
    }

    await AsyncStorage.multiSet(pairs);
    await touchDetailKey(`${DETAIL_ID_PREFIX}${idStr}`);
    if (tokenStr) await touchDetailKey(`${DETAIL_TOKEN_PREFIX}${tokenStr}`);
    await touchDetailKey(`APAR_DETAIL_${keyParam}`);
  };

  const loadDetailFromCache = async (): Promise<any | null> => {
    const isToken = keyParam.startsWith('token=');
    const rawToken = isToken ? decodeURIComponent(keyParam.slice('token='.length)) : null;
    const rawId = !isToken ? decodeURIComponent(keyParam.slice('id='.length)) : null;

    if (isToken && rawToken) {
      const v = await AsyncStorage.getItem(`${DETAIL_TOKEN_PREFIX}${rawToken}`);
      if (v) { await touchDetailKey(`${DETAIL_TOKEN_PREFIX}${rawToken}`); return JSON.parse(v); }
      const mappedId = await AsyncStorage.getItem(`APAR_TOKEN_${rawToken}`);
      if (mappedId) {
        const v2 = await AsyncStorage.getItem(`${DETAIL_ID_PREFIX}${mappedId}`);
        if (v2) { await touchDetailKey(`${DETAIL_ID_PREFIX}${mappedId}`); return JSON.parse(v2); }
      }
    }

    if (!isToken && rawId) {
      const v = await AsyncStorage.getItem(`${DETAIL_ID_PREFIX}${rawId}`);
      if (v) { await touchDetailKey(`${DETAIL_ID_PREFIX}${rawId}`); return JSON.parse(v); }
    }

    const legacy = await AsyncStorage.getItem(`APAR_DETAIL_${keyParam}`);
    if (legacy) { await touchDetailKey(`APAR_DETAIL_${keyParam}`); return JSON.parse(legacy); }

    return null;
  };

  // fetch or cache
  useEffect(() => {
    (async () => {
      if (!keyParam) {
        Alert.alert('Error', 'ID atau Token QR tidak tersedia');
        setLoading(false);
        return;
      }
      setLoading(true);

      const isToken = keyParam.startsWith('token=');
      const path = isToken
        ? `${baseUrl}/api/perawatan/with-checklist/by-token-safe?${keyParam}&badge=${encodeURIComponent(badgeNumber||'')}`
        : `${baseUrl}/api/peralatan/with-checklist?${keyParam}&badge=${encodeURIComponent(badgeNumber||'')}`;

      try {
        if (__DEV__) console.log('[AparMaintenance] GET', path);
        const res = await safeFetchOffline(path, { method: 'GET' });

        let asText = '';
        try { asText = await res.text(); } catch {}
        let json: any = null;
        try { json = asText ? JSON.parse(asText) : null; } catch {}

        if (json && json.offline) {
          const cached = await loadDetailFromCache();
          if (cached) {
            initApar(cached, 'cache');
            Alert.alert('Offline/Cache', 'Menampilkan data dari cache.');
          } else {
            throw new Error('Offline dan detail belum tersimpan di perangkat.');
          }
        } else {
          if (!res.ok) {
            const msg = (json && json.message) ? json.message : `HTTP ${res.status}`;
            throw new Error(msg);
          }
          const payload = (json && typeof json === 'object' && 'data' in json) ? json.data : json;
          if (!payload || typeof payload !== 'object') throw new Error('Data tidak valid');

          initApar(payload, 'online');
          await persistDetailCache(payload);
        }
      } catch (err: any) {
        if (__DEV__) console.warn('[AparMaintenance] fetch failed:', err?.message);
        const cached = await loadDetailFromCache();
        if (cached) {
          initApar(cached, 'cache');
          Alert.alert('Offline/Cache', 'Menampilkan data dari cache.');
        } else {
          Alert.alert('Error', 'Gagal mengambil data: ' + (err?.message || 'Tidak diketahui'));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [badgeNumber, keyParam]);

  const updateChecklist = (i: number, changes: Partial<ChecklistItemState>) => {
    setChecklistStates(s => s.map((x, idx) => (idx === i ? { ...x, ...changes } : x)));
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });
    if (!result.canceled) setFotoUris(prev => [...prev, result.assets[0].uri]);
  };

  const handleSubmit = async () => {
    if (!badgeNumber || !data) { Alert.alert('Error','Data tidak lengkap'); return; }
    for (const c of checklistStates) {
      if (!c.condition || (c.condition === 'Tidak Baik' && !c.alasan)) {
        Alert.alert('Validasi','Lengkapi semua checklist dan alasan jika perlu'); return;
      }
    }

    await getLocationOnce().catch(() => {});
    setSubmitting(true);
    const formData = new FormData();
    formData.append('aparId', String(data.id_apar));
    formData.append('tanggal', new Date().toISOString());
    formData.append('badgeNumber', badgeNumber);
    if (data.intervalPetugasId != null) formData.append('intervalPetugasId', String(data.intervalPetugasId));
    formData.append('kondisi', kondisi);
    formData.append('catatanMasalah', catatanMasalah);
    formData.append('rekomendasi', rekomendasi);
    formData.append('tindakLanjut', tindakLanjut);
    formData.append('tekanan', tekanan);
    formData.append('jumlahMasalah', jumlahMasalah);
    if (latitude != null) formData.append('latitude', format6(latitude));
    if (longitude != null) formData.append('longitude', format6(longitude));
    formData.append('checklist', JSON.stringify(checklistStates.map(c => ({
      checklistId: c.checklistId, condition: c.condition, alasan: c.alasan,
    })))); 
    fotoUris.forEach((uri, idx) => {
      const ext = uri.split('.').pop() || 'jpg';
      formData.append('fotos', { uri, name: `photo${idx}.${ext}`, type: `image/${ext}` } as any);
    });

    try {
      const path = `${baseUrl}/api/perawatan/submit`;
      const res = await safeFetchOffline(path, { method: 'POST', body: formData });
      const jsonText = await res.text();
      let json: any = null;
      try { json = jsonText ? JSON.parse(jsonText) : null; } catch {}

      if ((json as any)?.offline) {
        Alert.alert('📴 Offline', 'Data disimpan sementara dan akan dikirim saat online.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else if (res.ok) {
        Alert.alert('✅ Sukses', 'Maintenance berhasil dikirim.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        throw new Error((json && json.message) || `HTTP ${res.status}`);
      }
    } catch (err: any) {
      Alert.alert('Error','Terjadi kesalahan: ' + err.message);
    } finally { setSubmitting(false); }
  };

  if (loading) {
    return (
      <Centered>
        <ActivityIndicator size="large" color="#d50000" />
        <Text style={{ marginTop: 16, color: '#666' }}>Memuat data…</Text>
      </Centered>
    );
  }
  if (!data) {
    return (
      <Centered>
        <Text style={{ color: '#666', textAlign: 'center' }}>
          Data peralatan tidak ditemukan
        </Text>
      </Centered>
    );
  }

  const onScrollBegin = (_e: NativeSyntheticEvent<NativeScrollEvent>) => {};

  const isIOS = Platform.OS === 'ios';

  return (
    <View style={{ flex: 1 }}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <ScrollContainer
          ref={scrollRef}
          // TANPA KeyboardAvoidingView, TANPA listener keyboard
          // iOS hanya pakai insets otomatis dari OS (tanpa animasi kustom)
          {...(isIOS ? { automaticallyAdjustKeyboardInsets: true } : {})}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={isIOS ? 'interactive' : 'on-drag'}
          onScrollBeginDrag={onScrollBegin}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: 24 + insets.bottom,
          }}
          // iOS: cegah tap status bar auto-scroll to top
          scrollsToTop={false}
          // Pastikan tidak ada animasi yang kita trigger sendiri
          scrollEventThrottle={0}
        >
          {/* DETAIL APAR */}
          <Card>
            <Label>No APAR:</Label>
            <ReadOnlyInput value={String(data.no_apar ?? '')} />
            <Label>Lokasi:</Label>
            <ReadOnlyInput value={String(data.lokasi_apar ?? '')} />
            <Label>Jenis:</Label>
            <ReadOnlyInput value={String(data.jenis_apar ?? '')} />
            <Label>Interval:</Label>
            <ReadOnlyInput value={String(intervalLabel ?? '—')} />
            <Label>Next Due:</Label>
            <ReadOnlyInput value={String(data.nextDueDate ?? '—')} />
          </Card>

          {/* CHECKLIST */}
          <Card>
            <Label>Checklist Pemeriksaan:</Label>
            {checklistStates.map((c, i) => (
              <View key={i} style={{ marginBottom: 16 }}>
                <QuestionText>{c.item}</QuestionText>
                <ButtonRow>
                  <Toggle
                    active={c.condition === 'Baik'}
                    onPress={() => updateChecklist(i, { condition: 'Baik' })}
                  >
                    <ToggleText active={c.condition === 'Baik'}>Baik</ToggleText>
                  </Toggle>
                  <Toggle
                    active={c.condition === 'Tidak Baik'}
                    onPress={() => {
                      // hanya set state, tanpa fokus & tanpa autoscroll
                      updateChecklist(i, { condition: 'Tidak Baik' });
                    }}
                  >
                    <ToggleText active={c.condition === 'Tidak Baik'}>Tidak Baik</ToggleText>
                  </Toggle>
                </ButtonRow>
                {c.condition === 'Tidak Baik' && (
                  <>
                    <Label>Alasan:</Label>
                    <Input
                      ref={alasanRefs.current[i]}
                      value={c.alasan}
                      onChangeText={t => updateChecklist(i, { alasan: t })}
                      placeholder="Jelaskan masalah"
                      multiline
                      textAlignVertical="top"
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={Keyboard.dismiss}
                      onBlur={Keyboard.dismiss}
                      style={{ minHeight: 80 }}
                    />
                  </>
                )}
              </View>
            ))}
          </Card>

          {/* FOTO */}
          <Card>
            <Label>Foto Pemeriksaan:</Label>
            <Pressable style={uploadStyle} onPress={pickImages}>
              <Text>Tap untuk pilih foto…</Text>
            </Pressable>
            {fotoUris.map((uri, idx) => (
              <Image key={idx} source={{ uri }} style={{ width: 100, height: 100, marginBottom: 8 }} />
            ))}
          </Card>

          {/* KOORDINAT (opsional) */}
          <Card>
            <RowBetween>
              <Label>Koordinat :</Label>
              <SmallButton onPress={getLocationOnce} disabled={locFetching}>
                {locFetching ? <ActivityIndicator /> : <SmallButtonText>Ambil Koordinat</SmallButtonText>}
              </SmallButton>
            </RowBetween>
            <CoordRow>
              <CoordItem>
                <SmallLabel>Latitude</SmallLabel>
                <ReadOnlyInput value={latitude == null ? '—' : format6(latitude)} />
              </CoordItem>
              <CoordItem>
                <SmallLabel>Longitude</SmallLabel>
                <ReadOnlyInput value={longitude == null ? '—' : format6(longitude)} />
              </CoordItem>
            </CoordRow>
          </Card>

          {/* FORM TAMBAHAN */}
          <Card>
            <Label>Kondisi Umum:</Label>
            <Input
              ref={kondisiRef}
              value={kondisi}
              onChangeText={setKondisi}
              placeholder="Masukkan kondisi umum"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            <Label>Catatan Masalah:</Label>
            <Input
              ref={catatanRef}
              value={catatanMasalah}
              onChangeText={setCatatanMasalah}
              placeholder="Masukkan catatan masalah"
              multiline
              textAlignVertical="top"
              style={{ minHeight: 80 }}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            <Label>Rekomendasi:</Label>
            <Input
              ref={rekomRef}
              value={rekomendasi}
              onChangeText={setRekomendasi}
              placeholder="Masukkan rekomendasi"
              multiline
              textAlignVertical="top"
              style={{ minHeight: 80 }}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            <Label>Tindak Lanjut:</Label>
            <Input
              ref={tindakRef}
              value={tindakLanjut}
              onChangeText={setTindakLanjut}
              placeholder="Masukkan tindak lanjut"
              multiline
              textAlignVertical="top"
              style={{ minHeight: 80 }}
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            <Label>Tekanan (bar):</Label>
            <Input
              ref={tekananRef}
              value={tekanan}
              onChangeText={setTekanan}
              placeholder="Masukkan tekanan"
              keyboardType="numeric"
              returnKeyType="done"
              onSubmitEditing={Keyboard.dismiss}
            />

            <Label>Jumlah Masalah:</Label>
            <Input
              ref={jumlahRef}
              value={jumlahMasalah}
              onChangeText={setJumlahMasalah}
              placeholder="Masukkan jumlah masalah"
              keyboardType="numeric"
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
              onBlur={Keyboard.dismiss}
            />
          </Card>

          <SubmitButton disabled={submitting} onPress={handleSubmit}>
            {submitting ? <ActivityIndicator color="#fff" /> : <SubmitText>Simpan Maintenance</SubmitText>}
          </SubmitButton>
        </ScrollContainer>
      </TouchableWithoutFeedback>
    </View>
  );
}

/* ============ Styled ============ */
const Centered = styled(View)` flex: 1; justify-content: center; align-items: center; padding: 20px; `;
const ScrollContainer = styled(ScrollView).attrs({ keyboardShouldPersistTaps: 'always' })`
  flex: 1; background-color: #f9fafb;
`;
const Card = styled(View)` background: #fff; margin: 12px 16px; padding: 16px; border-radius: 8px; elevation: 2; `;
const Label = styled(Text)` font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px; margin-top: 4px; `;
const SmallLabel = styled(Text)` font-size: 12px; font-weight: 600; color: #6b7280; margin-bottom: 4px; `;
const ReadOnlyInput = styled(TextInput).attrs({ editable: false, placeholderTextColor: '#9CA3AF' })`
  background: #f3f4f6; padding: 12px; border-radius: 6px; margin-bottom: 12px; color: #6b7280; font-size: 14px;
`;
const Input = styled(TextInput).attrs({
  placeholderTextColor: '#9CA3AF', selectionColor: '#dc2626', cursorColor: '#dc2626', autoCapitalize: 'sentences', autoCorrect: false,
})`
  background: #fff; border: 1px solid #d1d5db; padding: 12px; border-radius: 6px; margin-bottom: 12px; color: #111827;
`;
const QuestionText = styled(Text)` font-size: 15px; font-weight: 500; color: #374151; margin-bottom: 8px; `;
const ButtonRow = styled(View)` flex-direction: row; margin-bottom: 12px; justify-content: space-between; `;
const Toggle = styled(Pressable)<{ active: boolean }>`
  flex: 1; background-color: ${({ active }) => (active ? '#dc2626' : '#f3f4f6')};
  padding: 12px; border-radius: 6px; align-items: center; margin-horizontal: 4px;
  border-width: 1px; border-color: ${({ active }) => (active ? '#dc2626' : '#d1d5db')};
`;
const ToggleText = styled(Text)<{ active: boolean }>` color: ${({ active }) => (active ? '#fff' : '#6b7280')}; font-weight: 600; font-size: 14px; `;
const uploadStyle = { backgroundColor: '#f3f4f6', padding: 16, borderRadius: 6, alignItems: 'center', marginBottom: 12, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed' } as const;
const SubmitButton = styled(Pressable)<{ disabled?: boolean }>`
  background-color: ${({ disabled }) => (disabled ? '#9ca3af' : '#dc2626')};
  padding: 16px; margin: 20px 16px 12px; border-radius: 8px; align-items: center;
`;
const SubmitText = styled(Text)` color: #fff; font-size: 16px; font-weight: bold; `;
const RowBetween = styled(View)` flex-direction: row; justify-content: space-between; align-items: center; `;
const SmallButton = styled(Pressable)<{ disabled?: boolean }>`
  padding: 8px 12px; border-radius: 6px; border: 1px solid #d1d5db; opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
`;
const SmallButtonText = styled(Text)` font-size: 12px; color: #111827; `;
const CoordRow = styled(View)` flex-direction: row; gap: 12px; `;
const CoordItem = styled(View)` flex: 1; `;
