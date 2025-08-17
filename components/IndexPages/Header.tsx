// components/IndexPages/Header.tsx
import Colors from '@/constants/Colors';
import { useBadge } from '@/context/BadgeContext';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetInfo } from '@react-native-community/netinfo';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import React, { FC, useEffect, useMemo, useState } from 'react';
import { GestureResponderEvent } from 'react-native';
import styled from 'styled-components/native';
import { baseUrl } from '../../src/config';

type HeaderProps = {
  onLogout: (e: GestureResponderEvent) => void;
  selectedJenis?: string | null;
};

type Profile = { badgeNumber: string; nama?: string; lokasi?: string };

const prettify = (s?: string | null) => {
  if (!s) return '';
  const str = s.trim();
  if (!str) return '';
  return str
    .split(' ')
    .map(w => (w.length ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ');
};

const Header: FC<HeaderProps> = ({ onLogout, selectedJenis }) => {
  const [now, setNow] = useState(new Date());
  const [lokasi, setLokasi] = useState<string>('');
  const [nama, setNama] = useState<string>('');
  const [loadingProfile, setLoadingProfile] = useState(false);

  const netInfo = useNetInfo();
  const isConnected = !!netInfo.isConnected;
  const { badgeNumber } = useBadge();
  const jenisLabel = useMemo(() => prettify(selectedJenis), [selectedJenis]);

  useEffect(() => {
    let ignore = false;

    const fetchProfile = async () => {
      if (!badgeNumber) {
        setNama('');
        setLokasi('');
        return;
      }
      setLoadingProfile(true);
      const cacheKey = `PETUGAS_PROFILE_${badgeNumber}`;

      try {
        const res = await fetch(
          `${baseUrl}/api/petugas/profile/${encodeURIComponent(badgeNumber)}`
        );
        if (!res.ok) throw new Error('not found');
        const data: Profile = await res.json();

        if (!ignore) {
          setNama(data?.nama?.trim?.() || '');
          setLokasi(data?.lokasi?.trim?.() || '');
        }

        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      } catch {
        const cached = await AsyncStorage.getItem(cacheKey);
        if (cached && !ignore) {
          const data: Profile = JSON.parse(cached);
          setNama(data?.nama?.trim?.() || '');
          setLokasi(data?.lokasi?.trim?.() || '');
        } else if (!ignore) {
          setNama('');
          setLokasi('');
        }
      } finally {
        if (!ignore) setLoadingProfile(false);
      }
    };

    fetchProfile();
    return () => {
      ignore = true;
    };
  }, [badgeNumber]);

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

  const hour = now.getHours();
  let greeting = 'Halo';
  if (hour < 12) greeting = 'Selamat pagi';
  else if (hour < 15) greeting = 'Selamat siang';
  else if (hour < 18) greeting = 'Selamat sore';
  else greeting = 'Selamat malam';

  const displayName = nama?.trim() || badgeNumber || '';
  const subtitle = displayName
    ? `${greeting}, ${displayName}!`
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
            {jenisLabel ? (
              <TitleRow>
                <TitleText numberOfLines={1} ellipsizeMode="tail">
                  Manajemen
                </TitleText>
                <Dash />
                <JenisText numberOfLines={1} ellipsizeMode="tail">
                  {jenisLabel}
                </JenisText>
              </TitleRow>
            ) : (
              <TitleRow>
                <JenisText numberOfLines={1} ellipsizeMode="tail">
                  Manajemen Alat
                </JenisText>
              </TitleRow>
            )}

            <SubtitleText numberOfLines={1} ellipsizeMode="tail">
              {subtitle}
            </SubtitleText>

            <LokasiText>
              <Ionicons name="location-outline" size={12} color="#fff" />
              <LokasiLabel numberOfLines={1}>
                {loadingProfile
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

/* =================== styled =================== */
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
  flex: 1;
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

const TitleGroup = styled.View`
  flex: 1;
`;

const TitleRow = styled.View`
  flex-direction: row;
  align-items: baseline;
  max-width: 92%;
`;

const TitleText = styled.Text`
  color: #fff;
  font-size: 20px;
  font-weight: 700;
`;

const Dash = styled.View`
  width: 6px;
`;

const JenisText = styled.Text`
  color: #fff;
  font-size: 20px;
  font-weight: 700;
  opacity: 0.95;
`;

const SubtitleText = styled.Text`
  color: rgba(255, 255, 255, 0.85);
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
  max-width: 200px;
`;

const LogoutButton = styled.TouchableOpacity`
  padding: 8px;
  background-color: rgba(255, 255, 255, 0.3);
  border-radius: 16px;
  margin-left: 12px;
`;

const TimeRow = styled.View`
  padding-left: 60px;
  flex-direction: row;
  align-items: center;
  margin-top: 10px;
`;

const TimeText = styled.Text`
  color: rgba(255, 255, 255, 0.8);
  font-size: 12px;
  margin-left: 6px;
`;
