//app/apar/MaintenanceApar.tsx
import Checkbox from 'expo-checkbox';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import styled from 'styled-components/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBadge } from '../../context/BadgeContext';
import { safeFetchOffline } from '../../utils/safeFetchOffline';

const API_BASE = 'http://192.168.245.1:3000/api';
const DUMMY_ID = 'AP2001';

const C = {
  primary: '#D50000',
  background: '#FAFAFA',
  card: '#FFF',
  text: '#212121',
  label: '#555',
  border: '#E0E0E0',
  secondary: '#757575',
};

const Container = styled.ScrollView`
  flex: 1;
  background-color: ${C.background};
  padding: 20px;
`;
const Title = styled(Text)`
  font-size: 22px;
  font-weight: bold;
  color: ${C.text};
  margin-bottom: 16px;
`;
const Label = styled(Text)`
  color: ${C.label};
  font-size: 14px;
  margin-bottom: 4px;
`;
const Input = styled(TextInput)`
  background-color: ${C.card};
  border: 1px solid ${C.border};
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 12px;
  color: ${C.text};
`;
const ReadOnlyInput = styled(Input).attrs({ editable: false })``;
const Button = styled(Pressable)`
  background-color: ${C.primary};
  padding: 14px;
  border-radius: 8px;
  align-items: center;
  margin-top: 24px;
  margin-bottom: 50px;
`;
const ButtonText = styled(Text)`
  color: #fff;
  font-size: 16px;
  font-weight: bold;
`;
const ChecklistItem = styled(View)`
  flex-direction: row;
  align-items: center;
  margin-bottom: 12px;
`;
const ChecklistLabel = styled(Text)`
  margin-left: 12px;
  color: ${C.text};
  font-size: 16px;
`;
const ImagePreview = styled(Image)`
  width: 100%;
  height: 200px;
  border-radius: 8px;
  margin-top: 8px;
  margin-bottom: 12px;
`;

export default function MaintenanceApar() {
  const { badgeNumber } = useBadge();
  const [loading, setLoading] = useState(true);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [fotoUri, setFotoUri] = useState<string | null>(null);

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
    (async () => {
      try {
        const res = await safeFetchOffline(`${API_BASE}/apar/${DUMMY_ID}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();

        let items: string[] = [];
        try {
          const parsed = JSON.parse(d.keperluan_check);
          if (Array.isArray(parsed)) items = parsed;
        } catch {
          items =
            d.keperluan_check
              ?.split(';')
              .map((s: string) => s.trim())
              .filter(Boolean) || [];
        }

        setChecklist(items);
        setChecked(Array(items.length).fill(false));
        setLocation(d.lokasi_apar || '');
        setNoFE(d.no_apar || '');
        setTypeFE(d.jenis_apar || '');
      } catch (e: any) {
        // ✅ Fallback jika offline atau fetch gagal
        setChecklist([
          'Cek tekanan tabung',
          'Cek segel dan pin',
          'Cek label instruksi',
          'Cek posisi & bracket',
        ]);
        setChecked([false, false, false, false]);
        setLocation('');
        setNoFE(DUMMY_ID);
        setTypeFE('');
        Alert.alert(
          'Offline Mode',
          'Data APAR tidak tersedia. Anda tetap dapat mengisi checklist & menyimpan offline.'
        );
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggle = (index: number) => {
    const updated = [...checked];
    updated[index] = !updated[index];
    setChecked(updated);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) {
      setFotoUri(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!badgeNumber || !location || !pic || checklist.length === 0) {
      return Alert.alert('Error', 'Mohon lengkapi data terlebih dahulu.');
    }

    const maintenanceData = {
      id: `offline-${Date.now()}`,
      aparId: DUMMY_ID,
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
      fotoUri,
      checklist: checklist.map((item, i) => ({
        item,
        checked: checked[i],
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
    } catch (e) {
      console.error('Save error:', e);
      Alert.alert('Error', 'Gagal menyimpan data offline.');
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <Container>
      <Title>Maintenance APAR: {DUMMY_ID}</Title>

      <Label>Badge Number (Petugas)</Label>
      <ReadOnlyInput value={badgeNumber} />

      <Label>Location</Label>
      <Input value={location} onChangeText={setLocation} />

      <Label>PIC</Label>
      <Input value={pic} onChangeText={setPic} />

      <Label>No FE</Label>
      <Input value={noFE} onChangeText={setNoFE} />

      <Label>Type FE</Label>
      <Input value={typeFE} onChangeText={setTypeFE} />

      <Label>Condition</Label>
      <Input value={condition} onChangeText={setCondition} />

      <Label>Total FE</Label>
      <Input value={totalFE} onChangeText={setTotalFE} keyboardType="numeric" />

      <Label>FE Trouble</Label>
      <Input value={feTrouble} onChangeText={setFeTrouble} keyboardType="numeric" />

      <Label>Recommendation</Label>
      <Input value={recommendation} onChangeText={setRecommendation} />

      <Label>Remark / Follow Up</Label>
      <Input value={remark} onChangeText={setRemark} multiline style={{ minHeight: 80 }} />

      <Label>Foto Kondisi</Label>
      <Pressable
        onPress={pickImage}
        style={{
          backgroundColor: C.primary,
          padding: 10,
          borderRadius: 6,
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Upload Foto</Text>
      </Pressable>
      {fotoUri && <ImagePreview source={{ uri: fotoUri }} />}

      <Label>Checklist</Label>
      {checklist.map((item, index) => (
        <ChecklistItem key={index}>
          <Checkbox
            value={checked[index]}
            onValueChange={() => handleToggle(index)}
            color={checked[index] ? C.primary : undefined}
          />
          <ChecklistLabel>{item}</ChecklistLabel>
        </ChecklistItem>
      ))}

      <Button onPress={handleSubmit}>
        <ButtonText>Simpan Maintenance</ButtonText>
      </Button>
    </Container>
  );
}
