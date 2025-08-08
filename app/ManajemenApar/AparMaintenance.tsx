import { useBadge } from '@/context/BadgeContext';
import { baseUrl as configBaseUrl } from '@/src/config';
import { enqueueRequest } from '@/utils/ManajemenOffline';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  last_inspection_date?: string | null;
  nextDueDate?: string | null;
  keperluan_check: any;
};

export default function AparMaintenance() {
  const navigation = useNavigation();
  const route = useRoute();
  const { badgeNumber } = useBadge();

  // Determine API base URL
  const apiBaseUrl = Platform.OS === 'android'
    ? 'http://10.0.2.2:3000'
    : configBaseUrl;

  // Params: either id from card tap or token from QR scan
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
  const [fotoPemeriksaan, setFotoPemeriksaan] = useState<string[]>([]);
  const [intervalLabel, setIntervalLabel] = useState('—');
  const [kondisi, setKondisi] = useState('');
  const [catatanMasalah, setCatatanMasalah] = useState('');
  const [rekomendasi, setRekomendasi] = useState('');
  const [tindakLanjut, setTindakLanjut] = useState('');
  const [tekanan, setTekanan] = useState('');
  const [jumlahMasalah, setJumlahMasalah] = useState('');

  // Init data & checklist state
  const initApar = (apar: AparData) => {
    console.debug('[AparMaintenance] initApar', apar);
    setData(apar);
    let arr: any[] = [];
    if (typeof apar.keperluan_check === 'string') {
      try { arr = JSON.parse(apar.keperluan_check); } catch { arr = []; }
    } else if (Array.isArray(apar.keperluan_check)) {
      arr = apar.keperluan_check;
    }
    setChecklistStates(
      arr.map(o => {
        const question =
          typeof o.question === 'string' ? o.question :
          typeof o.Pertanyaan === 'string' ? o.Pertanyaan :
          '(no question)';
        const checklistId =
          typeof o.checklistId === 'number' ? o.checklistId :
          typeof o.Id === 'number' ? o.Id :
          undefined;
        return { checklistId, item: question, condition: null, alasan: '' };
      })
    );
    if (apar.namaIntervalPetugas && apar.bulanIntervalPetugas) {
      setIntervalLabel(
        `${apar.namaIntervalPetugas} (${apar.bulanIntervalPetugas} bulan)`
      );
    } else {
      setIntervalLabel(
        `Default (${apar.defaultIntervalBulan ?? '-'} bulan)`
      );
    }
  };

  // Fetch detail
  useEffect(() => {
    (async () => {
      if (!keyParam) {
        Alert.alert('Error', 'ID atau Token QR tidak tersedia');
        setLoading(false);
        return;
      }
      setLoading(true);
      const url = `${apiBaseUrl}/api/peralatan/with-checklist?${keyParam}&badge=${encodeURIComponent(badgeNumber||'')}`;
      console.log('[AparMaintenance] fetch URL:', url);
      try {
        const res = await fetch(url);
        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`HTTP ${res.status}: ${txt}`);
        }
        const aparData: AparData = await res.json();
        initApar(aparData);
        await AsyncStorage.setItem(
          `APAR_DETAIL_${params.id||params.token}`,
          JSON.stringify(aparData)
        );
      } catch (err: any) {
        console.warn('[AparMaintenance] fetch failed:', err);
        const cached = await AsyncStorage.getItem(`APAR_DETAIL_${params.id||params.token}`);
        if (cached) {
          initApar(JSON.parse(cached));
          Alert.alert('Offline Mode','Menampilkan data dari cache.');
        } else {
          Alert.alert('Error','Gagal mengambil data: '+err.message);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [badgeNumber, keyParam]);

  const updateChecklist = (index: number, changes: Partial<ChecklistItemState>) => {
    setChecklistStates(s => s.map((x,i) => i===index ? {...x, ...changes} : x));
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
    });
    if (!result.canceled) {
      console.debug('[AparMaintenance] picked image:', result.assets[0].uri);
      setFotoPemeriksaan(prev => [...prev, result.assets[0].uri]);
    }
  };

  const handleSubmit = async () => {
    if (!badgeNumber || !data) {
      Alert.alert('Error','Data tidak lengkap');
      return;
    }
    for (const c of checklistStates) {
      if (!c.condition || (c.condition==='Tidak Baik' && !c.alasan)) {
        Alert.alert('Validasi','Lengkapi semua checklist dan alasan jika perlu');
        return;
      }
    }
    console.log('[AparMaintenance] submitting form');
    setSubmitting(true);
    try {
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
      formData.append('checklist', JSON.stringify(
        checklistStates.map(c => ({ checklistId: c.checklistId, condition: c.condition, alasan: c.alasan||'' }))
      ));
      fotoPemeriksaan.forEach((uri, idx) => {
        const ext = uri.split('.').pop() || 'jpg';
        formData.append('fotos', { uri, name: `photo${idx}.${ext}`, type: `image/${ext}` } as any);
      });
      const postUrl = `${apiBaseUrl}/api/perawatan/submit`;
      console.log('[AparMaintenance] POST to', postUrl);
      const res = await fetch(postUrl, {
        method: 'POST',
        body: formData,
        headers: { 'Content-Type':'multipart/form-data' }
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || `HTTP ${res.status}`);
      }
      Alert.alert('Berhasil','Maintenance sudah terkirim.',[
        { text:'OK', onPress:() => navigation.goBack() }
      ]);
    } catch (err: any) {
      console.error('[AparMaintenance] submit failed:', err);
      if (/Network request failed/.test(err.message)) {
        await enqueueRequest({
          method:'POST', url:`${apiBaseUrl}/api/perawatan/submit`,
          body:{ aparId:String(data.id_apar), tanggal:new Date().toISOString(), badgeNumber,
            intervalPetugasId:data.intervalPetugasId, kondisi, catatanMasalah, rekomendasi,
            tindakLanjut, tekanan, jumlahMasalah,
            checklist: checklistStates.map(c=>({ checklistId:c.checklistId, condition:c.condition, alasan:c.alasan||'' })),
            fotos: fotoPemeriksaan.map((uri,idx)=>({ uri, name:`photo${idx}.${uri.split('.').pop()}`, type:`image/${uri.split('.').pop()}` }))
          },
          isMultipart:true
        });
        Alert.alert('📴 Offline','Data tersimpan lokal, akan dikirim saat online',[
          { text:'OK', onPress:() => navigation.goBack() }
        ]);
      } else {
        Alert.alert('Error','Gagal menyimpan: '+err.message);
      }
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
    <KeyboardAvoidingView behavior={Platform.OS==='ios'?'padding':undefined} style={{ flex:1 }}>
      <ScrollContainer>
        <Card>
          <Label>No APAR:</Label>
          <ReadOnlyInput value={data.no_apar} />
          <Label>Lokasi:</Label>
          <ReadOnlyInput value={data.lokasi_apar} />
          <Label>Jenis APAR:</Label>
          <ReadOnlyInput value={data.jenis_apar} />
          <Label>Interval:</Label>
          <ReadOnlyInput value={intervalLabel} />
          <Label>Next Due:</Label>
          <ReadOnlyInput value={data.nextDueDate ?? '—'} />
        </Card>

        <Card>
          <Label>Checklist Pemeriksaan:</Label>
          {checklistStates.map((c, i) => (
            <View key={i} style={{ marginBottom: 16 }}>
              <QuestionText>{c.item}</QuestionText>
              <ButtonRow>
                <ToggleButton active={c.condition==='Baik'} onPress={()=>updateChecklist(i,{condition:'Baik'})}>
                  <ToggleText active={c.condition==='Baik'}>Baik</ToggleText>
                </ToggleButton>
                <ToggleButton active={c.condition==='Tidak Baik'} onPress={()=>updateChecklist(i,{condition:'Tidak Baik'})}>
                  <ToggleText active={c.condition==='Tidak Baik'}>Tidak Baik</ToggleText>
                </ToggleButton>
              </ButtonRow>
              {c.condition==='Tidak Baik' && (
                <>
                  <Label>Alasan:</Label>
                  <Input value={c.alasan} onChangeText={t=>updateChecklist(i,{alasan:t})} placeholder="Jelaskan masalah" multiline />
                </>
              )}
            </View>
          ))}
        </Card>

        <Card>
          <Label>Foto Pemeriksaan:</Label>
          <Pressable style={uploadStyle} onPress={pickImages}>
            <Text>Tap untuk pilih foto…</Text>
          </Pressable>
          {fotoPemeriksaan.map((uri,idx) => (
            <Image key={idx} source={{uri}} style={{width:100,height:100,marginBottom:8}} />
          ))}
        </Card>

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
          {submitting
            ? <ActivityIndicator color="#fff" />
            : <SubmitText>Simpan Maintenance</SubmitText>
          }
        </SubmitButton>
      </ScrollContainer>
    </KeyboardAvoidingView>
  );
}

// Styled Components
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
`;
const QuestionText = styled(Text)`
  font-size: 15px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 8px;
`;
const ButtonRow = styled(View)`
  flex-direction: row;
  margin-bottom: 12px;
  justify-content: space-between;
`;
const ToggleButton = styled(Pressable)<{ active: boolean }>`
  flex: 1;
  background-color: ${({ active }) => (active ? '#dc2626' : '#f3f4f6')};
  padding: 12px;
  border-radius: 6px;
  align-items: center;
  border-width: 1px;
  border-color: ${({ active }) => (active ? '#dc2626' : '#d1d5db')};
  margin-horizontal: 4px;
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
  borderStyle: 'dashed',
};
const SubmitButton = styled(Pressable)<{ disabled?: boolean }>`
  background-color: ${({ disabled }) => (disabled ? '#9ca3af' : '#dc2626')};
  padding: 16px;
  margin: 20px 16px 0px;
  border-radius: 8px;
  align-items: center;
`;
const SubmitText = styled(Text)`
  color: #fff;
  font-size: 16px;
  font-weight: bold;
`;
