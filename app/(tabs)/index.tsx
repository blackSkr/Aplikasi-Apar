// app/(tabs)/index.tsx
import NetInfo from '@react-native-community/netinfo';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  SectionList,
  Text,
  View
} from 'react-native';
import styled from 'styled-components/native';

import Header from '@/components/IndexPages/Header';
import IndexAparCard from '@/components/IndexPages/IndexAparCards';
import Options from '@/components/IndexPages/IndexOptions';
import Stats from '@/components/IndexPages/IndexStats';
import Colors from '@/constants/Colors';
import { useBadge } from '@/context/BadgeContext';
import { useAparList } from '@/hooks/useAparList';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { flushQueue, getQueueCount } from '@/utils/ManajemenOffline';

import { router } from 'expo-router';

const INITIAL_COUNT = 3;

export default function AparInformasi() {
  const { loading, list, refresh } = useAparList();
  const { clearBadgeNumber } = useBadge();
  const { count, refreshQueue } = useOfflineQueue();

  const [isConnected, setIsConnected] = useState(true);
  const [selectedJenis, setSelectedJenis] = useState<string | null>(null);
  const [visibleNeed, setVisibleNeed] = useState(INITIAL_COUNT);
  const [visibleDone, setVisibleDone] = useState(INITIAL_COUNT);

  // reset pagination tiap filter/list berubah
  useEffect(() => {
    setVisibleNeed(INITIAL_COUNT);
    setVisibleDone(INITIAL_COUNT);
  }, [selectedJenis, list]);

  // track koneksi
  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => {
      console.log('[Debug] NetInfo status:', s.isConnected);
      setIsConnected(!!s.isConnected);
    });
    return () => unsub();
  }, []);

  // fetch ulang saat online
  useEffect(() => {
    if (isConnected) {
      console.log('[Debug] Became online → refresh data utama');
      refresh();
    }
  }, [isConnected, refresh]);

  // fetch ulang tiap focus
  useFocusEffect(useCallback(() => {
    console.log('[Debug] Screen focus → refresh data utama');
    refresh();
  }, [refresh]));

  const handleLogout = async () => {
    await clearBadgeNumber();
  };

  const jenisList = useMemo(
    () =>
      Array.from(new Set(list.map(i => i.jenis_apar).filter(Boolean))),
    [list]
  );

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

  if (loading) {
    return (
      <SafeAreaView style={{flex:1,justifyContent:'center',alignItems:'center'}}>
        <ActivityIndicator size="large" color={Colors.primary}/>
        <LoadingText>Memuat data...</LoadingText>
      </SafeAreaView>
    );
  }

  const sections = [
    {
      title: 'Perlu Maintenance',
      data: needAll.slice(0, visibleNeed),
      allData: needAll,
      type: 'need',
      key: 'section-need-maintenance',
    },
    {
      title: 'Sudah Maintenance',
      data: doneAll.slice(0, visibleDone),
      allData: doneAll,
      type: 'done',
      key: 'section-sudah-maintenance',
    },
  ];

  const renderFooter = (section: any) => {
    const total = section.allData.length;
    const visible = section.type === 'need' ? visibleNeed : visibleDone;
    if (total === 0) return null;
    return (
      <View
        key={`footer-${section.type}`}
        style={{
          alignItems: 'center',
          paddingVertical: 8,
          flexDirection: 'row',
          justifyContent: 'center',
        }}
      >
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

      <Stats
        jenisList={jenisList}
        selectedJenis={selectedJenis}
        onSelectJenis={val => setSelectedJenis(val)}
      />

      <Options />

      <SectionList
        sections={sections}
        keyExtractor={(item, idx) => `${item.id_apar||idx}-${idx}`}
        renderSectionHeader={({ section }) => (
          <SectionHeader key={section.key}>
            <SectionTitle>{section.title}</SectionTitle>
          </SectionHeader>
        )}
        renderItem={({ item, index }) => (
          <IndexAparCard
            key={`card-${item.id_apar||index}-${index}`}
            item={item}
            onPressDetails={() =>
              router.push({
                pathname: '/ManajemenApar/AparMaintenance',
                params: { id: item.id_apar },
              })
            }
          />
        )}
        renderSectionFooter={({ section }) => renderFooter(section)}
        ListEmptyComponent={
          <EmptyContainer key="empty">
            <EmptyText>Data kosong.</EmptyText>
          </EmptyContainer>
        }
        contentContainerStyle={{ paddingBottom: 80 }}
        stickySectionHeadersEnabled={false}
      />

      {isConnected && count > 0 && (
        <FloatingBtn
          onPress={() => {
            Alert.alert(
              'Kirim Data Offline',
              `Kamu punya ${count} data tersimpan offline. Kirim sekarang?`,
              [
                { text: 'Batal', style: 'cancel' },
                {
                  text: 'Kirim',
                  style: 'destructive',
                  onPress: async () => {
                    console.log('[Debug] tombol Kirim ditekan, count=', count);
                    const remaining = await flushQueue();
                    console.log('[Debug] flushQueue → remaining =', remaining);
                    await refreshQueue();
                    const updated = await getQueueCount();
                    console.log('[Debug] getQueueCount →', updated);
                    await refresh();
                    if (updated === 0) {
                      Alert.alert('✅ Berhasil', 'Data offline berhasil dikirim.');
                    } else {
                      Alert.alert(
                        '⚠️ Sebagian gagal',
                        `${updated} item masih tersisa di queue.`
                      );
                    }
                  },
                },
              ]
            );
          }}
        >
          <FloatingText>🔄 Kirim ({count})</FloatingText>
        </FloatingBtn>
      )}
    </Container>
  );
}

// =================== STYLED COMPONENTS ===================
const Container = styled.View`
  flex: 1;
  background: #f5f5f5;
`;
const LoadingText = styled(Text)`
  margin-top: 12px;
  color: ${Colors.text};
  font-size: 16px;
`;
const OfflineBanner = styled(View)`
  padding: 10px;
  align-items: center;
  background: #fff3cd;
`;
const OfflineText = styled(Text)`
  color: #d50000;
  font-size: 13px;
`;
const SectionHeader = styled(View)`
  background: #f5f5f5;
  padding: 8px 16px;
`;
const SectionTitle = styled(Text)`
  font-size: 16px;
  font-weight: bold;
  color: ${Colors.text};
`;
const EmptyContainer = styled(View)`
  padding: 24px;
  align-items: center;
`;
const EmptyText = styled(Text)`
  text-align: center;
  color: ${Colors.textSecondary};
  font-size: 14px;
`;
const LoadMoreBtn = styled.TouchableOpacity`
  background: ${Colors.primary};
  padding: 8px 24px;
  border-radius: 20px;
`;
const LoadMoreText = styled(Text)`
  color: #fff;
  font-size: 14px;
  font-weight: 600;
`;
const HideBtn = styled.TouchableOpacity`
  background: #e0e0e0;
  padding: 8px 24px;
  border-radius: 20px;
`;
const HideText = styled(Text)`
  color: #444;
  font-size: 14px;
  font-weight: 600;
`;
const FloatingBtn = styled.TouchableOpacity`
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: #dc2626;
  padding: 16px 20px;
  border-radius: 32px;
  elevation: 4;
  shadow-color: #000;
  shadow-offset: 0px 2px;
  shadow-opacity: 0.2;
  shadow-radius: 4px;
`;
const FloatingText = styled(Text)`
  color: #fff;
  font-weight: bold;
  font-size: 14px;
`;
