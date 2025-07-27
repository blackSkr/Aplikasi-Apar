// src/components/IndexStats.tsx
import { Box } from '@/components/ui/boxApar';
import Colors from '@/constants/Colors';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Dimensions, TouchableOpacity } from 'react-native';
import styled from 'styled-components/native';

const screenWidth = Dimensions.get('window').width;
const cardWidth = (screenWidth - 48) / 2; // 2 kartu per baris + padding

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

export default function IndexStats({ onSelectJenis }: { onSelectJenis: (jenis: string) => void }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchApar = async () => {
      try {
        const res = await fetch('http://192.168.245.1:3000/api/apar');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Error fetching APAR:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchApar();
  }, []);

  if (loading) {
    return <ActivityIndicator size="large" color={Colors.primary} />;
  }

  const jenisSet = new Set(data.map((item) => item.jenis_apar));
  const jenisList = Array.from(jenisSet);

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
