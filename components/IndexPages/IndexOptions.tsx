// src/components/IndexOptions.tsx
import { IconSymbol } from '@/components/ui/IconSymbol';
import Colors from '@/constants/Colors';
import type { Router } from 'expo-router';
import React from 'react';
import styled from 'styled-components/native';

const Row = styled.View`
  flex-direction: row;
  justify-content: space-between;
  padding-bottom: 4%;
`;

const OptionCard = styled.Pressable`
  flex: 1;
  background-color: #fff;
  margin-horizontal: 8px;
  padding: 12px;
  border-radius: 8px;
  align-items: center;
  elevation: 2;
  shadow-color: #000;
  shadow-opacity: 0.1;
  shadow-offset: 0px 1px;
  shadow-radius: 2px;
`;

const OptionLabel = styled.Text`
  font-size: 14px;
  color: ${Colors.text};
  text-align: center;
`;

export default function Options({ router }: { router: Router }) {
  const options = [
    { label: 'Cara Penggunaan APAR', icon: 'book.fill', route: '/PenggunaanApar' },
    // { label: 'Tentang Aplikasi',    icon: 'info.circle.fill', route: '/TentangAplikasi' },
  ];

  return (
    <Row>
      {options.map(o => (
        <OptionCard key={o.label} onPress={() => router.push(o.route)}>
          <IconSymbol name={o.icon} size={24} color={Colors.primary} />
          <OptionLabel>{o.label}</OptionLabel>
        </OptionCard>
      ))}
    </Row>
  );
}
