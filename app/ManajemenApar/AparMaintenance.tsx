//app/ManajemenApar/AparMaintenance.tsx
import { useBadge } from '@/context/BadgeContext';
import { enqueueRequest } from '@/utils/ManajemenOffline';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View
} from 'react-native';
import styled from 'styled-components/native';
import { baseUrl } from '../../src/config';

type ChecklistItemState = {
  checklistId?: number;
  item: string;
  condition: 'Baik' | 'Tidak Baik' | null;
  alasan?: string;
};

type AparData = {
  id_apar: number;
  no_apar: string;
  lokasi_apar: string;
  jenis_apar: string;
  current_petugas_id: number;
  intervalPetugasId: number | null;
  namaIntervalPetugas?: string;
  bulanIntervalPetugas?: number;
  defaultIntervalBulan?: number;
  interval_maintenance?: number;
  last_inspection_date?: string | null;
  nextDueDate?: string | null;
  keperluan_check: any;
};

export default function AparMaintenance() {
  const navigation    = useNavigation();
  const route         = useRoute();
  const { badgeNumber } = useBadge();
  const aparId        = (route.params as any)?.id;

  const [loading, setLoading]               = useState(true);
  const [submitting, setSubmitting]         = useState(false);
  const [data, setData]                     = useState<AparData | null>(null);
  const [checklistStates, setChecklistStates] = useState<ChecklistItemState[]>([]);
  const [fotoPemeriksaan, setFotoPemeriksaan] = useState<string[]>([]);
  const [intervalLabel, setIntervalLabel]     = useState('—');
  const [kondisi, setKondisi]                 = useState('');
  const [catatanMasalah, setCatatanMasalah]   = useState('');
  const [rekomendasi, setRekomendasi]         = useState('');
  const [tindakLanjut, setTindakLanjut]       = useState('');
  const [tekanan, setTekanan]                 = useState('');
  const [jumlahMasalah, setJumlahMasalah]     = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const fetchUrl = `${baseUrl}/api/peralatan/with-checklist?id=${encodeURIComponent(aparId)}&badge=${encodeURIComponent(badgeNumber || '')}`;
        const res      = await fetch(fetchUrl);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }
        const aparData = await res.json();
        if (!aparData) {
          Alert.alert('Error', 'Data peralatan tidak ditemukan');
          return;
        }
        setData(aparData);
        await AsyncStorage.setItem(`APAR_DETAIL_${aparId}`, JSON.stringify(aparData));

        // parse checklist
        let arr: any[] = [];
        const raw = aparData.keperluan_check;
        if (typeof raw === 'string') {
          try { arr = JSON.parse(raw); } catch { arr = []; }
        } else if (Array.isArray(raw)) {
          arr = raw;
        }
        setChecklistStates(arr.map(o => {
          const question = typeof o.question === 'string'
            ? o.question
            : typeof o.Pertanyaan === 'string'
            ? o.Pertanyaan
            : '';
          const checklistId = typeof o.checklistId === 'number'
            ? o.checklistId
            : typeof o.Id === 'number'
            ? o.Id
            : undefined;
          return { checklistId, item: question, condition: null, alasan: '' };
        }));

        // interval label
        if (aparData.namaIntervalPetugas && aparData.bulanIntervalPetugas) {
          setIntervalLabel(`${aparData.namaIntervalPetugas} (${aparData.bulanIntervalPetugas} bulan)`);
        } else {
          setIntervalLabel(`Default (${aparData.defaultIntervalBulan ?? '-'} bulan)`);
        }
      } catch (err: any) {
        const cached = await AsyncStorage.getItem(`APAR_DETAIL_${aparId}`);
        if (cached) {
          const aparData = JSON.parse(cached);
          setData(aparData);
          Alert.alert('Offline Mode', 'Menampilkan data dari cache.');
          // parse checklist & label sama seperti di atas…
        } else {
          Alert.alert('Error', 'Gagal mengambil data: ' + err.message);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [badgeNumber, aparId]);

  const updateChecklist = (index: number, changes: Partial<ChecklistItemState>) => {
    setChecklistStates(s => s.map((x,i) => i === index ? { ...x, ...changes } : x));
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      allowsMultipleSelection: false,
    });
    if (!result.canceled) {
      setFotoPemeriksaan(prev => [...prev, result.assets[0].uri]);
    }
  };

  const handleSubmit = async () => {
    if (!badgeNumber || !data) return Alert.alert('Error', 'Data tidak lengkap');
    for (const c of checklistStates) {
      if (!c.condition || (c.condition === 'Tidak Baik' && !c.alasan)) {
        return Alert.alert('Validasi', 'Mohon lengkapi semua checklist dan alasan jika perlu');
      }
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('aparId', String(data.id_apar));
      formData.append('tanggal', new Date().toISOString());
      formData.append('badgeNumber', badgeNumber);
      if (data.intervalPetugasId !== null) {
        formData.append('intervalPetugasId', String(data.intervalPetugasId));
      }
      formData.append('kondisi', kondisi);
      formData.append('catatanMasalah', catatanMasalah);
      formData.append('rekomendasi', rekomendasi);
      formData.append('tindakLanjut', tindakLanjut);
      formData.append('tekanan', tekanan);
      formData.append('jumlahMasalah', jumlahMasalah);
      formData.append('checklist', JSON.stringify(
        checklistStates.map(c => ({
          checklistId: c.checklistId,
          condition: c.condition,
          alasan: c.alasan || ''
        }))
      ));
      fotoPemeriksaan.forEach((uri, idx) => {
        const fileType = uri.split('.').pop() ?? 'jpg';
        formData.append('fotos', {
          uri,
          name: `photo${idx}.${fileType}`,
          type: `image/${fileType}`
        } as any);
      });

      const res    = await fetch(`${baseUrl}/api/perawatan/submit`, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Server error');
      }
      Alert.alert('Berhasil', 'Maintenance berhasil disimpan!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err: any) {
      const offline = err.message.includes('Network request failed');
      if (offline) {
        await enqueueRequest({
          method: 'POST',
          url: `${baseUrl}/api/perawatan/submit`,
          body: {
            aparId: String(data.id_apar),
            tanggal: new Date().toISOString(),
            badgeNumber,
            intervalPetugasId: data.intervalPetugasId,
            kondisi,
            catatanMasalah,
            rekomendasi,
            tindakLanjut,
            tekanan,
            jumlahMasalah,
            checklist: checklistStates.map(c => ({
              checklistId: c.checklistId,
              condition: c.condition,
              alasan: c.alasan || ''
            })),
            fotos: fotoPemeriksaan.map((uri, idx) => {
              const fileType = uri.split('.').pop() ?? 'jpg';
              return { uri, name: `photo${idx}.${fileType}`, type: `image/${fileType}` };
            })
          },
          isMultipart: true,
        });
        Alert.alert('📴 Offline', 'Data disimpan lokal, akan dikirim saat online');
        navigation.goBack();
      } else {
        Alert.alert('Error', 'Gagal menyimpan: ' + err.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Centered>
        <ActivityIndicator size="large" color="#d50000" />
        <Text style={{ marginTop: 16, color: '#666' }}>Memuat data...</Text>
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollContainer>
        {/* …JSX form sama seperti sebelumnya… */}
      </ScrollContainer>
    </KeyboardAvoidingView>
  );
}

const Centered = styled(View)`
  flex: 1;
  justify-content: center;
  align-items: center;
  padding: 20px;
`;
const ScrollContainer = styled(ScrollView)`
  flex: 1;
  background-color: #f9fafb;
`;
const Card = styled(View)`
  background: #fff;
  margin: 12px 16px;
  padding: 16px;
  border-radius: 8px;
  elevation: 2;
  shadow-color: #000;
  shadow-offset: 0px 1px;
  shadow-opacity: 0.1;
  shadow-radius: 2px;
`;
const Label = styled(Text)`
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
  margin-top: 4px;
`;
const ReadOnlyInput = styled(TextInput).attrs({ editable: false })`
  background: #f3f4f6;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  color: #6b7280;
  font-size: 14px;
`;
const Input = styled(TextInput)`
  background: #fff;
  border: 1px solid #d1d5db;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  color: #111827;
  font-size: 14px;
`;
const QuestionText = styled(Text)`
  font-size: 15px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
  line-height: 22px;
`;
const ButtonRow = styled(View)`
  flex-direction: row;
  margin-bottom: 12px;
  gap: 8px;
`;
const ToggleButton = styled(Pressable)<{ active: boolean }>`
  flex: 1;
  background-color: ${({ active }) => (active ? '#dc2626' : '#f3f4f6')};
  padding: 12px;
  border-radius: 6px;
  align-items: center;
  border-width: 1px;
  border-color: ${({ active }) => (active ? '#dc2626' : '#d1d5db')};
`;
const ToggleText = styled(Text)<{ active: boolean }>`
  color: ${({ active }) => (active ? '#fff' : '#6b7280')};
  font-weight: 600;
  font-size: 14px;
`;
const uploadStyle = {
  backgroundColor: '#f3f4f6',
  padding: 16,
  borderRadius: 6,
  alignItems: 'center',
  marginBottom: 12,
  borderWidth: 2,
  borderColor: '#d1d5db',
  borderStyle: 'dashed'
};
const SubmitButton = styled(Pressable)<{ disabled?: boolean }>`
  background: ${({ disabled }) => disabled ? '#9ca3af' : '#dc2626'};
  padding: 16px;
  margin: 20px 16px 0px 16px;
  border-radius: 8px;
  align-items: center;
  elevation: 2;
  shadow-color: #000;
  shadow-offset: 0px 2px;
  shadow-opacity: 0.1;
  shadow-radius: 4px;
`;
const SubmitText = styled(Text)`
  color: #fff;
  font-size: 16px;
  font-weight: bold;
`;
