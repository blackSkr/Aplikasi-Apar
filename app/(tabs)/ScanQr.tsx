// app/(tabs)/ScanQr.tsx
import Colors from '@/constants/Colors';
import { useBadge } from '@/context/BadgeContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import styled from 'styled-components/native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ALLOW_NAV_WITHOUT_CACHE_WHEN_OFFLINE = false;

const ScanQr: React.FC = () => {
  const router = useRouter();
  const { badgeNumber } = useBadge();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [qrToken, setQrToken] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [hasLocalDetail, setHasLocalDetail] = useState<boolean>(false);
  const [checkingCache, setCheckingCache] = useState<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      let unsubNetInfo: ReturnType<typeof NetInfo.addEventListener> | null = null;

      setScanned(false);
      setQrToken('');
      setHasLocalDetail(false);

      unsubNetInfo = NetInfo.addEventListener(s => {
        const online = !!s.isConnected;
        setIsConnected(online);
      });

      return () => {
        if (unsubNetInfo) unsubNetInfo();
      };
    }, [])
  );

  const parseQrPayload = (raw: string): string | null => {
    try {
      const obj = JSON.parse(raw);
      const token = obj?.id || obj?.token || obj?.Id || obj?.Token;
      if (typeof token === 'string' && token.trim()) return token.trim();
    } catch {}
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    return null;
  };

  const cacheKeyFor = (token: string) => `APAR_DETAIL_token=${encodeURIComponent(token)}`;

  const checkLocalDetail = useCallback(async (token: string) => {
    setCheckingCache(true);
    try {
      const key = cacheKeyFor(token);
      const cached = await AsyncStorage.getItem(key);
      setHasLocalDetail(!!cached);
    } finally {
      setCheckingCache(false);
    }
  }, []);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    const token = parseQrPayload(data);
    if (!token) {
      Alert.alert('QR tidak valid', 'Gunakan QR JSON `{ "id": "..." }` atau token string.');
      return;
    }
    setQrToken(token);
    setScanned(true);
    checkLocalDetail(token);
  };

  const canNavigate = useMemo(() => {
    if (!badgeNumber || !qrToken) return false;
    if (isConnected) return true;
    return hasLocalDetail || ALLOW_NAV_WITHOUT_CACHE_WHEN_OFFLINE;
  }, [badgeNumber, qrToken, isConnected, hasLocalDetail]);

  const goToDetail = async () => {
    if (!qrToken || !badgeNumber) {
      Alert.alert('QR tidak valid', 'Token atau badge tidak tersedia.');
      return;
    }
    if (!isConnected && !hasLocalDetail && !ALLOW_NAV_WITHOUT_CACHE_WHEN_OFFLINE) {
      Alert.alert('Butuh Data Lokal', 'Detail token ini belum tersimpan. Buka sekali saat online agar bisa diakses offline.');
      return;
    }
    router.push({ pathname: '/ManajemenApar/AparMaintenance', params: { token: qrToken } });
  };

  if (!permission) {
    return (
      <Centered>
        <Text>Meminta izin kamera…</Text>
      </Centered>
    );
  }

  if (!permission.granted) {
    return (
      <Centered>
        <Text>Butuh izin kamera untuk scan QR.</Text>
        <PrimaryButton onPress={requestPermission}>
          <ButtonText>BERIKAN IZIN</ButtonText>
        </PrimaryButton>
      </Centered>
    );
  }

  return (
    <Wrapper>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryheader} />

      <Header>
        <HeaderTitle>Scan QR APAR</HeaderTitle>
      </Header>

      {!isConnected && (
        <OfflineBanner>
          <OfflineText>
            📴 Offline — pemindaian tetap bisa.
            {' '}
            {checkingCache ? 'Mengecek cache…' : (qrToken ? (hasLocalDetail ? 'Detail tersedia offline.' : 'Detail belum tersimpan.') : '')}
          </OfflineText>
        </OfflineBanner>
      )}

      <Content>
        <ScannerContainer>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          />
          <Overlay>
            {scanned ? (
              <>
                <Ionicons name="checkmark-circle-outline" size={64} color={Colors.primary} />
                <HintText>Berhasil scan!</HintText>
                <DataText numberOfLines={1}>{qrToken}</DataText>

                {checkingCache ? (
                  <BadgeBox style={{ backgroundColor: '#9ca3af' }}>
                    <BadgeText>Mengecek cache…</BadgeText>
                  </BadgeBox>
                ) : (
                  <BadgeBox style={{ backgroundColor: hasLocalDetail ? '#059669' : '#dc2626' }}>
                    <BadgeText>{hasLocalDetail ? 'Tersedia Offline' : 'Belum Tersedia Offline'}</BadgeText>
                  </BadgeBox>
                )}

                <SmallBtn onPress={() => { setScanned(false); setQrToken(''); setHasLocalDetail(false); }}>
                  <SmallBtnText>Scan Ulang</SmallBtnText>
                </SmallBtn>
              </>
            ) : (
              <>
                <Ionicons name="qr-code-outline" size={64} color="#fff" />
                <HintText>Letakkan QR code di dalam frame</HintText>
              </>
            )}
          </Overlay>
        </ScannerContainer>

        <Instruction>
          {scanned ? 'Tekan tombol di bawah untuk lihat detail APAR.' : 'Setelah frame hijau, hasil scan akan muncul di sini.'}
        </Instruction>

        <PrimaryButton onPress={goToDetail} disabled={!canNavigate} activeOpacity={0.8}>
          <ButtonText>
            {isConnected ? 'LIHAT DETAIL' : (hasLocalDetail || ALLOW_NAV_WITHOUT_CACHE_WHEN_OFFLINE ? 'LIHAT DETAIL (Offline)' : 'DETAIL BELUM TERSIMPAN')}
          </ButtonText>
        </PrimaryButton>

        {!isConnected && scanned && !hasLocalDetail && !ALLOW_NAV_WITHOUT_CACHE_WHEN_OFFLINE && (
          <TinyNote>Buka sekali saat online agar detail ini tersimpan dan bisa diakses offline.</TinyNote>
        )}
      </Content>
    </Wrapper>
  );
};

export default ScanQr;

/** Styled Components **/
const Wrapper = styled.SafeAreaView` flex: 1; background-color: ${Colors.background}; `;
const Header = styled.View` height: 56px; background-color: ${Colors.primaryheader}; justify-content: center; align-items: center; elevation: 4; `;
const HeaderTitle = styled.Text` color: #fff; font-size: 20px; font-weight: bold; `;
const OfflineBanner = styled(View)` padding: 8px 12px; align-items: center; background: #fff3cd; `;
const OfflineText = styled(Text)` color: #7a5a00; font-size: 12px; text-align: center; `;
const Content = styled.View` flex: 1; padding: 24px; `;
const ScannerContainer = styled.View` flex: 1; border-radius: 12px; overflow: hidden; margin-bottom: 16px; background-color: #000; `;
const Overlay = styled.View` position: absolute; top: 0; right: 0; bottom: 0; left: 0; justify-content: center; align-items: center; padding: 16px; background-color: rgba(0,0,0,0.35); gap: 10px; `;
const HintText = styled.Text` color: #fff; margin-top: 8px; font-size: 16px; text-align: center; `;
const DataText = styled.Text` color: #fff; margin-top: 6px; font-size: 13px; padding-horizontal: 12px; text-align: center; `;
const Instruction = styled.Text` color: ${Colors.text}; font-size: 14px; text-align: center; margin: 8px 0 16px 0; `;
const PrimaryButton = styled.TouchableOpacity<{ disabled?: boolean }>` background-color: ${({ disabled }) => (disabled ? Colors.border : Colors.primary)}; padding-vertical: 16px; border-radius: 8px; align-items: center; `;
const ButtonText = styled.Text` color: #fff; font-size: 16px; font-weight: 600; `;
const Centered = styled.View` flex: 1; justify-content: center; align-items: center; `;
const BadgeBox = styled.View` padding: 6px 10px; border-radius: 14px; `;
const BadgeText = styled.Text` color: #fff; font-size: 12px; font-weight: 600; `;
const SmallBtn = styled(TouchableOpacity)` margin-top: 6px; padding: 8px 14px; background: #111827; border-radius: 8px; `;
const SmallBtnText = styled(Text)` color: #fff; font-size: 12px; font-weight: 600; `;
const TinyNote = styled(Text)` margin-top: 10px; color: ${Colors.textSecondary}; font-size: 12px; text-align: center; `;
