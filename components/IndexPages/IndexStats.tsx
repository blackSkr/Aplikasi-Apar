// src/components/IndexStats.tsx
import { Box } from '@/components/ui/boxApar';
import Colors from '@/constants/Colors';
import React from 'react';
import { Dimensions, TouchableOpacity } from 'react-native';
import styled from 'styled-components/native';

const screenWidth = Dimensions.get('window').width;
const cardWidth = (screenWidth - 48) / 2;

const StatsContainer = styled.View`
  padding: 12px 16px;
  background-color: #f8f9fa;
`;

const Row = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
`;

const StatCard = styled(Box).attrs({ p: 14, mB: 12, radius: 8, elevation: 1 })`
  width: ${cardWidth}px;
  background-color: #fff;
  align-items: center;
  justify-content: center;
`;

const StatLabel = styled.Text`
  font-size: 13px;
  font-weight: 600;
  color: ${Colors.primary};
  text-align: center;
`;

export default function IndexStats({
  jenisList,
  onSelectJenis,
}: {
  jenisList: string[];
  onSelectJenis: (jenis: string) => void;
}) {
  return (
    <StatsContainer>
      <Row>
        {jenisList.map((jenis) => (
          <TouchableOpacity key={jenis} onPress={() => onSelectJenis(jenis)}>
            <StatCard>
              <StatLabel numberOfLines={2}>{jenis}</StatLabel>
            </StatCard>
          </TouchableOpacity>
        ))}
      </Row>
    </StatsContainer>
  );
}
