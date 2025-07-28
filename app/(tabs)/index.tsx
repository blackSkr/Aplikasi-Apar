import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  const router = useRouter();
  const { loading, list, stats, refresh, jenisList } = useAparList();

  const [selectedJenis, setSelectedJenis] = useState<string | null>(null);
  const [asc, setAsc] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // 🔌 Cek koneksi internet
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      console.log('📶 Status koneksi:', state.isConnected);
      setIsConnected(state.isConnected === true);
    });

    return () => unsubscribe();
  }, []);

  // 🔄 Refresh data saat online
  useEffect(() => {
    if (isConnected) {
      refresh();
    } else {
      console.log('⚠️ Offline, memuat dari cache...');
    }
  }, [isConnected, refresh]);

  // 🔍 Filter berdasarkan jenis
  const filtered = useMemo(() => {
    if (!selectedJenis) return [];
    const result = list.filter(item => item.jenis_apar === selectedJenis);
    console.log(`🎯 Filter: ${selectedJenis}, Ditemukan: ${result.length}`);
    return result;
  }, [list, selectedJenis]);

  // 🔃 Urutkan berdasarkan daysRemaining
  const sorted = useMemo(() => {
    const result = filtered.slice().sort((a, b) =>
      asc ? a.daysRemaining - b.daysRemaining : b.daysRemaining - a.daysRemaining
    );
    return result;
  }, [filtered, asc]);

  const dataToRender = showAll ? sorted : sorted.slice(0, 3);
  const sections = [{ title: 'StatsHeader', data: dataToRender }];

  const renderFooter = useCallback(() => {
    if (sorted.length <= 3) return null;
    return (
      <ShowMoreButton onPress={() => setShowAll(prev => !prev)}>
        <ShowMoreText>{showAll ? 'Tampilkan Sedikit' : 'Lihat Semua'}</ShowMoreText>
      </ShowMoreButton>
    );
  }, [sorted.length, showAll]);

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
        onLogout={() => Alert.alert('Logout', 'Belum diimplementasi')}
      />

      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>📴 Kamu sedang offline.</Text>
        </View>
      )}

      <SectionList
        sections={sections}
        keyExtractor={(item, index) => item.id_apar ?? index.toString()}
        ListHeaderComponent={() => (
          <>
            <Stats jenisList={jenisList} onSelectJenis={setSelectedJenis} />
            <Options router={router} />
          </>
        )}
        renderSectionHeader={() =>
          selectedJenis ? (
            <StatsWrapper>
              {/* <Text style={styles.sectionTitle}>
                Jenis : {selectedJenis}
              </Text> */}
              <Controls asc={asc} onToggle={() => setAsc(prev => !prev)} />
            </StatsWrapper>
          ) : null
        }
        renderItem={({ item }) => (
          <IndexAparCard
            item={item}
            onPressDetails={() =>
              router.push({ pathname: '/detail', params: { id: item.id_apar } })
            }
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginHorizontal: 12,
    marginBottom: 8,
  },
});
