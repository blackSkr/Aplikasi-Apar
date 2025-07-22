// app/_layout.tsx

import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import 'react-native-reanimated';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  if (!loaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        {/** 1) Bottom Tabs Group **/}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        {/** 2) Dynamic route untuk detail APAR */}
        {/* <Stack.Screen
          name="AparChecklist/[id]"
          options={{ title: 'Detail APAR' }}
        /> */}

        {/** 3) Jika ada screen‐lain di luar tabs, daftarkan juga di sini */}
        {/* <Stack.Screen name="petugas_pages/DaftarDataPetugas" options={{ title:'Daftar Petugas' }} /> */}

        {/** 404 fallback **/}
        <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
