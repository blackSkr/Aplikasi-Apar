// app/login.tsx
import { useBadge } from '@/context/BadgeContext';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function LoginScreen() {
  const [badge, setBadge] = useState('');
  const { setBadgeNumber, isSyncing } = useBadge(); // ⬅️ pakai progress global
  const router = useRouter();

  const onSubmit = useCallback(async () => {
    const norm = badge.trim();
    if (!norm || isSyncing) return;
    await setBadgeNumber(norm);  // ⬅️ ini akan memunculkan BlockingSyncModal dari BadgeContext
    router.replace('/');         // pindah setelah selesai
  }, [badge, isSyncing, setBadgeNumber, router]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Masuk dengan Badge</Text>
      <TextInput
        style={styles.input}
        placeholder="Contoh: ABC123"
        value={badge}
        onChangeText={setBadge}
        autoCapitalize="characters"
        editable={!isSyncing}
      />
      <Pressable style={[styles.button, isSyncing && { opacity: 0.6 }]} onPress={onSubmit} disabled={isSyncing}>
        {isSyncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>MASUK</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, justifyContent:'center', padding:20 },
  title: { fontSize:24, fontWeight:'bold', marginBottom:16 },
  input: { borderWidth:1, borderColor:'#ccc', borderRadius:6, padding:12, marginBottom:20 },
  button: { backgroundColor:'#D50000', padding:12, borderRadius:6, alignItems:'center' },
  buttonText: { color:'#fff', fontWeight:'600' },
});
