// ManajemenApar/AparMaintenance.tsx
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

const DUMMY_ID = 116;
const BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

type ChecklistItemState = {
  item: string;
  condition: 'Baik' | 'Tidak Baik' | null;
  alasan?: string;
  fotoUris?: string[];
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/peralatan/with-checklist`);
        const json = await res.json();
        const apar = json.find((item: any) => item.id_apar === DUMMY_ID);

        if (!apar) {
          Alert.alert('Data tidak ditemukan');
          return;
        }

        setData(apar);

        const parsed = parseChecklist(apar.keperluan_check);
        setChecklistStates(parsed.map((item: string) => ({
          item,
          condition: null,
          alasan: '',
          fotoUris: [],
        })));
      } catch (err) {
        Alert.alert('Gagal', 'Gagal ambil data dari server');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const parseChecklist = (raw: any): string[] => {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return typeof raw === 'string'
        ? raw.split(';').map((s) => s.trim()).filter(Boolean)
        : [];
    }
  };

  const updateChecklist = (index: number, changes: Partial<ChecklistItemState>) => {
    const updated = [...checklistStates];
    updated[index] = { ...updated[index], ...changes };
    setChecklistStates(updated);
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
                </>
              )}
            </ChecklistItemContainer>
          ))}
        </Section>

        <Button onPress={() => Alert.alert('Submit diklik', 'Ini hanya dummy.')}>
          <ButtonText>Simpan Maintenance</ButtonText>
        </Button>
      </Container>
    </KeyboardAvoidingView>
  );
}
