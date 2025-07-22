// src/components/IndexStats.tsx
import { Box } from '@/components/ui/boxApar';
import Colors from '@/constants/Colors';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import styled from 'styled-components/native';

const Row = styled.View`
  padding-top: 16px;
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const StatCard = styled(Box).attrs({ p: 16, mH: 8, radius: 8, elevation: 2 })`
  flex: 1;
  align-items: center;
`;

const StatCount = styled.Text`
  font-size: 20px;
  font-weight: bold;
  color: ${Colors.primary};
  margin-top: 4px;
`;

const StatLabel = styled.Text`
  font-size: 14px;
  color: ${Colors.text};
  text-align: center;
`;

export default function IndexStats() {
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

  const totalData = data.length;
  // const expiredCount = data.filter(item => item.status_apar === 'expired').length;
  const MaintenanceCount = data.filter(item => item.status_apar === 'Maintenance').length;
  // const troubleCount = data.filter(item =>
  //   ['maintenance', 'rusak'].includes(item.status_apar)
  // ).length;

  const stats = [
    { label: 'Maintenance', count: MaintenanceCount, color: Colors.badge.Maintenance },
    // { label: 'Trouble',   count: troubleCount, color: Colors.badge.Trouble },
    // { label: 'Expired',   count: expiredCount, color: Colors.badge.Expired },
    { label: 'Total Apar',count: totalData,    color: Colors.primary }
  ];

  return (
    <Row>
      {stats.map(s => (
        <StatCard key={s.label}>
          <StatCount>{s.count}</StatCount>
          <StatLabel>{s.label}</StatLabel>
        </StatCard>
      ))}
    </Row>
  );
}
