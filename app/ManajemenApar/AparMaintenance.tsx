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

const DUMMY_ID = '214';
const BASE_URL = Platform.OS === 'android'
  ? 'http://10.0.2.2:3000'
  : 'http://localhost:3000';

type ChecklistItemState = {
  checklistId?: number;
  item: string;
  condition: 'Baik' | 'Tidak Baik' | null;
  alasan?: string;
};

export default function AparMaintenance() {
  const navigation = useNavigation();
  const { badgeNumber } = useBadge();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
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
      try {
        // 1) Fetch the APAR + checklist JSON
        const res = await fetch(
          `${BASE_URL}/api/peralatan/with-checklist?id=${DUMMY_ID}`
        );
        const [aparData] = await res.json();
        if (!aparData) {
          Alert.alert('Data tidak ditemukan');
          return;
        }
        setData(aparData);

        // 2) Parse keperluan_check (could be: ["q1","q2"] or [{question,checklistId},…] or [{Pertanyaan,Id},…])
        const raw = aparData.keperluan_check;
        let arr: any[] = [];
        if (typeof raw === 'string') {
          try {
            arr = JSON.parse(raw);
          } catch {
            arr = [];
          }
        } else if (Array.isArray(raw)) {
          arr = raw;
        }

        setChecklistStates(
          arr.map((o) => {
            // if it's already an object with a question field
            if (o && typeof o === 'object') {
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
            }
            // fallback if it's just a string
            return {
              item: String(o),
              condition: null,
              alasan: ''
            };
          })
        );

        // 3) Show the petugas’s interval label (from the joined IntervalPetugas)
        if (aparData.namaIntervalPetugas) {
          setIntervalLabel(
            `${aparData.namaIntervalPetugas} (${aparData.bulanIntervalPetugas} bln)`
          );
        }
      } catch (err) {
        console.error(err);
        Alert.alert('Gagal ambil data dari server');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

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
      quality: 0.5
    });
    if (!result.canceled) {
      setFotoPemeriksaan((p) => [...p, result.assets[0].uri]);
    }
  };

  const handleSubmit = async () => {
    if (!badgeNumber) {
      return Alert.alert('Badge tidak tersedia');
    }

    // Validate every checklist has a condition (and alasan if needed)
    for (const c of checklistStates) {
      if (!c.condition || (c.condition === 'Tidak Baik' && !c.alasan)) {
        return Alert.alert('Lengkapi semua checklist');
      }
    }

    // Prepare form data
    const formData = new FormData();
    formData.append('aparId', DUMMY_ID);
    formData.append('tanggal', new Date().toISOString());
    formData.append('badgeNumber', badgeNumber);
    formData.append(
      'intervalPetugasId',
      String(data.intervalPetugasId)
    );
    formData.append('kondisi', kondisi);
    formData.append('catatanMasalah', catatanMasalah);
    formData.append('rekomendasi', rekomendasi);
    formData.append('tindakLanjut', tindakLanjut);
    formData.append('tekanan', tekanan);
    formData.append('jumlahMasalah', jumlahMasalah);

    // Checklist answers
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

    // Photos
    fotoPemeriksaan.forEach((uri, idx) => {
      const name = uri.split('/').pop() || `photo${idx}.jpg`;
      formData.append('fotos', {
        uri,
        name,
        type: 'image/jpeg'
      } as any);
    });

    try {
      const res = await fetch(
        `${BASE_URL}/api/perawatan/submit`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.message || 'Server error');
      }
      Alert.alert('Sukses', result.message, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err: any) {
      console.error('Gagal kirim data:', err);
      Alert.alert('Error', err.message);
    }
  };

  if (loading) {
    return (
      <Centered>
        <ActivityIndicator size="large" color="#d50000" />
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
          <Label>No FE</Label>
          <ReadOnlyInput value={data.no_apar} />
          <Label>Lokasi</Label>
          <ReadOnlyInput value={data.lokasi_apar} />
          <Label>Jenis</Label>
          <ReadOnlyInput value={data.jenis_apar} />
        </Card>

        {/* Interval (read-only) */}
        <Card>
          <Label>Jenis Inspeksi</Label>
          <ReadOnlyInput value={intervalLabel} />
        </Card>

        {/* Hasil */}
        <Card>
          <Label>Kondisi</Label>
          <Input
            placeholder="Contoh: Baik"
            value={kondisi}
            onChangeText={setKondisi}
          />
          <Label>Catatan Masalah</Label>
          <Input
            placeholder="…"
            value={catatanMasalah}
            onChangeText={setCatatanMasalah}
          />
          <Label>Rekomendasi</Label>
          <Input
            placeholder="…"
            value={rekomendasi}
            onChangeText={setRekomendasi}
          />
          <Label>Tindak Lanjut</Label>
          <Input
            placeholder="…"
            value={tindakLanjut}
            onChangeText={setTindakLanjut}
          />
          <Label>Tekanan</Label>
          <Input
            placeholder="Contoh: 12.3"
            keyboardType="numeric"
            value={tekanan}
            onChangeText={setTekanan}
          />
          <Label>Jumlah Masalah</Label>
          <Input
            placeholder="Contoh: 2"
            keyboardType="numeric"
            value={jumlahMasalah}
            onChangeText={setJumlahMasalah}
          />
        </Card>

        {/* Checklist */}
        <Card>
          <Label>Checklist</Label>
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
                    Baik
                  </ToggleText>
                </ToggleButton>
                <ToggleButton
                  active={c.condition === 'Tidak Baik'}
                  onPress={() =>
                    updateChecklist(idx, { condition: 'Tidak Baik' })
                  }
                >
                  <ToggleText active={c.condition === 'Tidak Baik'}>
                    Tidak Baik
                  </ToggleText>
                </ToggleButton>
              </ButtonRow>
              {c.condition === 'Tidak Baik' && (
                <Input
                  placeholder="Masukkan alasan"
                  value={c.alasan}
                  onChangeText={(t) =>
                    updateChecklist(idx, { alasan: t })
                  }
                />
              )}
            </Fragment>
          ))}
        </Card>

        {/* Foto Pemeriksaan */}
        <Card>
          <Label>Foto Pemeriksaan</Label>
          <Pressable style={uploadStyle} onPress={pickImages}>
            <Text>Unggah Foto</Text>
          </Pressable>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {fotoPemeriksaan.map((uri, i) => (
              <Image
                key={i}
                source={{ uri }}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 6,
                  marginRight: 8
                }}
              />
            ))}
          </ScrollView>
        </Card>

        <SubmitButton onPress={handleSubmit}>
          <SubmitText>Simpan Perawatan</SubmitText>
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
`;

const ScrollContainer = styled(ScrollView)`
  flex: 1;
  background-color: #f9fafb;
  padding-bottom: 40px;
`;

const Card = styled(View)`
  background: #fff;
  margin: 12px 16px;
  padding: 16px;
  border-radius: 8px;
  elevation: 1;
`;

const Label = styled(Text)`
  font-size: 14px;
  color: #555;
  margin-bottom: 8px;
`;

const ReadOnlyInput = styled(TextInput).attrs({
  editable: false
})`
  background: #eee;
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 12px;
  color: #333;
`;

const Input = styled(TextInput)`
  background: #fff;
  border: 1px solid #ddd;
  padding: 10px;
  border-radius: 6px;
  margin-bottom: 12px;
  color: #333;
`;

const QuestionText = styled(Text)`
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 8px;
`;

const ButtonRow = styled(View)`
  flex-direction: row;
  margin-bottom: 12px;
`;

const ToggleButton = styled(Pressable)<{ active: boolean }>`
  flex: 1;
  background-color: ${({ active }) => (active ? '#d50000' : '#eee')};
  padding: 10px;
  border-radius: 6px;
  align-items: center;
  margin-right: ${({ active }) => (active ? '0' : '8px')};
`;

const ToggleText = styled(Text)<{ active: boolean }>`
  color: ${({ active }) => (active ? '#fff' : '#333')};
  font-weight: 500;
`;

const uploadStyle = {
  backgroundColor: '#eee',
  padding: 10,
  borderRadius: 6,
  alignItems: 'center',
  marginBottom: 12
};

const SubmitButton = styled(Pressable)`
  background: #d50000;
  padding: 16px;
  margin: 20px 16px;
  border-radius: 8px;
  align-items: center;
`;

const SubmitText = styled(Text)`
  color: #fff;
  font-size: 16px;
  font-weight: bold;
`;
