import { useNavigation } from '@react-navigation/native';
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
  View
} from 'react-native';
import styled from 'styled-components/native';
import { useBadge } from '../../context/BadgeContext';

const DUMMY_ID = 116;
const BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

type ChecklistItemState = {
  item: string;
  condition: 'Baik' | 'Tidak Baik' | null;
  alasan?: string;
};

const Container = styled(ScrollView)`flex: 1; background-color: #f9fafb;`;
const Section = styled(View)`background-color: #fff; margin: 16px; padding: 16px; border-radius: 12px; border: 1px solid #dde1e6;`;
const Label = styled(Text)`font-size: 14px; color: #4f4f4f; margin-bottom: 4px;`;
const Input = styled(TextInput)`background-color: #fff; border: 1px solid #dde1e6; border-radius: 8px; padding: 12px; font-size: 15px; color: #212121; margin-bottom: 12px;`;
const ReadOnlyInput = styled(Input).attrs({ editable: false })`background-color: #f0f0f0;`;
const ChecklistItemContainer = styled(View)`margin-bottom: 16px;`;
const ChecklistTitle = styled(Text)`font-size: 15px; font-weight: bold; margin-bottom: 10px;`;
const ConditionButtons = styled(View)`flex-direction: row; margin-bottom: 12px;`;
const ConditionButton = styled(Pressable)<{ active: boolean }>`
  background-color: ${({ active }) => (active ? '#d50000' : '#dde1e6')};
  padding: 10px 16px;
  border-radius: 8px;
  margin-right: 10px;
`;
const ConditionButtonText = styled(Text)<{ active: boolean }>`
  color: ${({ active }) => (active ? '#fff' : '#212121')};
  font-size: 14px;
`;
const Button = styled(Pressable)`background-color: #d50000; padding: 14px; border-radius: 8px; align-items: center; margin: 20px 16px;`;
const ButtonText = styled(Text)`color: #fff; font-weight: bold; font-size: 16px;`;

export default function AparMaintenance() {
  const [loading, setLoading] = useState(true);
  const [checklistStates, setChecklistStates] = useState<ChecklistItemState[]>([]);
  const [data, setData] = useState<any>(null);
  const [fotoPemeriksaan, setFotoPemeriksaan] = useState<string[]>([]);
  const navigation = useNavigation();
  const { badgeNumber } = useBadge();

  const [kondisi, setKondisi] = useState('');
  const [catatanMasalah, setCatatanMasalah] = useState('');
  const [rekomendasi, setRekomendasi] = useState('');
  const [tindakLanjut, setTindakLanjut] = useState('');
  const [tekanan, setTekanan] = useState('');
  const [jumlahMasalah, setJumlahMasalah] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/peralatan/with-checklist?id=${DUMMY_ID}`);
        const json = await res.json();
        const apar = json[0];

        if (!apar) {
          Alert.alert('Data tidak ditemukan');
          return;
        }

        setData(apar);

        const parsedChecklist = parseChecklist(apar.keperluan_check);

        setChecklistStates(parsedChecklist.map((item: string) => ({
          item,
          condition: null,
          alasan: '',
        })));
      } catch (err) {
        console.error('Gagal fetch:', err);
        Alert.alert('Gagal ambil data dari server');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const parseChecklist = (raw: any): string[] => {
    if (!raw) return [];

    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed.map((s) => String(s).trim()).filter(Boolean) : [];
    } catch {
      return typeof raw === 'string'
        ? raw.split(/[,;|]/).map((s) => s.trim()).filter(Boolean)
        : [];
    }
  };

  const updateChecklist = (index: number, changes: Partial<ChecklistItemState>) => {
    const updated = [...checklistStates];
    updated[index] = { ...updated[index], ...changes };
    setChecklistStates(updated);
  };

  const pickImages = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 0.5,
    });

    if (!result.canceled && result.assets.length > 0) {
      const newUri = result.assets[0].uri;
      setFotoPemeriksaan([...fotoPemeriksaan, newUri]);
    }
  };

  const handleSubmit = async () => {
    for (let i = 0; i < checklistStates.length; i++) {
      const c = checklistStates[i];
      if (!c.condition || (c.condition === 'Tidak Baik' && !c.alasan)) {
        Alert.alert('Validasi Gagal', `Lengkapi checklist: ${c.item}`);
        return;
      }
    }

    if (!data || !badgeNumber) {
      Alert.alert('Data tidak lengkap', 'Pastikan badge sudah diinput.');
      return;
    }

    const formData = new FormData();
    formData.append('aparId', DUMMY_ID.toString());
    formData.append('tanggal', new Date().toISOString());
    formData.append('checklist', JSON.stringify(checklistStates));

    formData.append('badgeNumber', badgeNumber);
    formData.append('kondisi', kondisi);
    formData.append('catatanMasalah', catatanMasalah);
    formData.append('rekomendasi', rekomendasi);
    formData.append('tindakLanjut', tindakLanjut);
    formData.append('tekanan', tekanan);
    formData.append('jumlahMasalah', jumlahMasalah);

    const aparCode = data?.no_apar ? data.no_apar.replace(/\s+/g, '_') : 'apar';
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);

    fotoPemeriksaan.forEach((uri, idx) => {
      const ext = uri.split('.').pop() || 'jpg';
      const filename = `FotoPemeriksaanAlat_${aparCode}_${timestamp}_${idx}.${ext}`;

      formData.append('fotos', {
        uri,
        name: filename,
        type: 'image/jpeg',
      } as any);
    });

    try {
      const res = await fetch(`${BASE_URL}/api/perawatan/submit`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const result = await res.json();
      if (result.success) {
        Alert.alert('Berhasil', 'Data berhasil dikirim', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Gagal', result.message || 'Server error');
      }
    } catch (err) {
      console.error('Gagal kirim data:', err);
      Alert.alert('Gagal', 'Tidak bisa mengirim data');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#d50000" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Container contentContainerStyle={{ paddingBottom: 100 }}>
        <Section>
          <Label>No FE</Label>
          <ReadOnlyInput value={data.no_apar} />
          <Label>Lokasi</Label>
          <ReadOnlyInput value={data.lokasi_apar} />
          <Label>Jenis</Label>
          <ReadOnlyInput value={data.jenis_apar} />
        </Section>

        <Section>
          <Label>Kondisi</Label>
          <Input placeholder="Contoh: Baik" value={kondisi} onChangeText={setKondisi} />
          <Label>Catatan Masalah</Label>
          <Input placeholder="..." value={catatanMasalah} onChangeText={setCatatanMasalah} />
          <Label>Rekomendasi</Label>
          <Input placeholder="..." value={rekomendasi} onChangeText={setRekomendasi} />
          <Label>Tindak Lanjut</Label>
          <Input placeholder="..." value={tindakLanjut} onChangeText={setTindakLanjut} />
          <Label>Tekanan</Label>
          <Input placeholder="Contoh: 12.3" keyboardType="numeric" value={tekanan} onChangeText={setTekanan} />
          <Label>Jumlah Masalah</Label>
          <Input placeholder="Contoh: 2" keyboardType="numeric" value={jumlahMasalah} onChangeText={setJumlahMasalah} />
        </Section>

        <Section>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16 }}>Checklist</Text>
          {checklistStates.map((check, index) => (
            <ChecklistItemContainer key={index}>
              <ChecklistTitle>{check.item}</ChecklistTitle>
              <ConditionButtons>
                <ConditionButton active={check.condition === 'Baik'} onPress={() => updateChecklist(index, { condition: 'Baik', alasan: '' })}>
                  <ConditionButtonText active={check.condition === 'Baik'}>Baik</ConditionButtonText>
                </ConditionButton>
                <ConditionButton active={check.condition === 'Tidak Baik'} onPress={() => updateChecklist(index, { condition: 'Tidak Baik' })}>
                  <ConditionButtonText active={check.condition === 'Tidak Baik'}>Tidak Baik</ConditionButtonText>
                </ConditionButton>
              </ConditionButtons>
              {check.condition === 'Tidak Baik' && (
                <Input placeholder="Masukkan alasan" value={check.alasan} onChangeText={(text) => updateChecklist(index, { alasan: text })} />
              )}
            </ChecklistItemContainer>
          ))}
        </Section>

        <Section>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16 }}>Foto Pemeriksaan</Text>
          <Pressable style={{ backgroundColor: '#dde1e6', padding: 10, borderRadius: 6, alignItems: 'center', marginBottom: 10 }} onPress={pickImages}>
            <Text style={{ color: '#212121' }}>Upload Foto</Text>
          </Pressable>
          <ScrollView horizontal>
            {fotoPemeriksaan.map((uri, i) => (
              <View key={i} style={{ marginRight: 10, alignItems: 'center' }}>
                <Image source={{ uri }} style={{ width: 100, height: 100, borderRadius: 8, marginBottom: 4 }} />
                <Text style={{ fontSize: 12 }}>{data.no_apar}</Text>
              </View>
            ))}
          </ScrollView>
        </Section>

        <Button onPress={handleSubmit}>
          <ButtonText>Simpan Perawatan</ButtonText>
        </Button>
      </Container>
    </KeyboardAvoidingView>
  );
}
