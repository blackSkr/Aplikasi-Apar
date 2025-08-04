// src/screens/AparInformasi.tsx
import NetInfo from '@react-native-community/netinfo';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  SectionList,
  Text,
  View,
} from 'react-native';
import styled from 'styled-components/native';

import Header from '@/components/IndexPages/Header';
import IndexAparCard from '@/components/IndexPages/IndexAparCards';
import Options from '@/components/IndexPages/IndexOptions';
import Stats from '@/components/IndexPages/IndexStats';
import Colors from '@/constants/Colors';
import { useBadge } from '@/context/BadgeContext';
import { useAparList } from '@/hooks/useAparList';

export default function AparInformasi() {
  const { loading, list, refresh } = useAparList();
  const { clearBadgeNumber } = useBadge();

  const [isConnected, setIsConnected] = useState(true);
  const [selectedJenis, setSelectedJenis] = useState<string | null>(null);

  // daftar unik jenis untuk filter
  const jenisList = useMemo(
    () => Array.from(new Set(list.map(i => i.jenis_apar))),
    [list]
  );

  // handle online/offline
  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => setIsConnected(!!s.isConnected));
    return () => unsub();
  }, []);

  // reload saat online
  useEffect(() => {
    if (isConnected) refresh();
  }, [isConnected, refresh]);

  // split ke dua grup
  const need = useMemo(
    () =>
      list.filter(i => i.statusMaintenance === 'Belum')
          .filter(i => !selectedJenis || i.jenis_apar === selectedJenis),
    [list, selectedJenis]
  );
  const done = useMemo(
    () =>
      list.filter(i => i.statusMaintenance === 'Sudah')
          .filter(i => !selectedJenis || i.jenis_apar === selectedJenis),
    [list, selectedJenis]
  );

  // fungsi logout yang benar
  const handleLogout = async () => {
    await clearBadgeNumber();
    // di BadgeContext, ini akan memicu modal input ulang
  };

  if (loading) {
    return (
      <SafeAreaView style={{flex:1,justifyContent:'center',alignItems:'center'}}>
        <ActivityIndicator size="large" color={Colors.primary}/>
        <Text>Memuat data...</Text>
      </SafeAreaView>
    );
  }

  return (
    <Container>
      {/* PASS handleLogout ke Header */}
      <Header onLogout={handleLogout} />

      {!isConnected && (
        <OfflineBanner>
          <OfflineText>📴 Kamu sedang offline.</OfflineText>
        </OfflineBanner>
      )}

      {/* Statistik + filter jenis */}
      <Stats
        jenisList={jenisList}
        selectedJenis={selectedJenis}
        onSelectJenis={val => setSelectedJenis(val)}
      />

      <Options />

      <SectionList
        sections={[
          { title: 'Perlu Maintenance', data: need },
          { title: 'Sudah Maintenance',   data: done },
        ]}
        keyExtractor={item => item.id_apar}
        renderSectionHeader={({ section }) => (
          <SectionHeader>
            <SectionTitle>{section.title}</SectionTitle>
          </SectionHeader>
        )}
        renderItem={({ item }) => (
          <IndexAparCard
            item={item}
            onPressDetails={() => {
              /* navigasi ke detail jika perlu */
            }}
          />
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </Container>
  );
}

const Container      = styled.View`flex:1;background:#f5f5f5;`;
const OfflineBanner  = styled(View)`padding:10px;align-items:center;background:#fff3cd;`;
const OfflineText    = styled(Text)`color:#d50000;font-size:13px;`;
const SectionHeader  = styled(View)`background:#f5f5f5;padding:8px 16px;`;
const SectionTitle   = styled(Text)`font-size:16px;font-weight:bold;`;
