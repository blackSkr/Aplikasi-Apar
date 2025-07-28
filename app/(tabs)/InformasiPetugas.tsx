// src/pages/petugas_pages/TambahPetugas.tsx
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, SafeAreaView, TextInput } from 'react-native';
import styled from 'styled-components/native';
import { ulid } from 'ulid';

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

const NavWrapper = styled.View`
  flex-direction: row;
  justify-content: space-between;
  padding: 16px;
  background-color: #fff;
`;

const NavButton = styled(Pressable)`
  flex-direction: row;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid ${Colors.primary};
  border-radius: 8px;
`;

const NavButtonText = styled.Text`
  color: ${Colors.primary};
  font-size: 14px;
  margin-left: 8px;
`;

const Form = styled.View`
  padding: 16px;
`;

const Label = styled.Text`
  color: ${Colors.text};
  font-size: 14px;
  margin-bottom: 4px;
`;

const Input = styled(TextInput)`
  border-width: 1px;
  border-color: ${Colors.border};
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
  color: ${Colors.text};
`;

const SubmitButton = styled(Pressable)`
  background-color: ${Colors.primary};
  padding: 14px;
  border-radius: 8px;
  align-items: center;
  flex-direction: row;
  justify-content: center;
`;

const ButtonText = styled.Text`
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  margin-left: 8px;
`;

export default function TambahPetugas() {
  const router = useRouter();

  const [badgeNumber, setBadgeNumber] = useState('');
  const [nama, setNama] = useState('');
  const [departemen, setDepartemen] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!badgeNumber || !nama || !departemen || !password) {
      Alert.alert('Error', 'Semua field wajib diisi.');
      return;
    }

    setSubmitting(true);
    const newPetugas = {
      id_petugas: ulid(),
      badge_number: badgeNumber,
      nama_petugas: nama,
      departemen,
      password,
    };

    try {
      const res = await fetch('http://10.0.2.2:3000/api/petugas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPetugas),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || res.statusText);
      }

      Alert.alert('Sukses', 'Data petugas berhasil ditambahkan.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert('Gagal', e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container>
      <Header>
        <Title>Tambah Petugas</Title>
      </Header>

      {/* 2 Tombol Navigasi Baru */}
      <NavWrapper>
        <NavButton onPress={() => router.push('/ManajemenApar/AparView')}>
          <IconSymbol name="book.fill" size={18} color={Colors.primary} />
          <NavButtonText>Baca APAR</NavButtonText>
        </NavButton>

        {/* <NavButton onPress={() => router.push('/petugas_pages/DaftarDataPetugas')}>
          <IconSymbol name="list.bullet" size={18} color={Colors.primary} />
          <NavButtonText>Daftar Petugas</NavButtonText>
        </NavButton> */}

        {/* <NavButton onPress={() => router.push('/apar/MaintenanceApar')}> */}
        <NavButton onPress={() => router.push('/ManajemenApar/AparMaintenance')}>
          <IconSymbol name="list.bullet" size={18} color={Colors.primary} />
          <NavButtonText>Tes Maintenance</NavButtonText>
        </NavButton>

        <NavButton onPress={() => router.push('/apar/CreateApar')}>
          <IconSymbol name="list.bullet" size={18} color={Colors.primary} />
          <NavButtonText>Tambah Apar</NavButtonText>
        </NavButton>
      </NavWrapper>

      <Form>
        <Label>Nomor Badge</Label>
        <Input
          placeholder="Masukkan nomor badge"
          value={badgeNumber}
          onChangeText={setBadgeNumber}
          autoCapitalize="none"
        />

        <Label>Nama Lengkap</Label>
        <Input
          placeholder="Masukkan nama petugas"
          value={nama}
          onChangeText={setNama}
        />

        <Label>Departemen</Label>
        <Input
          placeholder="Masukkan departemen"
          value={departemen}
          onChangeText={setDepartemen}
        />

        <Label>Password</Label>
        <Input
          placeholder="Masukkan password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <SubmitButton onPress={handleSubmit} disabled={submitting}>
          <IconSymbol name="plus.circle.fill" size={20} color="#fff" />
          <ButtonText>
            {submitting ? 'Menyimpan...' : 'Simpan Petugas'}
          </ButtonText>
        </SubmitButton>
      </Form>
    </Container>
  );
}
