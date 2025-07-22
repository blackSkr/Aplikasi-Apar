// src/components/IndexPages/IndexAparOverview.tsx

import Colors from '@/constants/Colors';
import { useAparList } from '@/hooks/useAparList';
import type { APAR } from '@/types';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Text,
    TouchableOpacity
} from 'react-native';
import styled from 'styled-components/native';
import IndexAparCards from './IndexAparCards';
import Controls from './IndexControl';
import Tabs from './IndexTabs';

const Container = styled.View`
  flex: 1;
  background-color: #f5f5f5;
`;

const ShowMoreButton = styled(TouchableOpacity)`
  padding: 12px;
  align-items: center;
`;

const ShowMoreText = styled(Text)`
  color: ${Colors.primary};
  font-weight: 600;
`;

export default function IndexAparOverview() {
  const { tab, setTab, asc, setAsc, stats, list, loading } = useAparList();
  const [showAll, setShowAll] = useState(false);

  const dataToRender: APAR[] = showAll ? list : list.slice(0, 3);

  const renderFooter = () => {
    if (list.length <= 3) return null;
    return (
      <ShowMoreButton onPress={() => setShowAll(prev => !prev)}>
        <ShowMoreText>
          {showAll ? 'Tampilkan Sedikit' : 'Lihat Semua'}
        </ShowMoreText>
      </ShowMoreButton>
    );
  };

  return (
    <Container>
      {/* 1) Tabs */}
      <Tabs active={tab} onChange={setTab} />

      {/* 2) Controls: toggle sort */}
      <Controls asc={asc} onToggle={() => setAsc(prev => !prev)} />

      {/* 3) Loading indicator */}
      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}

      {/* 4) List kartu */}
      {!loading && (
        <FlatList
          data={dataToRender}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <IndexAparCards
              item={item}
              onPressDetails={() => {
                /* navigation.navigate('Detail', { id: item.id }) */
              }}
            />
          )}
          ListFooterComponent={renderFooter()}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </Container>
  );
}
