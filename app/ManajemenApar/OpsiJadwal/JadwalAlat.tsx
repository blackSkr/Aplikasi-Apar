//app/ManajemenApar/OpsiJadwal/JadwalAlat.tsx
import Colors from '@/constants/Colors';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, Text } from 'react-native';
import styled from 'styled-components/native';

const Container = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  background-color: #f5f5f5;
`;

const Button = styled.TouchableOpacity`
  background-color: ${Colors.primary};
  padding: 14px 24px;
  border-radius: 8px;
`;

const ButtonText = styled.Text`
  color: #fff;
  font-size: 16px;
  font-weight: 600;
`;

const ModalBackground = styled.View`
  flex: 1;
  justify-content: center;
  align-items: center;
  background-color: rgba(0, 0, 0, 0.4);
`;

const ModalBox = styled.View`
  width: 80%;
  background-color: white;
  border-radius: 12px;
  padding: 24px;
  align-items: center;
`;

const OptionButton = styled.TouchableOpacity`
  padding: 12px 20px;
  margin-vertical: 8px;
  background-color: ${Colors.primaryLight};
  border-radius: 8px;
  width: 100%;
  align-items: center;
`;

const OptionText = styled.Text`
  font-size: 16px;
  color: ${Colors.text};
  font-weight: 500;
`;

export default function JadwalAlat() {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedJadwal, setSelectedJadwal] = useState<string | null>(null);

  const handleSelect = (bulan: string) => {
    setSelectedJadwal(bulan);
    setModalVisible(false);
    Alert.alert('Jadwal Dipilih', `Pemeliharaan setiap ${bulan}`);
    // 👉 Kamu bisa kirim ke backend di sini
  };

  return (
    <Container>
      <Button onPress={() => setModalVisible(true)}>
        <ButtonText>{selectedJadwal ? `Jadwal: ${selectedJadwal}` : 'Pilih Jadwal'}</ButtonText>
      </Button>

      <Modal
        transparent
        animationType="fade"
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <ModalBackground>
          <ModalBox>
            <Text style={{ fontSize: 18, marginBottom: 16, fontWeight: 'bold' }}>
              Pilih Jadwal Pemeliharaan
            </Text>

            <OptionButton onPress={() => handleSelect('3 Bulan')}>
              <OptionText>3 Bulan</OptionText>
            </OptionButton>

            <OptionButton onPress={() => handleSelect('6 Bulan')}>
              <OptionText>6 Bulan</OptionText>
            </OptionButton>

            <Pressable onPress={() => setModalVisible(false)} style={{ marginTop: 16 }}>
              <Text style={{ color: Colors.primary }}>Batal</Text>
            </Pressable>
          </ModalBox>
        </ModalBackground>
      </Modal>
    </Container>
  );
}
