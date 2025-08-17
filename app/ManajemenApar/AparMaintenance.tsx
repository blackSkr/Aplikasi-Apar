// app/ManajemenApar/AparMaintenance.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import styled from 'styled-components/native';

import { useBadge } from '@/context/BadgeContext';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { flushQueue, safeFetchOffline } from '@/utils/ManajemenOffline';
import { useLayoutEffect } from 'react';

// ✅ tambahan untuk hitung offset header & padding safe area
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
};

// --- helper: normalisasi bentuk payload (online/offline/by-id/by-token) ---
function normalizeApar(raw: any): AparData {
  const id = Number(raw?.id_apar ?? raw?.Id ?? raw?.id ?? 0);
  const no = String(raw?.no_apar ?? raw?.Kode ?? raw?.kode ?? '');
  const lokasi = String(raw?.lokasi_apar ?? raw?.LokasiNama ?? raw?.lokasi ?? '');
  const jenis = String(raw?.jenis_apar ?? raw?.JenisNama ?? raw?.jenis ?? '');
  const defaultInterval = Number(
    raw?.defaultIntervalBulan ?? raw?.IntervalPemeriksaanBulan ?? 0
  );
  const namaInt = raw?.namaIntervalPetugas ?? raw?.NamaInterval ?? undefined;
  const blnInt =
    raw?.bulanIntervalPetugas ?? raw?.IntervalBulan ?? undefined;
  const nextDue = raw?.nextDueDate ?? raw?.next_due_date ?? null;

  // checklist bisa berupa string JSON / array sudah jadi
  let kc: any = raw?.keperluan_check ?? raw?.checklist ?? '[]';
  if (typeof kc === 'string') {
    try { kc = JSON.parse(kc); } catch { /* biarkan string, nanti diparse lagi */ }
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
  };
}

export default function AparMaintenance() {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ title: 'Inspeksi Alat' });
  }, [navigation]);

  const route = useRoute();
  const { badgeNumber } = useBadge();
  const { count: queueCount, refreshQueue } = useOfflineQueue();

  // ✅ offset header & padding safe area
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

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
    if (typeof kc === 'string') {
      try { arr = JSON.parse(kc); } catch { arr = []; }
    } else if (Array.isArray(kc)) {
      arr = kc;
    }

    setChecklistStates(
      arr.map((o: any) => ({
        checklistId: o.checklistId ?? o.Id ?? o.id,
        item: o.question || o.Pertanyaan || o.pertanyaan || '(no question)',
        condition: null,
        alasan: '',
      }))
    );

    if (apar.namaIntervalPetugas && apar.bulanIntervalPetugas) {
      setIntervalLabel(`${apar.namaIntervalPetugas} (${apar.bulanIntervalPetugas} bulan)`);
    } else {
      setIntervalLabel(`Default (${apar.defaultIntervalBulan} bulan)`);
    }
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
        ? `/api/perawatan/with-checklist/by-token?${keyParam}&badge=${encodeURIComponent(badgeNumber||'')}`
        : `/api/peralatan/with-checklist?${keyParam}&badge=${encodeURIComponent(badgeNumber||'')}`;

      try {
        if (__DEV__) console.log('[AparMaintenance] GET', path);
        const res = await safeFetchOffline(path, { method: 'GET' });
        const text = await res.text();
        let json: any = null;
        try { json = text ? JSON.parse(text) : null; } catch {}

        if (json && json.offline) throw new Error('Offline fallback');
        if (!res.ok) {
          const msg = (json && json.message) ? json.message : `HTTP ${res.status}`;
          throw new Error(msg);
        }
        if (!json || typeof json !== 'object') throw new Error('Data tidak valid');

        initApar(json, 'online');
        await AsyncStorage.setItem(`APAR_DETAIL_${keyParam}`, JSON.stringify(json));
      } catch (err: any) {
        if (__DEV__) console.warn('[AparMaintenance] fetch failed:', err?.message);
        const cached = await AsyncStorage.getItem(`APAR_DETAIL_${keyParam}`);
        if (cached) {
          initApar(JSON.parse(cached), 'cache');
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

  // ubah 'Baik' | 'Tidak Baik' -> 1 | 0
  const toDicentang = (cond: ChecklistItemState['condition']) =>
    cond === 'Baik' ? 1 : 0;

  // serialize agar sesuai BE
  const serializeChecklist = (states: ChecklistItemState[]) =>
    states.map(s => ({
      ChecklistId: Number(s.checklistId || 0),
      Dicentang: toDicentang(s.condition),
      Keterangan: s.condition === 'Tidak Baik' ? (s.alasan || '') : ''
    }));

  const handleSubmit = async () => {
    if (!badgeNumber || !data) {
      Alert.alert('Error','Data tidak lengkap');
      return;
    }
    for (const c of checklistStates) {
      if (!c.condition || (c.condition === 'Tidak Baik' && !c.alasan)) {
        Alert.alert('Validasi','Lengkapi semua checklist dan alasan jika perlu');
        return;
      }
    }

    setSubmitting(true);
    const formData = new FormData();

    formData.append('aparId', String(data.id_apar));
    formData.append('tanggal', new Date().toISOString());
    formData.append('badgeNumber', badgeNumber);

    if (data.intervalPetugasId != null) {
      formData.append('intervalPetugasId', String(data.intervalPetugasId));
    }
    formData.append('kondisi', kondisi);
    formData.append('catatanMasalah', catatanMasalah);
    formData.append('rekomendasi', rekomendasi);
    formData.append('tindakLanjut', tindakLanjut);
    formData.append('tekanan', tekanan);
    formData.append('jumlahMasalah', jumlahMasalah);

    // ⬇️ kirim format yang BE harapkan
    formData.append('checklist', JSON.stringify(serializeChecklist(checklistStates)));

    // ⬇️ pakai field 'photos' (bukan 'fotos') + mime aman
    fotoUris.forEach((uri, idx) => {
      // fallback ke jpeg biar aman
      const name = `photo_${idx + 1}.jpg`;
      formData.append('photos', {
        uri,
        name,
        type: 'image/jpeg',
      } as any);
    });

    try {
      const path = '/api/perawatan/submit';
      const res = await safeFetchOffline(path, { method: 'POST', body: formData });
      const json = await res.json();

      if ((json as any).offline) {
        Alert.alert('📴 Offline', 'Data disimpan sementara dan akan dikirim saat online.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('✅ Sukses', 'Maintenance berhasil dikirim.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Error','Terjadi kesalahan: ' + err.message);
    } finally {
      setSubmitting(false);
    }
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      // iOS: konten didorong sesuai tinggi keyboard; Android: ubah tinggi container
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      // offset agar tidak nabrak header navigation
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollContainer
        // penting: biar tombol/pressable tetap bisa dipencet saat keyboard terbuka
        keyboardShouldPersistTaps="handled"
        // iOS: swipe untuk menutup keyboard lebih smooth
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        // beri ruang ekstra di bawah supaya field/tombol paling bawah tetap terlihat
        contentContainerStyle={{ paddingBottom: (insets?.bottom ?? 0) + 24 }}
        contentInsetAdjustmentBehavior={Platform.OS === 'ios' ? 'always' : 'automatic'}
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
                <Toggle active={c.condition === 'Baik'} onPress={() => updateChecklist(i, { condition: 'Baik' })}>
                  <ToggleText active={c.condition === 'Baik'}>Baik</ToggleText>
                </Toggle>
                <Toggle active={c.condition === 'Tidak Baik'} onPress={() => updateChecklist(i, { condition: 'Tidak Baik' })}>
                  <ToggleText active={c.condition === 'Tidak Baik'}>Tidak Baik</ToggleText>
                </Toggle>
              </ButtonRow>
              {c.condition === 'Tidak Baik' && (
                <>
                  <Label>Alasan:</Label>
                  <Input
                    value={c.alasan}
                    onChangeText={t => updateChecklist(i, { alasan: t })}
                    placeholder="Jelaskan masalah"
                    multiline
                    // bantu scroll supaya fokus field ini naik saat keyboard muncul
                    textAlignVertical="top"
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

        {/* FORM TAMBAHAN */}
        <Card>
          <Label>Kondisi Umum:</Label>
          <Input value={kondisi} onChangeText={setKondisi} placeholder="Masukkan kondisi umum" />
          <Label>Catatan Masalah:</Label>
          <Input value={catatanMasalah} onChangeText={setCatatanMasalah} placeholder="Masukkan catatan masalah" multiline />
          <Label>Rekomendasi:</Label>
          <Input value={rekomendasi} onChangeText={setRekomendasi} placeholder="Masukkan rekomendasi" multiline />
          <Label>Tindak Lanjut:</Label>
          <Input value={tindakLanjut} onChangeText={setTindakLanjut} placeholder="Masukkan tindak lanjut" multiline />
          <Label>Tekanan (bar):</Label>
          <Input value={tekanan} onChangeText={setTekanan} placeholder="Masukkan tekanan" keyboardType="numeric" />
          <Label>Jumlah Masalah:</Label>
          <Input value={jumlahMasalah} onChangeText={setJumlahMasalah} placeholder="Masukkan jumlah masalah" keyboardType="numeric" />
        </Card>

        <SubmitButton disabled={submitting} onPress={handleSubmit}>
          {submitting ? <ActivityIndicator color="#fff" /> : <SubmitText>Simpan Maintenance</SubmitText>}
        </SubmitButton>

        {/* spacer tambahan agar tombol tidak ketindih keyboard di device kecil */}
        <View style={{ height: (insets?.bottom ?? 0) + 16 }} />
      </ScrollContainer>
    </KeyboardAvoidingView>
  );
}

// ========== STYLED ==========
const Centered = styled(View)` flex: 1; justify-content: center; align-items: center; padding: 20px; `;
const ScrollContainer = styled(ScrollView)` flex: 1; background-color: #f9fafb; `;
const Card = styled(View)` background: #fff; margin: 12px 16px; padding: 16px; border-radius: 8px; elevation: 2; `;
const Label = styled(Text)` font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 8px; margin-top: 4px; `;
const ReadOnlyInput = styled(TextInput).attrs({
  editable: false,
  placeholderTextColor: '#9CA3AF',
})`
  background: #f3f4f6;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  color: #6b7280;
  font-size: 14px;
`;
const Input = styled(TextInput).attrs({
  placeholderTextColor: '#9CA3AF',
  selectionColor: '#dc2626',
  cursorColor: '#dc2626',
})`
  background: #fff;
  border: 1px solid #d1d5db;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  color: #111827;
`;
const QuestionText = styled(Text)` font-size: 15px; font-weight: 500; color: #374151; margin-bottom: 8px; `;
const ButtonRow = styled(View)` flex-direction: row; margin-bottom: 12px; justify-content: space-between; `;
const Toggle = styled(Pressable)<{ active: boolean }>`
  flex: 1;
  background-color: ${({ active }) => (active ? '#dc2626' : '#f3f4f6')};
  padding: 12px;
  border-radius: 6px;
  align-items: center;
  margin-horizontal: 4px;
  border-width: 1px;
  border-color: ${({ active }) => (active ? '#dc2626' : '#d1d5db')};
`;
const ToggleText = styled(Text)<{ active: boolean }>` color: ${({ active }) => (active ? '#fff' : '#6b7280')}; font-weight: 600; font-size: 14px; `;
const uploadStyle = { backgroundColor: '#f3f4f6', padding: 16, borderRadius: 6, alignItems: 'center', marginBottom: 12, borderWidth: 2, borderColor: '#d1d5db', borderStyle: 'dashed', } as const;
const SubmitButton = styled(Pressable)<{ disabled?: boolean }>` background-color: ${({ disabled }) => (disabled ? '#9ca3af' : '#dc2626')}; padding: 16px; margin: 20px 16px 0; border-radius: 8px; align-items: center; `;
const SubmitText = styled(Text)` color: #fff; font-size: 16px; font-weight: bold; `;
