// src/pages/InformasiAlat.tsx
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useBadge } from '@/context/BadgeContext';
import { useAparList } from '@/hooks/useAparList';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  View
} from 'react-native';
import styled from 'styled-components/native';

const { width } = Dimensions.get('window');

const Colors = {
  primary: '#D50000',
  secondary: '#FF5722',
  success: '#4CAF50',
  warning: '#FF9800',
  danger: '#F44336',
  info: '#2196F3',
  background: '#F8F9FA',
  cardBg: '#FFFFFF',
  text: '#212121',
  textSecondary: '#757575',
  border: '#E0E0E0',
  shadow: 'rgba(0,0,0,0.1)',
};

const Container = styled(SafeAreaView)`
  flex: 1;
  background-color: ${Colors.background};
`;

const Header = styled.View`
  padding: ${StatusBar.currentHeight || 44}px 20px 24px;
  background-color: ${Colors.primary};
  border-bottom-left-radius: 24px;
  border-bottom-right-radius: 24px;
  shadow-color: ${Colors.shadow};
  shadow-offset: 0px 4px;
  shadow-opacity: 0.3;
  shadow-radius: 8px;
  elevation: 8;
`;

const HeaderContent = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const HeaderLeft = styled.View`
  flex: 1;
`;

const Title = styled.Text`
  color: #fff;
  font-size: 28px;
  font-weight: bold;
`;

const Subtitle = styled.Text`
  color: rgba(255,255,255,0.9);
  font-size: 16px;
  margin-top: 4px;
`;

const RefreshButton = styled(Pressable)`
  background-color: rgba(255,255,255,0.2);
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.3);
`;

const Content = styled(ScrollView)`
  flex: 1;
  padding: 20px;
`;

// Petugas Info Card
const PetugasCard = styled.View`
  background-color: ${Colors.cardBg};
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 24px;
  shadow-color: ${Colors.shadow};
  shadow-offset: 0px 2px;
  shadow-opacity: 0.1;
  shadow-radius: 4px;
  elevation: 3;
  border-left-width: 4px;
  border-left-color: ${Colors.info};
`;

const PetugasHeader = styled.View`
  flex-direction: row;
  align-items: center;
  margin-bottom: 16px;
`;

const PetugasTitle = styled.Text`
  color: ${Colors.text};
  font-size: 18px;
  font-weight: bold;
  margin-left: 12px;
`;

const PetugasRow = styled.View`
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom-width: 1px;
  border-bottom-color: ${Colors.border};
`;

const PetugasLabel = styled.Text`
  color: ${Colors.textSecondary};
  font-size: 14px;
  flex: 1;
`;

const PetugasValue = styled.Text`
  color: ${Colors.text};
  font-size: 16px;
  font-weight: 600;
  flex: 2;
  text-align: right;
`;

// Stats Overview Cards
const StatsContainer = styled.View`
  margin-bottom: 24px;
`;

const SectionTitle = styled.Text`
  font-size: 20px;
  font-weight: bold;
  color: ${Colors.text};
  margin-bottom: 16px;
`;

const StatsGrid = styled.View`
  gap: 12px;
`;

const StatCard = styled.View<{ bgColor: string }>`
  background-color: ${props => props.bgColor};
  padding: 20px;
  border-radius: 16px;
  shadow-color: ${Colors.shadow};
  shadow-offset: 0px 2px;
  shadow-opacity: 0.1;
  shadow-radius: 4px;
  elevation: 3;
`;

const StatRow = styled.View`
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
`;

const StatLeft = styled.View`
  flex-direction: row;
  align-items: center;
  flex: 1;
`;

const StatInfo = styled.View`
  margin-left: 12px;
  flex: 1;
`;

const StatTitle = styled.Text`
  color: #fff;
  font-size: 16px;
  font-weight: 600;
`;

const StatSubtitle = styled.Text`
  color: rgba(255,255,255,0.8);
  font-size: 12px;
  margin-top: 2px;
`;

const StatNumber = styled.Text`
  color: #fff;
  font-size: 32px;
  font-weight: bold;
`;

// Quick Actions
const ActionsContainer = styled.View`
  margin-bottom: 24px;
`;

const ActionsGrid = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  gap: 12px;
`;

const ActionCard = styled(Pressable)`
  background-color: ${Colors.cardBg};
  border-radius: 16px;
  padding: 20px;
  width: ${(width - 56) / 2}px;
  align-items: center;
  shadow-color: ${Colors.shadow};
  shadow-offset: 0px 2px;
  shadow-opacity: 0.1;
  shadow-radius: 4px;
  elevation: 3;
  border: 1px solid ${Colors.border};
`;

const ActionIcon = styled.View<{ bgColor: string }>`
  background-color: ${props => props.bgColor};
  width: 56px;
  height: 56px;
  border-radius: 16px;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
`;

const ActionTitle = styled.Text`
  color: ${Colors.text};
  font-size: 16px;
  font-weight: 600;
  text-align: center;
  margin-bottom: 4px;
`;

const ActionSubtitle = styled.Text`
  color: ${Colors.textSecondary};
  font-size: 12px;
  text-align: center;
`;

const LoadingContainer = styled.View`
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 40px;
`;

const LoadingText = styled.Text`
  color: ${Colors.textSecondary};
  font-size: 16px;
  margin-top: 12px;
`;

export default function InformasiAlat() {
  const router = useRouter();
  const { loading, list, refresh } = useAparList();
  const { badgeNumber } = useBadge();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Get current month for filtering
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // Calculate statistics for current month
  const stats = {
    totalAlat: list.length,
    perluMaintenanceBulanIni: list.filter(item => {
      if (!item.nextDueDate) return true; // Belum pernah maintenance
      const dueDate = new Date(item.nextDueDate);
      return dueDate.getMonth() === currentMonth && dueDate.getFullYear() === currentYear;
    }).length,
  sudahMaintenanceBulanIni: list.filter(item => {
    if (!item.tgl_terakhir_maintenance) return false;

    const lastDate = new Date(item.tgl_terakhir_maintenance);
    return (
      lastDate.getMonth() === currentMonth &&
      lastDate.getFullYear() === currentYear
    );
  }).length,

  };

  // Get petugas location from first APAR (assuming all APAR for this petugas are in same location)
  const petugasLokasi = list.length > 0 ? list[0].lokasi_apar : 'Tidak ada data';

  const actions = [
    {
      title: 'Lihat Semua APAR',
      subtitle: 'Daftar lengkap alat',
      icon: 'list.bullet',
      bgColor: Colors.primary,
      route: '/ManajemenApar/AparView'
    },
    {
      title: 'Maintenance',
      subtitle: 'Kelola perawatan',
      icon: 'wrench.fill',
      bgColor: Colors.warning,
      route: '/ManajemenApar/AparMaintenance'
    },
    {
      title: 'Tambah APAR',
      subtitle: 'Daftarkan alat baru',
      icon: 'plus.circle.fill',
      bgColor: Colors.success,
      route: '/apar/CreateApar'
    },
    {
      title: 'Laporan',
      subtitle: 'Lihat statistik',
      icon: 'chart.bar.fill',
      bgColor: Colors.secondary,
      route: '/laporan/LaporanApar'
    }
  ];

  if (loading && !refreshing) {
    return (
      <Container>
        <Header>
          <HeaderContent>
            <HeaderLeft>
              <Title>Informasi Alat</Title>
              <Subtitle>Sistem Manajemen APAR</Subtitle>
            </HeaderLeft>
          </HeaderContent>
        </Header>
        <LoadingContainer>
          <IconSymbol name="arrow.clockwise" size={32} color={Colors.textSecondary} />
          <LoadingText>Memuat data...</LoadingText>
        </LoadingContainer>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <HeaderContent>
          <HeaderLeft>
            <Title>Informasi Alat</Title>
            <Subtitle>Sistem Manajemen APAR</Subtitle>
          </HeaderLeft>
          <RefreshButton onPress={handleRefresh} disabled={refreshing}>
            <IconSymbol 
              name="arrow.counterclockwise" 
              size={20} 
              color="#fff" 
              style={{ transform: [{ rotate: refreshing ? '180deg' : '0deg' }] }}
            />
          </RefreshButton>
        </HeaderContent>
      </Header>

      <Content showsVerticalScrollIndicator={false}>
        {/* Informasi Petugas */}
        <PetugasCard>
          <PetugasHeader>
            <IconSymbol name="person.fill" size={24} color={Colors.info} />
            <PetugasTitle>Informasi Petugas</PetugasTitle>
          </PetugasHeader>
          
          <PetugasRow key="badge-row">
            <PetugasLabel>Badge Number:</PetugasLabel>
            <PetugasValue>{badgeNumber || 'Tidak login'}</PetugasValue>
          </PetugasRow>
          
          <PetugasRow key="lokasi-row">
            <PetugasLabel>Lokasi Kerja:</PetugasLabel>
            <PetugasValue>{petugasLokasi}</PetugasValue>
          </PetugasRow>
          
          <PetugasRow key="total-row" style={{ borderBottomWidth: 0 }}>
            <PetugasLabel>Total APAR:</PetugasLabel>
            <PetugasValue>{stats.totalAlat} unit</PetugasValue>
          </PetugasRow>
        </PetugasCard>

        {/* Statistics Overview */}
        <StatsContainer>
          <SectionTitle>Status Alat Bulan Ini</SectionTitle>
          <StatsGrid>
            <StatCard key="maintenance-card" bgColor={Colors.warning}>
              <StatRow>
                <StatLeft>
                  <IconSymbol name="clock.fill" size={28} color="#fff" />
                  <StatInfo>
                    <StatTitle>Perlu Maintenance</StatTitle>
                    <StatSubtitle>Bulan {new Date().toLocaleDateString('id-ID', { month: 'long' })}</StatSubtitle>
                  </StatInfo>
                </StatLeft>
                <StatNumber>{stats.perluMaintenanceBulanIni}</StatNumber>
              </StatRow>
            </StatCard>
            
            <StatCard key="completed-card" bgColor={Colors.success}>
              <StatRow>
                <StatLeft>
                  <IconSymbol name="checkmark.circle.fill" size={28} color="#fff" />
                  <StatInfo>
                    <StatTitle>Sudah Maintenance</StatTitle>
                    <StatSubtitle>Bulan {new Date().toLocaleDateString('id-ID', { month: 'long' })}</StatSubtitle>
                  </StatInfo>
                </StatLeft>
                <StatNumber>{stats.sudahMaintenanceBulanIni}</StatNumber>
              </StatRow>
            </StatCard>
            
            <StatCard key="total-card" bgColor={Colors.primary}>
              <StatRow>
                <StatLeft>
                  <IconSymbol name="flame.fill" size={28} color="#fff" />
                  <StatInfo>
                    <StatTitle>Total Alat di Lokasi</StatTitle>
                    <StatSubtitle>{petugasLokasi}</StatSubtitle>
                  </StatInfo>
                </StatLeft>
                <StatNumber>{stats.totalAlat}</StatNumber>
              </StatRow>
            </StatCard>
          </StatsGrid>
        </StatsContainer>

        {/* Quick Actions */}
        <ActionsContainer>
          <SectionTitle>Aksi Cepat</SectionTitle>
          <ActionsGrid>
            {actions.map((action, index) => (
              <ActionCard 
                key={index}
                onPress={() => router.push(action.route as any)}
                android_ripple={{ color: Colors.border }}
              >
                <ActionIcon bgColor={`${action.bgColor}20`}>
                  <IconSymbol name={action.icon} size={28} color={action.bgColor} />
                </ActionIcon>
                <ActionTitle>{action.title}</ActionTitle>
                <ActionSubtitle>{action.subtitle}</ActionSubtitle>
              </ActionCard>
            ))}
          </ActionsGrid>
        </ActionsContainer>

        {/* Bottom spacing */}
        <View style={{ height: 20 }} />
      </Content>
    </Container>
  );
}