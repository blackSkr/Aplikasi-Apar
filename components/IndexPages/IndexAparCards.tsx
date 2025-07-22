// src/components/IndexAparCard.tsx

import { IconSymbol } from '@/components/ui/IconSymbol';
import Colors from '@/constants/Colors';
import type { APAR } from '@/hooks/useAparList';
import React from 'react';
import { Pressable, View } from 'react-native';
import styled from 'styled-components/native';

const CardContainer = styled.View`
  background-color: #fff;
  align-self: center;
  width: 92%;
  margin-vertical: 8px;
  padding: 16px;
  border-radius: 12px;
  elevation: 2;
  shadow-color: #000;
  shadow-opacity: 0.1;
  shadow-offset: 0px 2px;
  shadow-radius: 4px;
`;

const CardHeader = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const CardTitle = styled.Text`
  color: ${Colors.text};
  font-size: 16px;
  font-weight: bold;
`;

const CardSub = styled.Text`
  color: ${Colors.subtext};
  font-size: 14px;
  margin-top: 4px;
`;

const Badge = styled.View<{ status: APAR['status_apar'] }>`
  background-color: ${({ status }) => Colors.badge[status]};
  padding: 4px 10px;
  border-radius: 12px;
`;

const BadgeText = styled.Text`
  color: #fff;
  font-size: 12px;
  font-weight: 600;
`;

const ProgressInfo = styled.View`
  flex-direction: row;
  align-items: center;
  margin-top: 12px;
`;

const ProgressText = styled.Text`
  color: ${Colors.subtext};
  font-size: 14px;
  margin-left: 8px;
`;

const ProgressBarRow = styled.View`
  flex-direction: row;
  align-items: center;
  margin-top: 8px;
`;

const ProgressBarContainer = styled.View`
  flex: 1;
  height: 6px;
  background-color: ${Colors.border};
  border-radius: 3px;
  overflow: hidden;
`;

const ProgressFill = styled.View<{
  percent: number;
  status: APAR['status_apar'];
}>`
  width: ${({ percent }) => `${percent}%`};
  height: 100%;
  background-color: ${({ status }) => Colors.badge[status]};
`;

const ProgressDate = styled.Text`
  color: ${Colors.subtext};
  font-size: 13px;
  margin-left: 12px;
`;

const PetugasText = styled.Text`
  color: ${Colors.subtext};
  font-size: 13px;
  margin-top: 12px;
`;

export default function IndexAparCard({
  item,
  onPressDetails,
}: {
  item: APAR;
  onPressDetails: () => void;
}) {
  // hitung % progress berdasarkan interval_maintenance
  const percent =
    item.status_apar === 'Expired'
      ? 100
      : Math.min(
          100,
          Math.max(
            0,
            ((item.interval_maintenance - item.daysRemaining) /
              item.interval_maintenance) *
              100
          )
        );

  return (
    <Pressable style={{ width: '100%' }}>
      <CardContainer>
        <CardHeader>
          <View>
            <CardTitle>
              {item.no_apar} — {item.jenis_apar}
            </CardTitle>
            <CardSub>{item.lokasi_apar}</CardSub>
          </View>
          <Badge status={item.status_apar}>
            <BadgeText>{item.status_apar}</BadgeText>
          </Badge>
        </CardHeader>

        <ProgressInfo>
          <IconSymbol name="timer" size={16} color={Colors.primary} />
          <ProgressText>
            Maintenance due in{' '}
            {item.daysRemaining >= 0
              ? `${item.daysRemaining} days`
              : '–'}
          </ProgressText>
        </ProgressInfo>

        <ProgressBarRow>
          <ProgressBarContainer>
            <ProgressFill
              percent={percent}
              status={item.status_apar}
            />
          </ProgressBarContainer>
          <ProgressDate>{item.nextCheckDate}</ProgressDate>
        </ProgressBarRow>

        <PetugasText>Petugas: {item.keterangan || '-'}</PetugasText>
      </CardContainer>
    </Pressable>
  );
}
