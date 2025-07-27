// app/(tabs)/index.tsx
import NetInfo from '@react-native-community/netinfo';
import { useRouter } from 'expo-router';
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
import { APAR, useAparList } from '@/hooks/useAparList';

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

  useEffect(() => {
    const unsub = NetInfo.addEventListener((s) =>
      setIsConnected(s.isConnected === true)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isConnected) {
      refresh();
    }
  }, [isConnected, refresh]);

  const filtered = useMemo(() => {
    if (!selectedJenis) return [];
    return list.filter(
      (i) =>
        i.jenis_apar === selectedJenis &&
        i.status_apar === 'Maintenance' // hanya yang perlu maintenance
    );
  }, [list, selectedJenis]);

  const sorted = useMemo(
    () =>
      filtered
        .slice()
        .sort((a, b) =>
          asc ? a.daysRemaining - b.daysRemaining : b.daysRemaining - a.daysRemaining
        ),
    [filtered, asc]
  );

  const dataToRender = showAll ? sorted : sorted.slice(0, 3);
  const sections = [{ title: 'StatsHeader', data: dataToRender }];

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

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <Container>
      <Header
        selectedJenis={selectedJenis}
        onLogout={() => {
          // Handle logout jika diperlukan
        }}
      />

      {!isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            Kamu sedang offline.
          </Text>
        </View>
      )}

      <SectionList<APAR>
        sections={sections}
        keyExtractor={(item, idx) => item.id_apar ?? idx.toString()}
        ListHeaderComponent={() => (
          <>
            <Stats jenisList={jenisList} onSelectJenis={setSelectedJenis} />
            <Options router={router} />
          </>
        )}
        renderSectionHeader={() =>
          selectedJenis ? (
            <StatsWrapper>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  marginHorizontal: 12,
                  marginBottom: 8,
                }}
              >
                Jenis : {selectedJenis}
              </Text>
              <Controls asc={asc} onToggle={() => setAsc((s) => !s)} />
            </StatsWrapper>
          ) : null
        }
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
            <Text>
              {selectedJenis
                ? `Tidak ada APAR dengan status Maintenance untuk jenis "${selectedJenis}".`
                : 'Silakan pilih jenis APAR terlebih dahulu.'}
            </Text>
          </View>
        )}
        ListFooterComponent={renderFooter}
        contentContainerStyle={{ paddingBottom: 16 }}
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
    // backgroundColor: '#FFF3CD',
    padding: 10,
    alignItems: 'center',
  },
  offlineText: {
    color: '#D5000',
    fontSize: 13,
  },
});

