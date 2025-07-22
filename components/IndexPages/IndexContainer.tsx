// src/components/Container.tsx
import React from 'react';
import styled from 'styled-components/native';
import Colors from '@/constants/Colors';

const SafeArea = styled.SafeAreaView`
  flex: 1;
  background-color: ${Colors.background};
`;

export function Container({ children }: { children: React.ReactNode }) {
  return <SafeArea>{children}</SafeArea>;
}
