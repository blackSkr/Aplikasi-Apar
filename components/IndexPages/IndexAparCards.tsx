// components/IndexPages/IndexAparCards.tsx
import { IconSymbol } from '@/components/ui/IconSymbol';
import Colors from '@/constants/Colors';
import type { APAR } from '@/hooks/useAparList';
import React, { useMemo } from 'react';
import * as Progress from 'react-native-progress';
import styled from 'styled-components/native';

function getStatusConfig(item: APAR) {
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

function formatDateString(dateString?: string, interval?: number) {
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
  item: APAR & {
    badge_petugas?: string;
    tanggal_selesai?: string;
  };
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

  // Tanggal selesai & berikutnya untuk Sudah Maintenance
  let tanggalSelesai = '-';
  let tanggalBerikut = '-';
  if (item.statusMaintenance === 'Sudah') {
    if (item.tanggal_selesai) {
      tanggalSelesai = new Date(item.tanggal_selesai).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } else if (item.nextDueDate) {
      tanggalSelesai = new Date(item.nextDueDate).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
    if (item.nextDueDate) {
      tanggalBerikut = new Date(item.nextDueDate).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    }
  }

  const badgePetugas =
    item.last_petugas_badge ||
    item.badge_petugas ||
    item.badgeNumber ||
    '-';

  // CARD SIMPLE: SUDAH MAINTENANCE
  if (item.statusMaintenance === 'Sudah') {
    return (
      <SimplePressable onPress={onPressDetails} android_ripple={{ color: '#eee' }}>
        <SimpleWrapper>
          <SuccessBar />
          <SimpleContent>
            <RowTop>
              <SimpleNo>{item.no_apar}</SimpleNo>
              <IconSymbol name="checkmark-circle" size={18} color={Colors.success} />
            </RowTop>
            <SimpleLocRow>
              <IconSymbol name="location" size={12} color={Colors.subtext} />
              <SimpleLocText>{item.lokasi_apar}</SimpleLocText>
            </SimpleLocRow>
            <DatesRow>
              <DateBlock>
                <DateLabel>Selesai</DateLabel>
                <DateValueSimple>{tanggalSelesai}</DateValueSimple>
              </DateBlock>
              <DateBlock>
                <DateLabel>Berikutnya</DateLabel>
                <DateValueSimple>{tanggalBerikut}</DateValueSimple>
              </DateBlock>
            </DatesRow>
            <PetugasRow>
              <PetugasLabel>Petugas:</PetugasLabel>
              <PetugasText>{badgePetugas}</PetugasText>
            </PetugasRow>
          </SimpleContent>
        </SimpleWrapper>
      </SimplePressable>
    );
  }

  // CARD DETAIL: BELUM MAINTENANCE
  return (
    <CardPressable onPress={onPressDetails} android_ripple={{ color: '#eee' }}>
      <CardWrapper>
        <StatusBar color={status.color} />
        <CardContent>
          <TopRow>
            <AparNo>{item.no_apar}</AparNo>
            <BadgeContainer color={status.color}>
              <IconSymbol name={status.icon} size={15} color={status.color} />
              <BadgeText color={status.color}>{item.statusMaintenance}</BadgeText>
            </BadgeContainer>
          </TopRow>
          <LocationRow>
            <IconSymbol name="location" size={13} color={Colors.subtext} />
            <LocationText>{item.lokasi_apar}</LocationText>
          </LocationRow>
          <StatusText color={status.color}>{status.text}</StatusText>
          <SubStatusText>{status.subtext}</SubStatusText>
          <ProgressWrap>
            <Progress.Bar
              progress={progress}
              width={null}
              height={5}
              color={status.color}
              unfilledColor="#ededed"
              borderWidth={0}
              borderRadius={2}
            />
            <ProgressLabel>{Math.round(progress * 100)}% complete</ProgressLabel>
          </ProgressWrap>
          <DateRow>
            <DateCol>
              <DateLabelRow>Terakhir</DateLabelRow>
              <DateValue>{last}</DateValue>
            </DateCol>
            <DateDivider />
            <DateCol>
              <DateLabelRow>Selanjutnya</DateLabelRow>
              <DateValue>{next}</DateValue>
            </DateCol>
          </DateRow>
        </CardContent>
      </CardWrapper>
    </CardPressable>
  );
}

// ========== Styled Components ==========
// --- Card Belum Maintenance ---
const CardPressable = styled.Pressable`
  margin: 10px 14px 0 14px;
`;
const CardWrapper = styled.View`
  flex-direction: row;
  background: #fff;
  border-radius: 18px;
  border: 1.2px solid #efefef;
  elevation: 3;
  shadow-color: #000;
  shadow-opacity: 0.09;
  shadow-offset: 0px 2px;
  shadow-radius: 10px;
  overflow: hidden;
`;
const StatusBar = styled.View<{ color: string }>`
  width: 5px;
  background-color: ${({ color }) => color};
`;
const CardContent = styled.View`
  flex: 1;
  padding: 18px 18px 14px 18px;
`;
const TopRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;
const AparNo = styled.Text`
  font-size: 20px;
  font-weight: bold;
  color: ${Colors.text};
`;
const BadgeContainer = styled.View<{ color: string }>`
  flex-direction: row;
  align-items: center;
  background-color: ${({ color }) => `${color}19`};
  padding: 5px 14px;
  border-radius: 20px;
`;
const BadgeText = styled.Text<{ color: string }>`
  margin-left: 4px;
  font-size: 12px;
  font-weight: 700;
  color: ${({ color }) => color};
`;
const LocationRow = styled.View`
  flex-direction: row;
  align-items: center;
  margin: 7px 0 8px 0;
`;
const LocationText = styled.Text`
  margin-left: 6px;
  font-size: 14px;
  color: ${Colors.subtext};
  opacity: 0.84;
`;
const StatusText = styled.Text<{ color: string }>`
  font-size: 16px;
  font-weight: 700;
  color: ${({ color }) => color};
  margin-top: 3px;
  margin-bottom: 1px;
`;
const SubStatusText = styled.Text`
  font-size: 13px;
  color: ${Colors.subtext};
  opacity: 0.75;
  margin-bottom: 10px;
`;
const ProgressWrap = styled.View`
  margin-bottom: 10px;
`;
const ProgressLabel = styled.Text`
  font-size: 11px;
  color: ${Colors.subtext};
  margin-top: 5px;
  text-align: right;
`;
const DateRow = styled.View`
  flex-direction: row;
  align-items: center;
  margin-top: 7px;
`;
const DateCol = styled.View`
  flex: 1;
`;
const DateLabelRow = styled.Text`
  font-size: 11px;
  color: ${Colors.subtext};
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.6px;
  margin-bottom: 2px;
`;
const DateValue = styled.Text`
  font-size: 13px;
  color: ${Colors.text};
  font-weight: 500;
`;
const DateDivider = styled.View`
  width: 1px;
  height: 22px;
  background-color: #ececec;
  margin: 0 14px;
  opacity: 0.32;
`;

// --- Card Simple (Sudah Maintenance) ---
const SimplePressable = styled.Pressable`
  margin: 10px 14px 0 14px;
`;
const SimpleWrapper = styled.View`
  flex-direction: row;
  background: #f6fff8;
  border-radius: 14px;
  border: 1.2px solid #cde9dc;
  elevation: 1;
  shadow-color: #000;
  shadow-opacity: 0.05;
  shadow-offset: 0px 1px;
  shadow-radius: 4px;
  overflow: hidden;
`;
const SuccessBar = styled.View`
  width: 5px;
  background-color: ${Colors.success};
`;
const SimpleContent = styled.View`
  flex: 1;
  padding: 14px 16px 8px 16px;
`;
const RowTop = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;
const SimpleNo = styled.Text`
  font-size: 17px;
  font-weight: bold;
  color: #227242;
`;
const SimpleLocRow = styled.View`
  flex-direction: row;
  align-items: center;
  margin: 6px 0 3px 0;
`;
const SimpleLocText = styled.Text`
  margin-left: 5px;
  font-size: 13px;
  color: #387c5b;
  opacity: 0.88;
`;
const DatesRow = styled.View`
  flex-direction: row;
  align-items: center;
  margin-top: 6px;
  margin-bottom: 2px;
  gap: 10px;
`;
const DateBlock = styled.View`
  flex: 1;
  align-items: flex-start;
`;
const DateLabel = styled.Text`
  font-size: 11px;
  color: #2e7d32;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.5px;
  margin-bottom: 2px;
`;
const DateValueSimple = styled.Text`
  font-size: 12px;
  color: #388e3c;
  font-weight: 700;
`;
const PetugasRow = styled.View`
  flex-direction: row;
  align-items: center;
  margin-top: 2px;
`;
const PetugasLabel = styled.Text`
  font-size: 12px;
  color: #2e7d32;
  font-weight: 600;
  margin-right: 4px;
`;
const PetugasText = styled.Text`
  font-size: 12px;
  color: #14614f;
  font-weight: 600;
`;
