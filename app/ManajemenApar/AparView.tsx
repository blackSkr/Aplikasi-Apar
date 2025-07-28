import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

type Peralatan = {
  id_apar: number;
  no_apar: string;
  jenis_apar: string;
  lokasi_apar: string;
  tgl_terakhir_maintenance: string;
  tgl_exp: string;
  keperluan_check?: string; // JSON string (checklist)
};

export default function AparView() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState<Peralatan[]>([]);
  const baseUrl =
    Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${baseUrl}/api/peralatan/with-checklist`);
      const contentType = res.headers.get('content-type');

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} - ${res.statusText}`);
      }

      if (contentType && contentType.includes('application/json')) {
        const json = await res.json();
        setList(json);
      } else {
        const text = await res.text();
        throw new Error(`Unexpected response: ${text.slice(0, 100)}`);
      }
    } catch (error: any) {
      console.error('❌ Fetch error:', error);
      Alert.alert('Gagal fetch data', error.message || 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const renderChecklist = (rawChecklist?: string) => {
    try {
      const checklist: string[] = rawChecklist ? JSON.parse(rawChecklist) : [];
      return checklist.map((item, index) => (
        <Text key={index} style={styles.checklistItem}>• {item}</Text>
      ));
    } catch {
      return <Text style={styles.checklistItem}>⚠️ Gagal parse checklist</Text>;
    }
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
      <FlatList
        data={list}
        keyExtractor={(item) => item.id_apar.toString()}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.no_apar}</Text>
            <Text>Jenis: {item.jenis_apar}</Text>
            <Text>Lokasi: {item.lokasi_apar}</Text>
            <Text>Terakhir Maintenance: {item.tgl_terakhir_maintenance}</Text>
            <Text>Expired: {item.tgl_exp}</Text>

            <Text style={styles.subTitle}>Checklist:</Text>
            {renderChecklist(item.keperluan_check)}
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    padding: 16,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 8,
    elevation: 2,
  },
  title: { fontWeight: 'bold', marginBottom: 4, fontSize: 16 },
  subTitle: { marginTop: 8, fontWeight: '600' },
  checklistItem: { fontSize: 13, marginLeft: 8, marginTop: 2 },
  separator: { height: 12 },
});
