import NetInfo from '@react-native-community/netinfo';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import styled from 'styled-components/native';

import Header from '@/components/IndexPages/Header';
import IndexAparCard from '@/components/IndexPages/IndexAparCards';
import Controls from '@/components/IndexPages/IndexControl';
import Options from '@/components/IndexPages/IndexOptions';
import Stats from '@/components/IndexPages/IndexStats';
import Colors from '@/constants/Colors';
import { useBadge } from '@/context/BadgeContext';
import { useAparList } from '@/hooks/useAparList';

const Container = styled.View`
  flex: 1;
  background-color: #f5f5f5;
`;

const StatsWrapper = styled.View`
  background-color: #f5f5f5;
  elevation: 1;
  z-index: 10;
`;

const ShowMoreButton = styled(TouchableOpacity)`
  padding: 12px;
  align-items: center;
`;

const ShowMoreText = styled(Text)`
  color: ${Colors.primary};
  font-weight: 600;
`;

export default function AparInformasi() {
  const { loading, list, stats, refresh, jenisList } = useAparList();
  const { clearBadgeNumber } = useBadge();

  const [selectedJenis, setSelectedJenis] = useState<string | null>(null);
  const [asc, setAsc] = useState(true);
  const [visibleCount, setVisibleCount] = useState(3);
  const [isConnected, setIsConnected] = useState(true);

  // Cek koneksi
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state =>
      setIsConnected(state.isConnected === true)
    );
    return () => unsub();
  }, []);

  // Refresh saat online
  useEffect(() => {
    if (isConnected) refresh();
  }, [isConnected, refresh]);

  // Filter & sort
  const filtered = useMemo(() => {
    return selectedJenis
      ? list.filter(item => item.jenis_apar === selectedJenis)
      : list;
  }, [list, selectedJenis]);

  const sorted = useMemo(() => {
    return filtered
      .slice()
      .sort((a, b) =>
        asc
          ? a.daysRemaining - b.daysRemaining
          : b.daysRemaining - a.daysRemaining
      );
  }, [filtered, asc]);

  const dataToRender = sorted.slice(0, visibleCount);
  const sections = [{ title: 'StatsHeader', data: dataToRender }];

  const renderFooter = useCallback(() => {
    if (visibleCount >= sorted.length) return null;
    return (
      <ShowMoreButton onPress={() => setVisibleCount(prev => prev + 3)}>
        <ShowMoreText>Tampilkan Lebih</ShowMoreText>
      </ShowMoreButton>
    );
  }, [visibleCount, sorted.length]);

  const handleLogout = async () => {
    await clearBadgeNumber();
    // tetap di halaman ini, modal badge akan muncul otomatis
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
        <Text>Memuat data APAR...</Text>
      </SafeAreaView>
    );
  }

  return (
    <Container>
      <Header
        selectedJenis={selectedJenis}
        onLogout={handleLogout}
      />

      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📴 Kamu sedang offline.</Text>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item, idx) => item.id_apar ?? idx.toString()}
        ListHeaderComponent={() => (
          <>
            <Stats
              jenisList={jenisList}
              onSelectJenis={val => {
                setSelectedJenis(val);
                setVisibleCount(3);
              }}
            />
            <Options router={undefined as any /* sesuaikan jika perlu */} />
          </>
        )}
        renderSectionHeader={() =>
          selectedJenis ? (
            <StatsWrapper>
              <Controls asc={asc} onToggle={() => setAsc(prev => !prev)} />
            </StatsWrapper>
          ) : null
        }
        renderItem={({ item }) => (
          <IndexAparCard
            item={item}
            onPressDetails={() => {
              /* navigasi detail, kalau pakai expo-router: router.push(...) */
            }}
          />
        )}
        ListEmptyComponent={() => (
          <View style={styles.center}>
            <Text>
              {selectedJenis
                ? `Tidak ada APAR untuk jenis "${selectedJenis}".`
                : 'Silakan pilih jenis APAR terlebih dahulu.'}
            </Text>
          </View>
        )}
        ListFooterComponent={renderFooter}
        contentContainerStyle={{ paddingBottom: 16 }}
        stickySectionHeadersEnabled
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineBanner: {
    padding: 10,
    alignItems: 'center',
    backgroundColor: '#FFF3CD',
  },
  offlineText: {
    color: '#D50000',
    fontSize: 13,
  },
});
