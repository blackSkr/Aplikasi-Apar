import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { useBadge } from '../../context/BadgeContext';

const COLORS = {
  primary: '#D50000',
  background: '#F9FAFB',
  input: '#FFFFFF',
  border: '#DDE1E6',
  text: '#212121',
  label: '#4F4F4F',
  buttonText: '#FFFFFF',
};

type ChecklistItemState = {
  item: string;
  checklistId: number;
  condition: 'Baik' | 'Tidak Baik' | null;
  alasan?: string;
  fotoUris?: string[];
};

const Container = styled(ScrollView)`flex: 1; background-color: ${COLORS.background};`;
const Section = styled(View)`background-color: #fff; margin: 16px; padding: 16px; border-radius: 12px; border: 1px solid ${COLORS.border};`;
const Label = styled(Text)`font-size: 14px; color: ${COLORS.label}; margin-bottom: 4px;`;
const Input = styled(TextInput)`background-color: ${COLORS.input}; border: 1px solid ${COLORS.border}; border-radius: 8px; padding: 12px; font-size: 15px; color: ${COLORS.text}; margin-bottom: 12px;`;
const ReadOnlyInput = styled(Input).attrs({ editable: false })`background-color: #f0f0f0;`;
const Button = styled(Pressable)`background-color: ${COLORS.primary}; padding: 14px; border-radius: 8px; align-items: center; margin: 20px 16px;`;
const ButtonText = styled(Text)`color: #fff; font-weight: bold; font-size: 16px;`;
const ChecklistItemContainer = styled(View)`margin-bottom: 16px;`;
const ChecklistTitle = styled(Text)`font-size: 15px; font-weight: bold; margin-bottom: 10px;`;
const ConditionButtons = styled(View)`flex-direction: row; margin-bottom: 12px;`;
const ConditionButton = styled(Pressable)<{ active: boolean }>`
  background-color: ${({ active }) => (active ? COLORS.primary : COLORS.border)};
  padding: 10px 16px;
  border-radius: 8px;
  margin-right: 10px;
`;
const ConditionButtonText = styled(Text)<{ active: boolean }>`
  color: ${({ active }) => (active ? '#fff' : COLORS.text)};
  font-size: 14px;
`;
const UploadButton = styled(Pressable)`background-color: ${COLORS.primary}; padding: 10px; border-radius: 8px; align-items: center; margin-bottom: 10px;`;
const UploadText = styled(Text)`color: #fff; font-weight: bold;`;
const Thumbnail = styled(Image)`width: 80px; height: 80px; border-radius: 6px; margin-right: 10px;`;

export default function MaintenanceApar() {
  const { token, badge } = useLocalSearchParams();
  const { badgeNumber: contextBadge } = useBadge();
  const badgeNumber = contextBadge || (badge as string) || '';

  const CACHE_KEY = `cached-apar-${token}`;
  const [loading, setLoading] = useState(true);
  const [checklistStates, setChecklistStates] = useState<ChecklistItemState[]>([]);
  const [location, setLocation] = useState('');
  const [pic, setPic] = useState('');
  const [noFE, setNoFE] = useState('');
  const [typeFE, setTypeFE] = useState('');
  const [condition, setCondition] = useState('');
  const [totalFE, setTotalFE] = useState('');
  const [feTrouble, setFeTrouble] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [remark, setRemark] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!token || !badgeNumber) {
          Alert.alert('Error', 'Token atau badge tidak tersedia.');
          return;
        }

        const res = await fetch(`http://localhost:3000/api/perawatan/with-checklist/by-token?token=${token}&badge=${badgeNumber}`);
        const json = await res.json();

        if (!json || !json.id_apar) {
          Alert.alert('Error', 'Data APAR tidak ditemukan.');
          return;
        }

        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(json));

        const items = JSON.parse(json.keperluan_check || '[]');
        setChecklistStates(items.map((item: any) => ({
          item: item.Pertanyaan,
          checklistId: item.checklistId,
          condition: null,
          alasan: '',
          fotoUris: [],
        })));

        setLocation(json.lokasi_apar || '');
        setNoFE(json.no_apar || '');
        setTypeFE(json.jenis_apar || '');
        setPic(json.pic || '');

      } catch (err) {
        const cached = await AsyncStorage.getItem(CACHE_KEY);
        if (cached) {
          const json = JSON.parse(cached);
          const items = JSON.parse(json.keperluan_check || '[]');

          setChecklistStates(items.map((item: any) => ({
            item: item.Pertanyaan,
            checklistId: item.checklistId,
            condition: null,
            alasan: '',
            fotoUris: [],
          })));

          setLocation(json.lokasi_apar || '');
          setNoFE(json.no_apar || '');
          setTypeFE(json.jenis_apar || '');
          setPic(json.pic || '');

          Alert.alert('Offline Mode', 'Menggunakan data cache.');
        } else {
          Alert.alert('Error', 'Gagal mengambil data online maupun cache.');
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const updateChecklist = (index: number, changes: Partial<ChecklistItemState>) => {
    const updated = [...checklistStates];
    updated[index] = { ...updated[index], ...changes };
    setChecklistStates(updated);
  };

  const pickMultipleImages = async (index: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const uris = result.assets.map((a) => a.uri);
      updateChecklist(index, { fotoUris: uris });
    }
  };

  const handleSubmit = async () => {
    if (!badgeNumber || !location || !checklistStates.length) {
      return Alert.alert('Error', 'Mohon lengkapi semua data.');
    }

    const invalid = checklistStates.some(
      (c) => c.condition === 'Tidak Baik' && (!c.alasan || !c.fotoUris || c.fotoUris.length === 0)
    );

    if (invalid) {
      return Alert.alert('Error', 'Isi alasan & upload foto untuk item "Tidak Baik".');
    }

    const maintenanceData = {
      id: `offline-${Date.now()}`,
      aparId: token,
      badgeNumber,
      location,
      pic,
      noFE,
      typeFE,
      condition,
      totalFE,
      feTrouble,
      recommendation,
      remark,
      checklist: checklistStates.map(c => ({
        checklistId: c.checklistId,
        condition: c.condition,
        alasan: c.alasan || '',
      })),
      createdAt: new Date().toISOString(),
      status: 'pending',
    };

    try {
      const existing = await AsyncStorage.getItem('offline-maintenance');
      const parsed = existing ? JSON.parse(existing) : [];
      parsed.push(maintenanceData);
      await AsyncStorage.setItem('offline-maintenance', JSON.stringify(parsed));
      Alert.alert('Tersimpan', 'Data akan disinkronkan saat online.');
    } catch {
      Alert.alert('Error', 'Gagal menyimpan data.');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Container contentContainerStyle={{ paddingBottom: 100 }}>
        <Section>
          <Label>Badge Number</Label>
          <ReadOnlyInput value={badgeNumber} />

          <Label>Lokasi</Label>
          <Input value={location} onChangeText={setLocation} />

          <Label>PIC</Label>
          <Input value={pic} onChangeText={setPic} />

          <Label>No FE</Label>
          <Input value={noFE} onChangeText={setNoFE} />

          <Label>Type FE</Label>
          <Input value={typeFE} onChangeText={setTypeFE} />

          <Label>Kondisi</Label>
          <Input value={condition} onChangeText={setCondition} />

          <Label>Total FE</Label>
          <Input keyboardType="numeric" value={totalFE} onChangeText={setTotalFE} />

          <Label>FE Trouble</Label>
          <Input keyboardType="numeric" value={feTrouble} onChangeText={setFeTrouble} />

          <Label>Rekomendasi</Label>
          <Input value={recommendation} onChangeText={setRecommendation} />

          <Label>Catatan</Label>
          <Input value={remark} onChangeText={setRemark} multiline style={{ height: 80 }} />
        </Section>

        <Section>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16 }}>Checklist</Text>
          {checklistStates.map((check, index) => (
            <ChecklistItemContainer key={index}>
              <ChecklistTitle>{check.item}</ChecklistTitle>

              <ConditionButtons>
                <ConditionButton
                  active={check.condition === 'Baik'}
                  onPress={() => updateChecklist(index, { condition: 'Baik', alasan: '', fotoUris: [] })}
                >
                  <ConditionButtonText active={check.condition === 'Baik'}>Baik</ConditionButtonText>
                </ConditionButton>

                <ConditionButton
                  active={check.condition === 'Tidak Baik'}
                  onPress={() => updateChecklist(index, { condition: 'Tidak Baik' })}
                >
                  <ConditionButtonText active={check.condition === 'Tidak Baik'}>Tidak Baik</ConditionButtonText>
                </ConditionButton>
              </ConditionButtons>

              {check.condition === 'Tidak Baik' && (
                <>
                  <Input
                    placeholder="Masukkan alasan"
                    value={check.alasan}
                    onChangeText={(text) => updateChecklist(index, { alasan: text })}
                  />

                  <UploadButton onPress={() => pickMultipleImages(index)}>
                    <UploadText>Upload Foto</UploadText>
                  </UploadButton>

                  <FlatList
                    horizontal
                    data={check.fotoUris}
                    keyExtractor={(uri, i) => uri + i}
                    renderItem={({ item }) => <Thumbnail source={{ uri: item }} />}
                    showsHorizontalScrollIndicator={false}
                  />
                </>
              )}
            </ChecklistItemContainer>
          ))}
        </Section>

        <Button onPress={handleSubmit}>
          <ButtonText>Simpan Maintenance</ButtonText>
        </Button>
      </Container>
    </KeyboardAvoidingView>
  );
}
