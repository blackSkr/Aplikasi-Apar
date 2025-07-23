// app/(tabs)/index.tsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
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
import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';

import Header from '@/components/IndexPages/Header';
import IndexAparCard from '@/components/IndexPages/IndexAparCards';
import Controls from '@/components/IndexPages/IndexControl';
import Options from '@/components/IndexPages/IndexOptions';
import Stats from '@/components/IndexPages/IndexStats';
import Tabs from '@/components/IndexPages/IndexTabs';
import Colors from '@/constants/Colors';
import { APAR, APARStatus, useAparList } from '@/hooks/useAparList';

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
  const { loading, list, stats, refresh } = useAparList();

  // Semua hook harus di sini, sebelum ada return apa pun
  const [tab, setTab] = useState<APARStatus>('Sehat');
  const [asc, setAsc] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // 1) Listener koneksi
  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) =>
      setIsConnected(s.isConnected === true)
    );
    return () => unsub();
  }, []);

  // 2) Refresh saat kembali online
  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  // 3) Filter & sort data
  const filtered = useMemo(
    () => list.filter((i) => i.status_apar === tab),
    [list, tab]
  );
  const sorted = useMemo(
    () =>
      filtered
        .slice()
        .sort((a, b) =>
          asc ? a.daysRemaining - b.daysRemaining : b.daysRemaining - a.daysRemaining
        ),
    [filtered, asc]
  );

  // 4) Data yang di-render (3 item atau semua)
  const dataToRender = showAll ? sorted : sorted.slice(0, 3);
  const sections = [{ title: 'StatsHeader', data: dataToRender }];

  // 5) Footer “Lihat Semua” / “Tampilkan Sedikit”
  const renderFooter = useCallback(() => {
    if (sorted.length <= 3) return null;
    return (
      <ShowMoreButton onPress={() => setShowAll((v) => !v)}>
        <ShowMoreText>
          {showAll ? 'Tampilkan Sedikit' : 'Lihat Semua'}
        </ShowMoreText>
      </ShowMoreButton>
    );
  }, [sorted.length, showAll]);

  // Setelah semua hook: bolehlah return kondisi loading / offline
  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }
  if (!isConnected) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={{ marginBottom: 8 }}>Kamu sedang offline.</Text>
        <TouchableOpacity onPress={() => refresh()}>
          <Text style={{ color: Colors.primary }}>Coba lagi</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Render utama
  return (
    <Container>
      <Header />
      <SectionList<APAR>
        sections={sections}
        keyExtractor={(item, idx) => item.id_apar ?? idx.toString()}
        ListHeaderComponent={() => (
          <>
            <Stats trouble={stats.trouble} expired={stats.expired} />
            <Options router={router} />
          </>
        )}
        renderSectionHeader={() => (
          <StatsWrapper>
            <Tabs active={tab} onChange={setTab} />
            <Controls asc={asc} onToggle={() => setAsc((s) => !s)} />
          </StatsWrapper>
        )}
        stickySectionHeadersEnabled
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
            <Text>Tidak ada data untuk status "{tab}".</Text>
          </View>
        )}
        ListFooterComponent={renderFooter}
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
