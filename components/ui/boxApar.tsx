// src/components/ui/Apar.tsx
import styled from 'styled-components/native';

export const Box = styled.View<{
  p?: number;
  mV?: number;
  mH?: number;
  radius?: number;
  elevation?: number;
}>`
  background-color: #fff;
  padding: ${({ p }) => p ?? 0}px;
  margin-vertical: ${({ mV }) => mV ?? 0}px;
  margin-horizontal: ${({ mH }) => mH ?? 0}px;
  border-radius: ${({ radius }) => radius ?? 0}px;
  elevation: ${({ elevation }) => elevation ?? 0};
  shadow-color: #000;
  shadow-opacity: 0.1;
  shadow-offset: 0px ${({ elevation }) => (elevation ?? 0) / 2}px;
  shadow-radius: ${({ elevation }) => (elevation ?? 0) * 2}px;
`;
