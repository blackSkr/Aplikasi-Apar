// app/login.tsx
import { useBadge } from '@/context/BadgeContext';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function LoginScreen() {
  const [badge, setBadge] = useState('');
  const { setBadgeNumber } = useBadge();
  const router = useRouter();

  const onSubmit = async () => {
    if (!badge.trim()) return;
    await setBadgeNumber(badge.trim());
    router.replace('/');   // kembali ke root "tabs"
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Masuk dengan Badge</Text>
      <TextInput
        style={styles.input}
        placeholder="Contoh: ABC123"
        value={badge}
        onChangeText={setBadge}
        autoCapitalize="characters"
      />
      <Pressable style={styles.button} onPress={onSubmit}>
        <Text style={styles.buttonText}>MASUK</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, justifyContent:'center', padding:20 },
  title: { fontSize:24, fontWeight:'bold', marginBottom:16 },
  input: {
    borderWidth:1, borderColor:'#ccc', borderRadius:6,
    padding:12, marginBottom:20
  },
  button: {
    backgroundColor:'#D50000', padding:12,
    borderRadius:6, alignItems:'center'
  },
  buttonText: { color:'#fff', fontWeight:'600' },
});
