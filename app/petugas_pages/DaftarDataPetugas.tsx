import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, SafeAreaView, Text } from 'react-native';
import styled from 'styled-components/native';

const Colors = {
  primary: '#D50000',
  background: '#FFFFFF',
  text: '#212121',
  border: '#ECECEC',
};

const Container = styled(SafeAreaView)`
  flex: 1;
  background-color: ${Colors.background};
`;

const Header = styled.View`
  padding: 60px 16px 16px;
  background-color: ${Colors.primary};
`;

const Title = styled.Text`
  color: #fff;
  font-size: 22px;
  font-weight: bold;
`;

const ListContainer = styled.View`
  padding: 16px;
`;

const PetugasCard = styled.View`
  background-color: #f9f9f9;
  padding: 16px;
  margin-bottom: 10px;
  border-radius: 8px;
  border-width: 1px;
  border-color: ${Colors.border};
`;

const PetugasText = styled.Text`
  font-size: 16px;
  color: ${Colors.text};
`;

const Button = styled(Pressable)`
  background-color: ${Colors.primary};
  padding: 12px;
  border-radius: 8px;
  margin-top: 16px;
  align-items: center;
`;

const ButtonText = styled.Text`
  color: #fff;
  font-size: 16px;
  font-weight: bold;
`;

export default function DaftarPetugas() {
  const router = useRouter();
  const [petugasList, setPetugasList] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPetugas();
  }, []);

  const fetchPetugas = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://192.168.245.1:3000/api/petugas');
      if (!res.ok) {
        throw new Error('Gagal mengambil data petugas');
      }
      const data = await res.json();
      setPetugasList(data);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <PetugasCard>
      <PetugasText>Badge Number: {item.badge_number}</PetugasText>
      <PetugasText>Nama: {item.nama_petugas}</PetugasText>
      <PetugasText>Departemen: {item.departemen}</PetugasText>
    </PetugasCard>
  );

  return (
    <Container>
      <Header>
        <Title>Daftar Petugas</Title>
      </Header>
      <ListContainer>
        {loading ? (
          <Text>Loading...</Text>
        ) : (
          <FlatList
            data={petugasList}
            renderItem={renderItem}
            keyExtractor={(item) => item.id_petugas}
          />
        )}
        <Button onPress={() => router.push('/tambah-petugas')}>
          <ButtonText>Tambah Petugas</ButtonText>
        </Button>
      </ListContainer>
    </Container>
  );
}
