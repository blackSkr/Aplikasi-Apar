// src/components/IndexAparCard.tsx

import { IconSymbol } from '@/components/ui/IconSymbol';
import Colors from '@/constants/Colors';
import type { APAR } from '@/hooks/useAparList';
import React, { useMemo } from 'react';
import * as Progress from 'react-native-progress';
import styled from 'styled-components/native';

type Urgency = 'completed' | 'overdue' | 'due-today' | 'due-soon' | 'normal';

interface StatusConfig {
  color: string;
  icon: 'checkmark-circle' | 'time';
  text: string;
  subtext: string;
}

function getStatusConfig(item: APAR): StatusConfig {
  const days = item.daysRemaining;
  const interval = item.interval_maintenance;

  if (item.statusMaintenance === 'Sudah') {
    return {
      color: Colors.success,
      icon: 'checkmark-circle',
      text: 'Selesai',
      subtext: 'Maintenance completed',
    };
  }

  if (days < 0) {
    return {
      color: Colors.error,
      icon: 'time',
      text: `${Math.abs(days)} hari terlambat`,
      subtext: 'Overdue maintenance',
    };
  }

  if (days === 0) {
    return {
      color: Colors.warning,
      icon: 'time',
      text: 'Jatuh tempo hari ini',
      subtext: 'Due today',
    };
  }

  if (days <= Math.ceil(interval * 0.3)) {
    return {
      color: Colors.warning,
      icon: 'time',
      text: `${days} hari lagi`,
      subtext: 'Due soon',
    };
  }

  return {
    color: Colors.primary,
    icon: 'time',
    text: `${days} hari lagi`,
    subtext: 'Scheduled maintenance',
  };
}

function formatDateString(dateString?: string, interval?: number): { last: string; next: string } {
  if (!dateString) return { last: '-', next: '-' };

  const nextDate = new Date(dateString);
  const lastDate = interval
    ? new Date(nextDate.getTime() - interval * 86400000)
    : null;

  const fmt = (d?: Date) =>
    d
      ? d.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      : '-';

  return { last: fmt(lastDate), next: fmt(nextDate) };
}

export default function IndexAparCard({
  item,
  onPressDetails,
}: {
  item: APAR;
  onPressDetails: () => void;
}) {
  const status = useMemo(() => getStatusConfig(item), [item]);
  const { last, next } = useMemo(
    () => formatDateString(item.nextDueDate, item.interval_maintenance),
    [item.nextDueDate, item.interval_maintenance]
  );

  const progress =
    item.statusMaintenance === 'Sudah'
      ? 1
      : item.interval_maintenance > 0
      ? Math.min(1, (item.interval_maintenance - item.daysRemaining) / item.interval_maintenance)
      : 0;

  return (
    <Wrapper onPress={onPressDetails} android_ripple={{ color: '#f0f0f0' }}>
      <Container>
        <Accent color={status.color} />

        <Content>
          <Header>
            <Left>
              <Number>{item.no_apar}</Number>
              <Location numberOfLines={1}>
                <IconSymbol name="location" size={12} color={Colors.subtext} />
                <LocationText>{item.lokasi_apar}</LocationText>
              </Location>
            </Left>

            <BadgeContainer color={status.color}>
              <IconSymbol name={status.icon} size={16} color={status.color} />
              <BadgeText color={status.color}>{item.statusMaintenance}</BadgeText>
            </BadgeContainer>
          </Header>

          <MainStatus>
            <StatusText color={status.color}>{status.text}</StatusText>
            <Subtext>{status.subtext}</Subtext>
          </MainStatus>

          <ProgressWrapper>
            <Progress.Bar
              progress={progress}
              width={null}
              height={4}
              color={status.color}
              unfilledColor={`${status.color}20`}
              borderWidth={0}
              borderRadius={2}
            />
            <ProgressLabel>{Math.round(progress * 100)}% complete</ProgressLabel>
          </ProgressWrapper>

          <Dates>
            <DateBlock>
              <DateLabel>Terakhir</DateLabel>
              <DateValue>{last}</DateValue>
            </DateBlock>

            <Divider />

            <DateBlock>
              <DateLabel>Selanjutnya</DateLabel>
              <DateValue>{next}</DateValue>
            </DateBlock>
          </Dates>
        </Content>
      </Container>
    </Wrapper>
  );
}

// ===== styled-components =====

const Wrapper = styled.Pressable`
  margin: 6px 16px;
`;

const Container = styled.View`
  flex-direction: row;
  background: #fff;
  border-radius: 16px;
  border: 1px solid #f0f0f0;
  elevation: 2;
  shadow-color: #000;
  shadow-opacity: 0.08;
  shadow-offset: 0px 2px;
  shadow-radius: 12px;
  overflow: hidden;
`;

const Accent = styled.View<{ color: string }>`
  width: 4px;
  background-color: ${({ color }) => color};
`;

const Content = styled.View`
  flex: 1;
  padding: 20px;
`;

const Header = styled.View`
  flex-direction: row;
  justify-content: space-between;
  margin-bottom: 16px;
`;

const Left = styled.View`
  flex: 1;
  margin-right: 12px;
`;

const Number = styled.Text`
  font-size: 20px;
  font-weight: 700;
  color: ${Colors.text};
  margin-bottom: 4px;
`;

const Location = styled.Text`
  flex-direction: row;
  align-items: center;
`;

const LocationText = styled.Text`
  margin-left: 4px;
  font-size: 13px;
  color: ${Colors.subtext};
  opacity: 0.8;
`;

const BadgeContainer = styled.View<{ color: string }>`
  flex-direction: row;
  align-items: center;
  padding: 6px 12px;
  border-radius: 20px;
  background-color: ${({ color }) => `${color}15`};
`;

const BadgeText = styled.Text<{ color: string }>`
  margin-left: 4px;
  font-size: 12px;
  font-weight: 600;
  color: ${({ color }) => color};
`;

const MainStatus = styled.View`
  margin-bottom: 16px;
`;

const StatusText = styled.Text<{ color: string }>`
  font-size: 16px;
  font-weight: 600;
  color: ${({ color }) => color};
  margin-bottom: 2px;
`;

const Subtext = styled.Text`
  font-size: 13px;
  color: ${Colors.subtext};
  opacity: 0.7;
`;

const ProgressWrapper = styled.View`
  margin-bottom: 16px;
`;

const ProgressLabel = styled.Text`
  font-size: 11px;
  color: ${Colors.subtext};
  margin-top: 6px;
  text-align: right;
`;

const Dates = styled.View`
  flex-direction: row;
  align-items: center;
`;

const DateBlock = styled.View`
  flex: 1;
`;

const DateLabel = styled.Text`
  font-size: 11px;
  color: ${Colors.subtext};
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
`;

const DateValue = styled.Text`
  font-size: 13px;
  color: ${Colors.text};
  font-weight: 500;
`;

const Divider = styled.View`
  width: 1px;
  height: 24px;
  background-color: ${Colors.border};
  margin: 0 16px;
  opacity: 0.3;
`;
