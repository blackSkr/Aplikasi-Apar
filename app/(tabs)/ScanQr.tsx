// app/(tabs)/ScanQr.tsx

import Colors from '@/constants/Colors';
import { useBadge } from '@/context/BadgeContext';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, StatusBar, StyleSheet, Text } from 'react-native';
import styled from 'styled-components/native';

const ScanQr: React.FC = () => {
  const router = useRouter();
  const { badgeNumber } = useBadge();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [qrData, setQrData] = useState<string>('');

  // Reset state tiap kali screen dapat fokus (misal: setelah kembali dari detail)
  useFocusEffect(
    useCallback(() => {
      setScanned(false);
      setQrData('');
    }, [])
  );

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    try {
      const parsed = JSON.parse(data);
      const token = parsed.id;
      if (!token) throw new Error();
      setQrData(token);    // simpan hanya ID
      setScanned(true);
    } catch {
      Alert.alert('QR tidak valid', 'Format QR harus JSON dengan properti `id`.');
    }
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

      <Content>
        <ScannerContainer>
          <CameraView
            style={StyleSheet.absoluteFill}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
          />
          <Overlay>
            {scanned ? (
              <>
                <Ionicons name="checkmark-circle-outline" size={64} color={Colors.primary} />
                <HintText>Berhasil scan!</HintText>
                <DataText numberOfLines={1}>{qrData}</DataText>
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
          {scanned
            ? 'Tekan tombol di bawah untuk lihat detail APAR.'
            : 'Setelah frame hijau, hasil scan akan muncul di sini.'}
        </Instruction>

        <PrimaryButton
          onPress={() => {
            if (!qrData || !badgeNumber) {
              Alert.alert('QR tidak valid', 'Token atau badge tidak tersedia.');
              return;
            }
            router.push(
              `/apar/MaintenanceApar?token=${encodeURIComponent(qrData)}&badge=${encodeURIComponent(badgeNumber)}`
            );
          }}
          disabled={!scanned}
          activeOpacity={0.8}
        >
          <ButtonText>LIHAT DETAIL</ButtonText>
        </PrimaryButton>
      </Content>
    </Wrapper>
  );
};

export default ScanQr;

/** Styled Components **/
const Wrapper = styled.SafeAreaView`
  flex: 1;
  background-color: ${Colors.background};
`;

const Header = styled.View`
  height: 56px;
  background-color: ${Colors.primaryheader};
  justify-content: center;
  align-items: center;
  elevation: 4;
`;

const HeaderTitle = styled.Text`
  color: #fff;
  font-size: 20px;
  font-weight: bold;
`;

const Content = styled.View`
  flex: 1;
  padding: 24px;
`;

const ScannerContainer = styled.View`
  flex: 1;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 32px;
  background-color: #000;
`;

const Overlay = styled.View`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.4);
`;

const HintText = styled.Text`
  color: #fff;
  margin-top: 12px;
  font-size: 16px;
`;

const DataText = styled.Text`
  color: #fff;
  margin-top: 8px;
  font-size: 14px;
  padding-horizontal: 12px;
`;

const Instruction = styled.Text`
  color: ${Colors.text};
  font-size: 14px;
  text-align: center;
  margin-bottom: 24px;
`;

const PrimaryButton = styled.TouchableOpacity<{ disabled?: boolean }>`
  background-color: ${({ disabled }) =>
    disabled ? Colors.border : Colors.primary};
  padding-vertical: 16px;
  border-radius: 8px;
  align-items: center;
`;

const ButtonText = styled.Text`
  color: #fff;
  font-size: 16px;
  font-weight: 600;
`;

const Centered = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
`;
