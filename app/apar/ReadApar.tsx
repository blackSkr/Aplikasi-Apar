// app/apar/ReadApar.tsx

import { APAR, useAparList } from '@/hooks/useAparList';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View
} from 'react-native';

export default function ReadApar() {
  const router = useRouter();
  const { loading, list, stats, refresh } = useAparList();

  const baseUrl =
    Platform.OS === 'android'
      ? 'http://10.0.2.2:3000'
      : 'http://localhost:3000';

  const handleDelete = (id_apar: string) => {
    Alert.alert('Hapus APAR', 'Yakin ingin menghapus data ini?', [
      { text: 'Batal', style: 'cancel' },
      {
        text: 'Hapus',
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${baseUrl}/api/apar/${id_apar}`, {
              method: 'DELETE',
            });
            if (!res.ok) throw new Error('Gagal menghapus data');
            refresh();
            Alert.alert('Sukses', 'Data APAR berhasil dihapus.');
          } catch (e: any) {
            Alert.alert('Error', e.message);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.stats}>
        <Text>Total APAR: {stats.total}</Text>
        <Text>Butuh Maintenance: {stats.trouble}</Text>
        <Text>Sudah Expired: {stats.expired}</Text>
      </View>

      <FlatList<APAR>
        data={list}
        // ← PENTING: kalau item.id_apar falsy (undefined/''), pakai idx.toString()
        keyExtractor={(item, idx) => 
          item.id_apar && item.id_apar.trim() !== ''
            ? item.id_apar.trim()
            : idx.toString()
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>
              {item.no_apar} — {item.jenis_apar}
            </Text>
            <Text>Lokasi: {item.lokasi_apar}</Text>
            <Text>Status: {item.status_apar}</Text>
            <Text>Remaining: {item.daysRemaining} hari</Text>
            <Text>Next Check: {item.nextCheckDate}</Text>

            <View style={styles.actions}>
              <Pressable
                style={[styles.btn, styles.btnEdit]}
                onPress={() =>
                  router.push({ pathname: '/apar/EditApar', params: { id_apar: item.id_apar } })
                }
              >
                <Text style={styles.btnText}>Edit</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, styles.btnDelete]}
                onPress={() => handleDelete(item.id_apar)}
              >
                <Text style={styles.btnText}>Hapus</Text>
              </Pressable>
            </View>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fafafa' },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },
  stats: {
    padding: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderColor: '#ddd',
  },
  card: {
    padding: 16, backgroundColor: '#fff',
    margin: 16, borderRadius: 8, elevation: 2,
  },
  title:    { fontWeight: 'bold', marginBottom: 8 },
  actions:  { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  btn:       { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 4 },
  btnEdit:   { backgroundColor: '#FFD600', marginRight: 8 },
  btnDelete: { backgroundColor: '#D50000' },
  btnText:   { color: '#fff', fontWeight: 'bold' },
  separator: { height: 12 },
});
