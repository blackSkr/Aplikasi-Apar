import Colors from '@/constants/Colors';
import React, { useState } from 'react';
import { Modal, Pressable, Text } from 'react-native';
import styled from 'styled-components/native';

const Row = styled.View`
  flex-direction: row;
  justify-content: space-between;
  padding-bottom: 4%;
`;

const OptionCard = styled.Pressable`
  flex: 1;
  background-color: #fff;
  margin-horizontal: 8px;
  padding: 12px;
  border-radius: 8px;
  align-items: center;
  elevation: 2;
  shadow-color: #000;
  shadow-opacity: 0.1;
  shadow-offset: 0px 1px;
  shadow-radius: 2px;
`;

const OptionLabel = styled.Text`
  font-size: 14px;
  color: ${Colors.text};
  text-align: center;
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

export default function Options() {
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedJadwal, setSelectedJadwal] = useState<string | null>(null);

  const handleSelect = (pilihan: string) => {
    setSelectedJadwal(pilihan);
    setModalVisible(false);
    alert(`Kamu memilih: ${pilihan}`);
    // ✅ Di sini bisa simpan ke database atau lanjut ke form lain
  };

  return (
    <>
      {/* <Row>
        <OptionCard onPress={() => setModalVisible(true)}>
          <IconSymbol name="calendar" size={24} color={Colors.primary} />
          <OptionLabel>Jadwal Pemeliharaan</OptionLabel>
        </OptionCard>
      </Row> */}

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
    </>
  );
}
