// app/checklist/[id].tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  View,
  Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Ionicons } from '@expo/vector-icons';
import styled from 'styled-components/native';
import Colors from '@/constants/Colors';
import { AparRaw } from '@/hooks/useAparList';

// kunci cache sama dengan useAparList
const CACHE_KEY = 'APAR_CACHE';
// pakai baseUrl yang sama
const BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

export default function ChecklistDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [apar, setApar] = useState<AparRaw | null>(null);
  const [checks, setChecks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    (async () => {
      if (!id) {
        setError('ID APAR tidak tersedia');
        setLoading(false);
        return;
      }

      const net = await NetInfo.fetch();
      setIsConnected(net.isConnected === true);

      if (net.isConnected) {
        // online: fetch dari server
        try {
          const res = await fetch(`${BASE_URL}/api/apar/${id}`);
          if (res.status === 404) throw new Error('Data tidak ditemukan');
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data: AparRaw = await res.json();
          setApar(data);

          // update cache list
          const raw = await AsyncStorage.getItem(CACHE_KEY);
          const arr: AparRaw[] = raw ? JSON.parse(raw) : [];
          const idx = arr.findIndex(x => x.id_apar === id);
          if (idx >= 0) arr[idx] = data;
          else arr.push(data);
          await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(arr));
        } catch (e: any) {
          setError(e.message);
        }
      } else {
        // offline: baca dari cache
        const raw = await AsyncStorage.getItem(CACHE_KEY);
        if (raw) {
          const arr: AparRaw[] = JSON.parse(raw);
          const found = arr.find(x => x.id_apar === id) ?? null;
          if (found) {
            setApar(found);
          } else {
            setError('Data tidak tersedia di cache');
          }
        } else {
          setError('Tidak ada data cache. Nyalakan koneksi.');
        }
      }

      // parsing keperluan_check
      if (apar) {
        const rawCheck = apar.keperluan_check;
        let arr: string[] = [];
        if (typeof rawCheck === 'string') {
          try {
            const parsed = JSON.parse(rawCheck);
            if (Array.isArray(parsed)) arr = parsed;
            else arr = [];
          } catch {
            arr = rawCheck
              .split(';')
              .map(s => s.trim())
              .filter(Boolean);
          }
        } else if (Array.isArray(rawCheck)) {
          arr = rawCheck;
        }
        setChecks(arr);
      }

      setLoading(false);
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
  if (!apar) {
    return null;
  }

  return (
    <SafeArea>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.primaryheader}
      />
      {!isConnected && (
        <Banner>
          <BannerText>OFFLINE: Menampilkan data cache</BannerText>
        </Banner>
      )}
      <Header>
        <HeaderTitle>Detail APAR</HeaderTitle>
      </Header>
      <ScrollView contentContainerStyle={{ padding: 24 }}>
        {/* Identitas */}
        <Card>
          <Row>
            <Label>ID APAR</Label>
            <Value>{apar.id_apar}</Value>
          </Row>
          <Row>
            <Label>No APAR</Label>
            <Value>{apar.no_apar}</Value>
          </Row>
          <Row>
            <Label>Lokasi</Label>
            <Value>{apar.lokasi_apar}</Value>
          </Row>
          <Row>
            <Label>Jenis</Label>
            <Value>{apar.jenis_apar}</Value>
          </Row>
        </Card>
        {/* Keperluan Check */}
        <Card>
          <SectionTitle>Keperluan Check</SectionTitle>
          {checks.length > 0 ? (
            checks.map((it, i) => (
              <CheckRow key={i}>
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={Colors.primary}
                />
                <CheckText>{it}</CheckText>
              </CheckRow>
            ))
          ) : (
            <NoData>(tidak ada data)</NoData>
          )}
        </Card>
        {/* Status & Exp */}
        <Card>
          <Row>
            <Label>Status</Label>
            <Badge status={apar.status_apar}>
              {apar.status_apar}
            </Badge>
          </Row>
          <Row>
            <Label>Exp Date</Label>
            <Value>
              {new Date(apar.tgl_exp).toLocaleDateString()}
            </Value>
          </Row>
        </Card>
      </ScrollView>
    </SafeArea>
  );
}

// styled components
const SafeArea = styled(SafeAreaView)`
  flex: 1;
  background-color: ${Colors.background};
`;
const Banner = styled.View`
  background-color: ${Colors.warning};
  padding: 8px;
  align-items: center;
`;
const BannerText = styled.Text`
  color: #fff;
  font-weight: bold;
`;
const Header = styled(View)`
  height: 56px;
  background-color: ${Colors.primaryheader};
  justify-content: center;
  align-items: center;
  elevation: 4;
`;
const HeaderTitle = styled.Text`
  color: #fff;
  font-size: 20px;
  font-weight: bold;
`;
const Center = styled(View)`
  flex: 1;
  justify-content: center;
  align-items: center;
`;
const ErrorText = styled.Text`
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
const Row = styled(View)`
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 12px;
`;
const Label = styled.Text`
  color: ${Colors.subtext};
  font-size: 14px;
  font-weight: 600;
`;
const Value = styled.Text`
  color: ${Colors.text};
  font-size: 14px;
  flex-shrink: 1;
  text-align: right;
`;
const SectionTitle = styled.Text`
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
const CheckText = styled.Text`
  margin-left: 8px;
  color: ${Colors.text};
  font-size: 14px;
`;
const NoData = styled.Text`
  color: ${Colors.subtext};
  font-size: 14px;
  font-style: italic;
`;
const Badge = styled.Text<{ status: string }>`
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
  color: #fff;
  background-color: ${({ status }) =>
    Colors.badge[status as keyof typeof Colors.badge] ||
    Colors.primaryLight};
`;
