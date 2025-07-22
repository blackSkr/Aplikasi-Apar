import Colors from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  SafeAreaView,
  StatusBar,
  Text,
  View
} from 'react-native';
import styled from 'styled-components/native';

const ScanQr: React.FC = () => {
  const router = useRouter();
  const exampleId = 'APAR0000000000000000000003'; // nanti dari QR scanner

  return (
    <Wrapper>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryheader} />

      <Header>
        <HeaderTitle>Scan QR APAR</HeaderTitle>
      </Header>

      <Content>
        <ScannerBox>
          <Ionicons name="qr-code-outline" size={64} color={Colors.border} />
          <ScanHint>Letakkan QR code di dalam frame</ScanHint>
        </ScannerBox>

        <Instruction>
          Setelah sukses scan, tekan tombol di bawah untuk melihat detail APAR.
        </Instruction>

        <PrimaryButton onPress={() => router.push(`/checklist/${exampleId}`)}>
          <ButtonText>LIHAT DETAIL</ButtonText>
        </PrimaryButton>
      </Content>
    </Wrapper>
  );
};

export default ScanQr;

const Wrapper = styled(SafeAreaView)`
  flex: 1;
  background-color: ${Colors.background};
`;

const Header = styled(View)`
  height: 56px;
  background-color: ${Colors.primaryheader};
  justify-content: center;
  align-items: center;
  elevation: 4;
  shadow-color: #000;
  shadow-opacity: 0.1;
  shadow-offset: 0 2px;
  shadow-radius: 4px;
`;

const HeaderTitle = styled(Text)`
  color: #fff;
  font-size: 20px;
  font-weight: bold;
`;

const Content = styled(View)`
  flex: 1;
  padding: 24px;
`;

const ScannerBox = styled(View)`
  flex: 1;
  border: 2px dashed ${Colors.border};
  border-radius: 12px;
  justify-content: center;
  align-items: center;
  margin-bottom: 32px;
`;

const ScanHint = styled(Text)`
  color: ${Colors.subtext};
  margin-top: 12px;
  font-size: 16px;
`;

const Instruction = styled(Text)`
  color: ${Colors.text};
  font-size: 14px;
  text-align: center;
  margin-bottom: 24px;
`;

const PrimaryButton = styled.TouchableOpacity`
  background-color: ${Colors.primary};
  padding-vertical: 16px;
  border-radius: 8px;
  align-items: center;
`;

const ButtonText = styled(Text)`
  color: #fff;
  font-size: 16px;
  font-weight: 600;
`;
