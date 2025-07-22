import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import styled from 'styled-components/native';

const BASE_URL = 'http://172.20.10.5:3000'; // sesuaikan IP/backend-mu

const ChecklistDetail: React.FC = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [apar, setApar] = useState<any>(null);
  const [checks, setChecks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError('ID APAR tidak tersedia');
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/apar/${id}`);
        if (res.status === 404) throw new Error('Data tidak ditemukan');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setApar(data);

        // parsing keperluan_check
        let arr: string[] = [];
        const raw = data.keperluan_check;
        if (typeof raw === 'string') {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) arr = parsed;
          } catch {
            arr = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
          }
        } else if (Array.isArray(raw)) {
          arr = raw;
        }
        setChecks(arr);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <Center>
        <ActivityIndicator size="large" color={Colors.primary} />
      </Center>
    );
  }
  if (error) {
    return (
      <Center>
        <ErrorText>{error}</ErrorText>
      </Center>
    );
  }

  return (
    <SafeArea>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryheader} />

      <Header>
        <HeaderTitle>Detail APAR</HeaderTitle>
      </Header>

      <ScrollView contentContainerStyle={{ padding: 24 }}>
        {/* Section Utama */}
        <Card>
          <FieldRow>
            <Label>ID APAR</Label>
            <Value>{apar.id_apar}</Value>
          </FieldRow>
          <FieldRow>
            <Label>No APAR</Label>
            <Value>{apar.no_apar}</Value>
          </FieldRow>
          <FieldRow>
            <Label>Lokasi</Label>
            <Value>{apar.lokasi_apar}</Value>
          </FieldRow>
          <FieldRow>
            <Label>Jenis</Label>
            <Value>{apar.jenis_apar}</Value>
          </FieldRow>
        </Card>

        {/* Keperluan Check */}
        <Card>
          <SectionTitle>Keperluan Check</SectionTitle>
          {checks.length > 0 ? (
            checks.map((item, idx) => (
              <CheckRow key={idx}>
                <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                <CheckText>{item}</CheckText>
              </CheckRow>
            ))
          ) : (
            <NoData>(tidak ada data)</NoData>
          )}
        </Card>

        {/* Status & Exp */}
        <Card>
          <FieldRow>
            <Label>Status</Label>
            <StatusBadge status={apar.status_apar}>
              {apar.status_apar}
            </StatusBadge>
          </FieldRow>
          <FieldRow>
            <Label>Exp Date</Label>
            <Value>{new Date(apar.tgl_exp).toLocaleDateString()}</Value>
          </FieldRow>
        </Card>
      </ScrollView>
    </SafeArea>
  );
};

export default ChecklistDetail;

const SafeArea = styled(SafeAreaView)`
  flex: 1;
  background-color: ${Colors.background};
`;

const Header = styled(View)`
  height: 56px;
  background-color: ${Colors.primaryheader};
  justify-content: center;
  align-items: center;
  elevation: 4;
  shadow-color: #000;
  shadow-opacity: 0.1;
  shadow-offset: 0 2px;
  shadow-radius: 4px;
`;

const HeaderTitle = styled(Text)`
  color: #fff;
  font-size: 20px;
  font-weight: bold;
`;

const Center = styled(View)`
  flex: 1;
  justify-content: center;
  align-items: center;
`;

const ErrorText = styled(Text)`
  color: red;
  font-size: 16px;
`;

const Card = styled(View)`
  background-color: ${Colors.background};
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid ${Colors.border};
`;

const FieldRow = styled(View)`
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const Label = styled(Text)`
  color: ${Colors.subtext};
  font-size: 14px;
  font-weight: 600;
`;

const Value = styled(Text)`
  color: ${Colors.text};
  font-size: 14px;
  flex-shrink: 1;
  text-align: right;
`;

const SectionTitle = styled(Text)`
  font-size: 16px;
  font-weight: bold;
  color: ${Colors.text};
  margin-bottom: 12px;
`;

const CheckRow = styled(View)`
  flex-direction: row;
  align-items: center;
  margin-bottom: 8px;
`;

const CheckText = styled(Text)`
  margin-left: 8px;
  color: ${Colors.text};
  font-size: 14px;
`;

const NoData = styled(Text)`
  color: ${Colors.subtext};
  font-size: 14px;
  font-style: italic;
`;

const StatusBadge = styled(Text)<{ status: string }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  color: #fff;
  background-color: ${({ status }) =>
    Colors.badge[status as keyof typeof Colors.badge] || Colors.primaryLight};
`;
