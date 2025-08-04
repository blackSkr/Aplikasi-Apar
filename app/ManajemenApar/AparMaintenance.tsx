import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { Fragment, useEffect, useState } from 'react';
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
  View
} from 'react-native';
import styled from 'styled-components/native';
import { useBadge } from '../../context/BadgeContext';

const DUMMY_ID = '8';
const BASE_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:3000'
  : 'http://localhost:3000';

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
  const navigation = useNavigation();
  const { badgeNumber } = useBadge();

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

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        console.log('--- DEBUG FETCH ---');
        console.log('Badge FE:', badgeNumber);
        console.log('URL FETCH:', `${BASE_URL}/api/peralatan/with-checklist?id=${DUMMY_ID}&badge=${encodeURIComponent(badgeNumber || '')}`);
        const res = await fetch(
          `${BASE_URL}/api/peralatan/with-checklist?id=${DUMMY_ID}&badge=${encodeURIComponent(badgeNumber || '')}`
        );
        if (!res.ok) {
          const text = await res.text();
          console.log('BAD RESPONSE:', text);
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const aparData = await res.json();
        console.log('APAR DATA:', aparData);

        if (!aparData) {
          Alert.alert('Error', 'Data peralatan tidak ditemukan');
          return;
        }

        setData(aparData);

        // Parse checklist
        let arr: any[] = [];
        const raw = aparData.keperluan_check;
        if (typeof raw === 'string') {
          try {
            arr = JSON.parse(raw);
          } catch (e) {
            console.log('Checklist PARSE ERROR:', e, raw);
            arr = [];
          }
        } else if (Array.isArray(raw)) {
          arr = raw;
        }
        console.log('Checklist Parsed:', arr);

        setChecklistStates(
          arr.map((o) => {
            const question =
              typeof o.question === 'string'
                ? o.question
                : typeof o.Pertanyaan === 'string'
                ? o.Pertanyaan
                : '';
            const checklistId =
              typeof o.checklistId === 'number'
                ? o.checklistId
                : typeof o.Id === 'number'
                ? o.Id
                : undefined;
            return {
              checklistId,
              item: question,
              condition: null,
              alasan: ''
            };
          })
        );

        // Interval label
        if (aparData.namaIntervalPetugas && aparData.bulanIntervalPetugas) {
          setIntervalLabel(
            `${aparData.namaIntervalPetugas} (${aparData.bulanIntervalPetugas} bulan)`
          );
        } else {
          setIntervalLabel(`Default (${aparData.defaultIntervalBulan ?? '-'} bulan)`);
        }

      } catch (err) {
        console.error('❌ Error fetching data:', err);
        Alert.alert('Error', 'Gagal mengambil data dari server: ' + (err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, [badgeNumber]);

  const updateChecklist = (
    index: number,
    changes: Partial<ChecklistItemState>
  ) => {
    setChecklistStates((states) =>
      states.map((s, i) => (i === index ? { ...s, ...changes } : s))
    );
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      allowsMultipleSelection: false
    });
    if (!result.canceled) {
      setFotoPemeriksaan((prev) => [...prev, result.assets[0].uri]);
      console.log('Picked Images:', result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!badgeNumber || !data) {
      return Alert.alert('Error', 'Badge atau data peralatan tidak tersedia');
    }

    // Validate checklist
    for (const c of checklistStates) {
      if (!c.condition || (c.condition === 'Tidak Baik' && !c.alasan)) {
        return Alert.alert('Validasi', 'Mohon lengkapi semua checklist dan alasan jika ada kondisi tidak baik');
      }
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('aparId', String(data.id_apar));
      formData.append('tanggal', new Date().toISOString());
      formData.append('badgeNumber', badgeNumber);

      if (data.intervalPetugasId !== undefined && data.intervalPetugasId !== null) {
        formData.append('intervalPetugasId', String(data.intervalPetugasId));
      }

      formData.append('kondisi', kondisi);
      formData.append('catatanMasalah', catatanMasalah);
      formData.append('rekomendasi', rekomendasi);
      formData.append('tindakLanjut', tindakLanjut);
      formData.append('tekanan', tekanan);
      formData.append('jumlahMasalah', jumlahMasalah);

      formData.append(
        'checklist',
        JSON.stringify(
          checklistStates.map((c) => ({
            checklistId: c.checklistId,
            condition: c.condition,
            alasan: c.alasan || ''
          }))
        )
      );

      fotoPemeriksaan.forEach((uri, idx) => {
        let fileType = uri.split('.').pop();
        let name = `photo${idx}.${fileType || 'jpg'}`;
        formData.append('fotos', {
          uri,
          name,
          type: `image/${fileType || 'jpeg'}`
        } as any);
      });

      // DEBUG: Print FormData (stringify)
      for (let pair of (formData as any)._parts || []) {
        console.log('FORMDATA PART:', pair[0], pair[1]);
      }

      console.log('--- SUBMIT TO:', `${BASE_URL}/api/perawatan/submit`);

      const res = await fetch(`${BASE_URL}/api/perawatan/submit`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      const result = await res.json();
      console.log('SUBMIT RESPONSE:', result);

      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Server error');
      }

      Alert.alert(
        'Berhasil',
        'Maintenance berhasil disimpan!',
        [
          { text: 'OK', onPress: () => navigation.goBack() }
        ]
      );

    } catch (err: any) {
      console.error('❌ Error submit maintenance:', err);
      Alert.alert('Error', 'Gagal menyimpan data: ' + err.message);
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
        {/* APAR Info */}
        <Card>
          <Label>No APAR</Label>
          <ReadOnlyInput value={data.no_apar} />
          <Label>Lokasi</Label>
          <ReadOnlyInput value={data.lokasi_apar} />
          <Label>Jenis</Label>
          <ReadOnlyInput value={data.jenis_apar} />
        </Card>

        {/* Interval Info */}
        <Card>
          <Label>Jenis Inspeksi</Label>
          <ReadOnlyInput value={intervalLabel} />
          {data.last_inspection_date && (
            <>
              <Label>Inspeksi Terakhir</Label>
              <ReadOnlyInput
                value={new Date(data.last_inspection_date).toLocaleDateString('id-ID')}
              />
            </>
          )}
          {data.nextDueDate && (
            <>
              <Label>Target Inspeksi Berikutnya</Label>
              <ReadOnlyInput
                value={new Date(data.nextDueDate).toLocaleDateString('id-ID')}
              />
            </>
          )}
        </Card>

        {/* Hasil Pemeriksaan */}
        <Card>
          <Label>Kondisi Umum</Label>
          <Input
            placeholder="Contoh: Baik, Perlu Perhatian, Rusak"
            value={kondisi}
            onChangeText={setKondisi}
          />
          <Label>Catatan Masalah</Label>
          <Input
            placeholder="Deskripsikan masalah yang ditemukan..."
            value={catatanMasalah}
            onChangeText={setCatatanMasalah}
            multiline
            numberOfLines={3}
          />
          <Label>Rekomendasi</Label>
          <Input
            placeholder="Saran tindakan yang perlu dilakukan..."
            value={rekomendasi}
            onChangeText={setRekomendasi}
            multiline
            numberOfLines={3}
          />
          <Label>Tindak Lanjut</Label>
          <Input
            placeholder="Rencana tindak lanjut..."
            value={tindakLanjut}
            onChangeText={setTindakLanjut}
            multiline
            numberOfLines={2}
          />
          <Label>Tekanan (bar)</Label>
          <Input
            placeholder="Contoh: 12.5"
            keyboardType="numeric"
            value={tekanan}
            onChangeText={setTekanan}
          />
          <Label>Jumlah Masalah</Label>
          <Input
            placeholder="Contoh: 0, 1, 2"
            keyboardType="numeric"
            value={jumlahMasalah}
            onChangeText={setJumlahMasalah}
          />
        </Card>

        {/* Checklist */}
        {checklistStates.length > 0 && (
          <Card>
            <Label>Checklist Pemeriksaan</Label>
            {checklistStates.map((c, idx) => (
              <Fragment key={idx}>
                <QuestionText>{c.item}</QuestionText>
                <ButtonRow>
                  <ToggleButton
                    active={c.condition === 'Baik'}
                    onPress={() =>
                      updateChecklist(idx, { condition: 'Baik', alasan: '' })
                    }
                  >
                    <ToggleText active={c.condition === 'Baik'}>
                      ✓ Baik
                    </ToggleText>
                  </ToggleButton>
                  <ToggleButton
                    active={c.condition === 'Tidak Baik'}
                    onPress={() =>
                      updateChecklist(idx, { condition: 'Tidak Baik' })
                    }
                  >
                    <ToggleText active={c.condition === 'Tidak Baik'}>
                      ✗ Tidak Baik
                    </ToggleText>
                  </ToggleButton>
                </ButtonRow>
                {c.condition === 'Tidak Baik' && (
                  <Input
                    placeholder="Jelaskan alasan kondisi tidak baik..."
                    value={c.alasan}
                    onChangeText={(t) =>
                      updateChecklist(idx, { alasan: t })
                    }
                    multiline
                    numberOfLines={2}
                  />
                )}
              </Fragment>
            ))}
          </Card>
        )}

        {/* Foto Pemeriksaan */}
        <Card>
          <Label>Foto Pemeriksaan</Label>
          <Pressable style={uploadStyle} onPress={pickImages}>
            <Text style={{ color: '#666' }}>📷 Tambah Foto</Text>
          </Pressable>
          {fotoPemeriksaan.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginTop: 12 }}
            >
              {fotoPemeriksaan.map((uri, i) => (
                <View key={i} style={{ marginRight: 8 }}>
                  <Image
                    source={{ uri }}
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 6
                    }}
                  />
                  <Pressable
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      backgroundColor: 'rgba(0,0,0,0.6)',
                      borderRadius: 12,
                      width: 24,
                      height: 24,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onPress={() => {
                      setFotoPemeriksaan(prev => prev.filter((_, idx) => idx !== i));
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 16 }}>×</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </Card>

        <SubmitButton onPress={handleSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <SubmitText>💾 Simpan Perawatan</SubmitText>
          )}
        </SubmitButton>
        
        <View style={{ height: 40 }} />
      </ScrollContainer>
    </KeyboardAvoidingView>
  );
}

// --- Styled Components sama seperti kode kamu ---
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

const ReadOnlyInput = styled(TextInput).attrs({
  editable: false
})`
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
