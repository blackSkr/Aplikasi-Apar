import Colors from '@/constants/Colors';
import type { APARStatus } from '@/hooks/useAparList';
import React from 'react';
import styled from 'styled-components/native';

export type TabType = APARStatus;    // hanya tiga status

const Row = styled.View`
  background-color: #f5f5f5;
  flex-direction: row;
  border-bottom-width: 1px;
  border-bottom-color: ${Colors.border};
`;

const TabButton = styled.Pressable<{ active: boolean }>`
  flex: 1;
  padding-vertical: 12px;
  align-items: center;
  border-bottom-width: 2px;
  border-bottom-color: ${({ active }) =>
    active ? Colors.primary : 'transparent'};
`;

const TabLabel = styled.Text<{ active: boolean }>`
  color: ${({ active }) =>
    active ? Colors.primary : Colors.subtext};
  font-weight: ${({ active }) => (active ? '600' : '500')};
`;

interface TabsProps {
  active: TabType;
  onChange: (t: TabType) => void;   // pastikan onChange di–destructure
}

export default function Tabs({ active, onChange }: TabsProps) {
  const tabs: TabType[] = ['Sehat', 'Maintenance', 'Expired'];

  return (
    <Row>
      {tabs.map(t => (
        <TabButton
          key={t}
          active={t === active}
          onPress={() => onChange(t)}   // sekarang onChange pasti ada
        >
          <TabLabel active={t === active}>{t}</TabLabel>
        </TabButton>
      ))}
    </Row>
  );
}
