// app/_layout.tsx

import { useColorScheme } from '@/hooks/useColorScheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import 'react-native-reanimated';

import { BadgeProvider } from '@/context/BadgeContext';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  if (!loaded) return null;

  return (
    <BadgeProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          {/* 1) Tabs utama */}
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

          {/* 2) Jangan definisikan rute yang belum ada file-nya */}
          {/* Pastikan file checklist/[id].tsx benar-benar ada */}
          {/* Jika belum ada, buat: app/checklist/[id].tsx */}
          {/* <Stack.Screen name="checklist/[id]" options={{ title: 'Detail APAR' }} /> */}

          {/* 3) Jika tidak butuh custom options, tidak perlu deklarasi manual */}
          {/* Jadi bisa hapus baris di bawah jika hanya duplicate */}
          {/* <Stack.Screen name="petugas_pages/DaftarDataPetugas" options={{ title: 'Daftar Petugas' }} /> */}

          {/* 4) Fallback untuk halaman tidak ditemukan */}
          <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </BadgeProvider>
  );
}
