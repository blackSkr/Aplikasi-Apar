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
  TouchableOpacity,
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
import { flushQueue } from '@/utils/ManajemenOffline';

import { router } from 'expo-router';

const INITIAL_COUNT = 3;

export default function AparInformasi() {
  const { loading, list, refresh } = useAparList();
  const { clearBadgeNumber } = useBadge();
  const { count, refreshQueue } = useOfflineQueue();

  const [isConnected, setIsConnected] = useState(true);
  const [showSendOfflineBtn, setShowSendOfflineBtn] = useState(false);
  const [selectedJenis, setSelectedJenis] = useState<string | null>(null);
  const [visibleNeed, setVisibleNeed] = useState(INITIAL_COUNT);
  const [visibleDone, setVisibleDone] = useState(INITIAL_COUNT);

  useEffect(() => {
    setVisibleNeed(INITIAL_COUNT);
    setVisibleDone(INITIAL_COUNT);
  }, [selectedJenis, list]);

  const jenisList = useMemo(
    () => Array.from(new Set(list.map(i => i.jenis_apar).filter(Boolean))),
    [list]
  );

  useEffect(() => {
    const unsub = NetInfo.addEventListener(s => setIsConnected(!!s.isConnected));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isConnected) refresh();
  }, [isConnected, refresh]);
  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );
  useEffect(() => {
    if (isConnected && count > 0) {
      setShowSendOfflineBtn(true);
    }
  }, [isConnected, count]);


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

  const handleLogout = async () => {
    await clearBadgeNumber();
  };

  const handleSendOffline = async () => {
    await flushQueue();
    await refreshQueue();
    await refresh(); // penting: reload ulang apar list
    setShowSendOfflineBtn(false);
    Alert.alert('✅ Berhasil', 'Data offline berhasil dikirim.');
  };


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
          justifyContent: 'center' 
        }}
      >
        {visible < total && (
          <LoadMoreBtn
            key={`loadmore-${section.type}`}
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
            key={`hide-${section.type}`}
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

    {showSendOfflineBtn && (
      <FloatingBtn onPress={() => {
        Alert.alert(
          'Kirim Data Offline',
          `Kamu punya ${count} data tersimpan offline. Kirim sekarang?`,
          [
            { text: 'Batal', style: 'cancel' },
            {
              text: 'Kirim',
              style: 'destructive',
              onPress: async () => {
                await flushQueue();
                await refreshQueue();
                const latestCount = await getQueueCount(); // Tambahan
                if (latestCount === 0) {
                  setShowSendOfflineBtn(false);
                }
                await refresh();
                Alert.alert('✅ Berhasil', 'Data offline berhasil dikirim.');
              }
            }
          ]
        );
      }}>
        <FloatingText>🔄 Kirim ({count})</FloatingText>
      </FloatingBtn>
    )}


      <Stats
        jenisList={jenisList}
        selectedJenis={selectedJenis}
        onSelectJenis={val => setSelectedJenis(val)}
      />

      <Options />

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => `${item.id_apar || index}-${index}`}
        renderSectionHeader={({ section }) => (
          <SectionHeader key={section.key}>
            <SectionTitle>{section.title}</SectionTitle>
          </SectionHeader>
        )}
        renderItem={({ item, index }) => (
          <IndexAparCard
            key={`card-${item.id_apar || index}-${index}`}
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
        ListEmptyComponent={
          <EmptyContainer key="empty-component">
            <EmptyText>Data kosong.</EmptyText>
          </EmptyContainer>
        }
        contentContainerStyle={{ paddingBottom: 20 }}
        stickySectionHeadersEnabled={false}
      />
      {showSendOfflineBtn && (
          <FloatingBtn onPress={() => {
            Alert.alert(
              'Kirim Data Offline',
              `Kamu punya ${count} data tersimpan offline. Kirim sekarang?`,
              [
                { text: 'Batal', style: 'cancel' },
                {
                  text: 'Kirim',
                  style: 'destructive',
                  onPress: async () => {
                    await flushQueue();
                    await refreshQueue();
                    setShowSendOfflineBtn(false);
                    Alert.alert('✅ Berhasil', 'Data offline berhasil dikirim.');
                  }
                }
              ]
            );
          }}>
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

const FloatingText = styled.Text`
  color: #fff;
  font-weight: bold;
  font-size: 14px;
`;
