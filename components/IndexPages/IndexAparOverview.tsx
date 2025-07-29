// src/components/IndexPages/IndexAparOverview.tsx

import Colors from '@/constants/Colors';
import { useAparList } from '@/hooks/useAparList';
import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Text
} from 'react-native';
import styled from 'styled-components/native';
import IndexAparCards from './IndexAparCards';
import Controls from './IndexControl';
import Tabs from './IndexTabs';

const Container = styled.View`
  flex: 1;
  background-color: #f5f5f5;
`;

const LoadingMore = styled.View`
  padding: 16px;
  align-items: center;
`;

const EmptyText = styled.Text`
  text-align: center;
  color: ${Colors.subtext};
  margin-top: 40px;
`;

export default function IndexAparOverview() {
  const {
    tab,
    setTab,
    asc,
    setAsc,
    list,
    loading,
    hasMore,
    loadMore,
    refresh,
  } = useAparList();

  return (
    <Container>
      <Tabs active={tab} onChange={setTab} />
      <Controls asc={asc} onToggle={() => setAsc(prev => !prev)} />

      <FlatList
        data={list}
        keyExtractor={item => item.id_apar}
        renderItem={({ item }) => (
          <IndexAparCards
            item={item}
            onPressDetails={() => {
              // navigation.navigate('Detail', { id: item.id_apar });
            }}
          />
        )}
        ListEmptyComponent={
          !loading && <EmptyText>Belum ada data APAR.</EmptyText>
        }
        ListFooterComponent={() =>
          hasMore ? (
            <LoadingMore>
              <ActivityIndicator />
            </LoadingMore>
          ) : null
        }
        onRefresh={refresh}
        refreshing={loading}
        onEndReached={() => {
          if (!loading) loadMore();
        }}
        onEndReachedThreshold={0.5}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </Container>
  );
}
