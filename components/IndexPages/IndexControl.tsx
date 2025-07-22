// components/IndexPages/IndexControl.tsx

import Colors from '@/constants/Colors';
import React from 'react';
import styled from 'styled-components/native';

const Row = styled.View`
  flex-direction: row;
  justify-content: flex-end;
  padding-vertical: 8px;
  background-color: #f5f5f5;
`;

const ControlButton = styled.Pressable`
  margin-left: 16px;
  padding: 4px 8px;
`;

const ControlText = styled.Text`
  color: ${Colors.primary};
  font-weight: 600;
  font-size: 14px;
`;

export default function Controls({
  asc,
  onToggle,
}: {
  asc: boolean;
  onToggle: () => void;
}) {
  return (
    <Row>
      <ControlButton onPress={onToggle}>
        <ControlText>
          Sort by Remaining {asc ? '↑' : '↓'}
        </ControlText>
      </ControlButton>
    </Row>
  );
}
