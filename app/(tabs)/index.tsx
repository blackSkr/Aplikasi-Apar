// app/%28tabs%29/index.tsx
import NetInfo from '@react-native-community/netinfo';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  SectionList,
  Text,
  TouchableOpacity,
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

import { router } from 'expo-router'; // ← WAJIB!

const INITIAL_COUNT = 3;

export default function AparInformasi() {
  const { loading, list, refresh } = useAparList();
  const { clearBadgeNumber } = useBadge();

  const [isConnected, setIsConnected] = useState(true);
  const [selectedJenis, setSelectedJenis] = useState<string | null>(null);

  // State untuk visible count tiap section
  const [visibleNeed, setVisibleNeed] = useState(INITIAL_COUNT);
  const [visibleDone, setVisibleDone] = useState(INITIAL_COUNT);

  // Reset visible saat filter berubah
  useEffect(() => {
    setVisibleNeed(INITIAL_COUNT);
    setVisibleDone(INITIAL_COUNT);
  }, [selectedJenis, list]);

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

  // split ke dua grup & filter
  const needAll = useMemo(
    () =>
      list.filter(i => i.statusMaintenance === 'Belum')
          .filter(i => !selectedJenis || i.jenis_apar === selectedJenis),
    [list, selectedJenis]
  );
  const doneAll = useMemo(
    () =>
      list.filter(i => i.statusMaintenance === 'Sudah')
          .filter(i => !selectedJenis || i.jenis_apar === selectedJenis),
    [list, selectedJenis]
  );

  // Fungsi logout yang benar
  const handleLogout = async () => {
    await clearBadgeNumber();
  };

  if (loading) {
    return (
      <SafeAreaView style={{flex:1,justifyContent:'center',alignItems:'center'}}>
        <ActivityIndicator size="large" color={Colors.primary}/>
        <Text>Memuat data...</Text>
      </SafeAreaView>
    );
  }

  // Build sections dengan data yang dibatasi visibleCount
  const sections = [
    {
      title: 'Perlu Maintenance',
      data: needAll.slice(0, visibleNeed),
      allData: needAll,
      type: 'need',
    },
    {
      title: 'Sudah Maintenance',
      data: doneAll.slice(0, visibleDone),
      allData: doneAll,
      type: 'done',
    },
  ];

  // Tombol tampilkan lagi dan tutup per section
  const renderFooter = (section: any) => {
    const total = section.allData.length;
    const visible =
      section.type === 'need' ? visibleNeed : visibleDone;

    if (total === 0) return null;

    return (
      <View style={{ alignItems: 'center', paddingVertical: 8, flexDirection: 'row', justifyContent: 'center' }}>
        {visible < total && (
          <LoadMoreBtn
            onPress={() =>
              section.type === 'need'
                ? setVisibleNeed(v => v + INITIAL_COUNT)
                : setVisibleDone(v => v + INITIAL_COUNT)
            }
            style={{ marginRight: visible > INITIAL_COUNT - 1 ? 12 : 0 }}
          >
            <LoadMoreText>Tampilkan Lagi</LoadMoreText>
          </LoadMoreBtn>
        )}
        {visible > INITIAL_COUNT && (
          <HideBtn
            onPress={() =>
              section.type === 'need'
                ? setVisibleNeed(INITIAL_COUNT)
                : setVisibleDone(INITIAL_COUNT)
            }
          >
            <HideText>Tutup</HideText>
          </HideBtn>
        )}
      </View>
    );
  };

  return (
    <Container>
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
        sections={sections}
        keyExtractor={item => item.id_apar}
        renderSectionHeader={({ section }) => (
          <SectionHeader>
            <SectionTitle>{section.title}</SectionTitle>
          </SectionHeader>
        )}
        renderItem={({ item }) => (
          <IndexAparCard
            item={item}
            onPressDetails={() =>
              router.push({
                pathname: "/ManajemenApar/AparMaintenance",
                params: { id: item.id_apar }
              })
            }
          />
        )}
        renderSectionFooter={({ section }) => renderFooter(section)}
        ListEmptyComponent={<Text style={{padding:24, textAlign:'center'}}>Data kosong.</Text>}
        contentContainerStyle={{ paddingBottom: 20 }}
        stickySectionHeadersEnabled={false}
      />
    </Container>
  );
}

const Container      = styled.View`flex:1;background:#f5f5f5;`;
const OfflineBanner  = styled(View)`padding:10px;align-items:center;background:#fff3cd;`;
const OfflineText    = styled(Text)`color:#d50000;font-size:13px;`;
const SectionHeader  = styled(View)`background:#f5f5f5;padding:8px 16px;`;
const SectionTitle   = styled(Text)`font-size:16px;font-weight:bold;`;

const LoadMoreBtn = styled(TouchableOpacity)`
  background: ${Colors.primary};
  padding: 8px 24px;
  border-radius: 20px;
`;
const LoadMoreText = styled(Text)`
  color: #fff;
  font-size: 14px;
  font-weight: 600;
`;

const HideBtn = styled(TouchableOpacity)`
  background: #e0e0e0;
  padding: 8px 24px;
  border-radius: 20px;
`;
const HideText = styled(Text)`
  color: #444;
  font-size: 14px;
  font-weight: 600;
`;
