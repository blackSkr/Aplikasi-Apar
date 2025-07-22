// app/(tabs)/index.tsx

import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity
} from 'react-native';
import styled from 'styled-components/native';

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
  const { loading, list, stats } = useAparList();

  // 1) Hooks: state tab, sort, expand
  const [tab, setTab]           = useState<APARStatus>('Sehat');
  const [asc, setAsc]           = useState(true);
  const [showAll, setShowAll]   = useState(false);

  // 2) Hooks: filter & sort (useMemo selalu dipanggil)
  const filtered = useMemo(
    () => list.filter(i => i.status_apar === tab),
    [list, tab]
  );
  const sorted = useMemo(
    () =>
      filtered
        .slice()
        .sort((a, b) =>
          asc
            ? a.daysRemaining - b.daysRemaining
            : b.daysRemaining - a.daysRemaining
        ),
    [filtered, asc]
  );

  // 3) Setelah semua hook, bolehlah return spinner jika loading
  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  // 4) Variabel non-hook untuk rendering
  const dataToRender = showAll ? sorted : sorted.slice(0, 3);
  const sections = [{ title: 'StatsHeader', data: dataToRender }];

  const renderFooter = () => {
    if (sorted.length <= 3) return null;
    return (
      <ShowMoreButton onPress={() => setShowAll(v => !v)}>
        <ShowMoreText>
          {showAll ? 'Tampilkan Sedikit' : 'Lihat Semua'}
        </ShowMoreText>
      </ShowMoreButton>
    );
  };

  // 5) UI utamanya
  return (
    <Container>
      <Header />

      <SectionList<APAR>
        sections={sections}
        keyExtractor={(item, idx) =>
          item.id_apar && item.id_apar.trim() !== ''
            ? item.id_apar
            : idx.toString()
        }
        ListHeaderComponent={() => (
          <>
            <Stats trouble={stats.trouble} expired={stats.expired} />
            <Options router={router} />
          </>
        )}
        renderSectionHeader={() => (
          <StatsWrapper>
            <Tabs active={tab} onChange={setTab} />
            <Controls asc={asc} onToggle={() => setAsc(s => !s)} />
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

        ListFooterComponent={renderFooter}
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
