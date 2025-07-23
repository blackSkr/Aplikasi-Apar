// src/components/Header.tsx
import React, { FC, useEffect, useState } from 'react';
import { GestureResponderEvent } from 'react-native';
import styled from 'styled-components/native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '@/constants/Colors';
// pastikan kamu sudah install package:
//   expo install @react-native-community/netinfo
import { useNetInfo } from '@react-native-community/netinfo';

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
  shadow-color: #000;
  shadow-offset: 10px 10px;
  shadow-opacity: 2;
  shadow-radius: 100px;
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
  shadow-color: #000;
  shadow-offset: 0px 2px;
  shadow-opacity: 0.1;
  shadow-radius: 4px;
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

type HeaderProps = {
  /**
   * Dipanggil saat user menekan tombol Logout.
   */
  onLogout: (e: GestureResponderEvent) => void;
};

const Header: FC<HeaderProps> = ({ onLogout }) => {
  const [now, setNow] = useState(new Date());
  const netInfo = useNetInfo();
  const isConnected = netInfo.isConnected;

  // Update waktu setiap detik
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = now.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

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
            <TitleText>Manajemen APAR</TitleText>
            <SubtitleText>Halo, Satria!</SubtitleText>
          </TitleGroup>
        </LogoTitle>

        <LogoutButton onPress={onLogout} accessibilityLabel="Logout">
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </LogoutButton>
      </TopRow>

      <TimeRow>
        <Ionicons
          name="calendar-outline"
          size={14}
          color="rgba(255,255,255,0.8)"
        />
        <TimeText>{dateStr}</TimeText>

        <Ionicons
          name="time-outline"
          size={14}
          color="rgba(255,255,255,0.8)"
          style={{ marginLeft: 16 }}
        />
        <TimeText>{timeStr}</TimeText>

        {/* Indikator koneksi */}
        <Ionicons
          name={isConnected ? 'wifi' : 'wifi-off'}
          size={14}
          color="rgba(255,255,255,0.8)"
          style={{ marginLeft: 12 }}
        />
      </TimeRow>
    </HeaderContainer>
  );
};

export default Header;
