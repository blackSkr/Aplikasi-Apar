// components/IndexPages/Header.tsx
import Colors from '@/constants/Colors';
import { useBadge } from '@/context/BadgeContext';
import { Ionicons } from '@expo/vector-icons';
import { useNetInfo } from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import React, { FC, useEffect, useState } from 'react';
import { GestureResponderEvent } from 'react-native';
import styled from 'styled-components/native';
import { baseUrl } from '../../src/config';

type HeaderProps = {
  onLogout: (e: GestureResponderEvent) => void;
  selectedJenis?: string | null;
};

const Header: FC<HeaderProps> = ({ onLogout, selectedJenis }) => {
  const [now, setNow]         = useState(new Date());
  const [lokasi, setLokasi]   = useState<string>('');
  const [loadingLokasi, setLoadingLokasi] = useState(false);
  const netInfo    = useNetInfo();
  const isConnected = netInfo.isConnected;
  const { badgeNumber } = useBadge();

  useEffect(() => {
    let ignore = false;
    const fetchLokasi = async () => {
      if (!badgeNumber) {
        setLokasi('');
        return;
      }
      setLoadingLokasi(true);
      try {
        const res  = await fetch(`${baseUrl}/api/petugas/lokasi/${badgeNumber}`);
        if (!res.ok) throw new Error('not found');
        const data = await res.json();
        if (!ignore) setLokasi(data.lokasi || '');
      } catch {
        if (!ignore) setLokasi('');
      } finally {
        if (!ignore) setLoadingLokasi(false);
      }
    };
    fetchLokasi();
    return () => { ignore = true; };
  }, [badgeNumber]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });

  const hour = now.getHours();
  let greeting = 'Halo';
  if (hour < 12) greeting = 'Selamat pagi';
  else if (hour < 15) greeting = 'Selamat siang';
  else if (hour < 18) greeting = 'Selamat sore';
  else greeting = 'Selamat malam';

  const subtitle = badgeNumber
    ? `${greeting}, ${badgeNumber}!`
    : `${greeting}!`;

  return (
    <HeaderContainer>
      <TopRow>
        <LogoTitle>
          <LogoWrapper>
            <Logo
              source={require('../../assets/images/kpc-logo.png')}
              resizeMode="contain"
            />
          </LogoWrapper>
          <TitleGroup>
            <TitleText>
              Manajemen {selectedJenis ? `- ${selectedJenis}` : ''}
            </TitleText>
            <SubtitleText>{subtitle}</SubtitleText>
            <LokasiText>
              <Ionicons name="location-outline" size={12} color="#fff" />
              <LokasiLabel numberOfLines={1}>
                {loadingLokasi
                  ? 'Memuat lokasi...'
                  : lokasi
                  ? lokasi
                  : 'Lokasi tidak ditemukan'}
              </LokasiLabel>
            </LokasiText>
          </TitleGroup>
        </LogoTitle>
        <LogoutButton onPress={onLogout} accessibilityLabel="Logout">
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </LogoutButton>
      </TopRow>
      <TimeRow>
        <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.8)" />
        <TimeText>{dateStr}</TimeText>
        <Ionicons
          name="time-outline"
          size={14}
          color="rgba(255,255,255,0.8)"
          style={{ marginLeft: 16 }}
        />
        <TimeText>{timeStr}</TimeText>
        <Ionicons
          name={isConnected ? 'wifi' : 'cloud-offline-outline'}
          size={14}
          color="rgba(255,255,255,0.8)"
          style={{ marginLeft: 12 }}
        />
      </TimeRow>
    </HeaderContainer>
  );
};

export default Header;

const HeaderContainer = styled(LinearGradient).attrs({
  colors: [Colors.primaryheader, Colors.primaryLight],
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
})`
  width: 100%;
  padding-top: ${Constants.statusBarHeight + 20}px;
  padding-horizontal: 20px;
  padding-bottom: 20px;
  border-bottom-left-radius: 35px;
  border-bottom-right-radius: 35px;
  elevation: 8;
`;

const TopRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const LogoTitle = styled.View`
  flex-direction: row;
  align-items: center;
`;

const LogoWrapper = styled.View`
  width: 48px;
  height: 48px;
  background-color: #fff;
  border-radius: 24px;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  elevation: 4;
`;

const Logo = styled.Image`
  width: 28px;
  height: 28px;
`;

const TitleGroup = styled.View``;

const TitleText = styled.Text`
  color: #fff;
  font-size: 20px;
  font-weight: 700;
`;

const SubtitleText = styled.Text`
  color: rgba(255,255,255,0.85);
  font-size: 13px;
  margin-top: 2px;
`;

const LokasiText = styled.View`
  flex-direction: row;
  align-items: center;
  margin-top: 2px;
`;

const LokasiLabel = styled.Text`
  color: #fff;
  font-size: 13px;
  margin-left: 4px;
  opacity: 0.85;
  max-width: 170px;
`;

const LogoutButton = styled.TouchableOpacity`
  padding: 8px;
  background-color: rgba(255,255,255,0.3);
  border-radius: 16px;
`;

const TimeRow = styled.View`
  padding-left: 60px;
  flex-direction: row;
  align-items: center;
  margin-top: 10px;
`;

const TimeText = styled.Text`
  color: rgba(255,255,255,0.8);
  font-size: 12px;
  margin-left: 6px;
`;
