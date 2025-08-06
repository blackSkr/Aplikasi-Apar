// app/(tabs)/_layout.tsx
import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import TabBarBackground from '@/components/ui/TabBarBackground';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function TabsLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#D50000',
        tabBarInactiveTintColor: '#757575',
        tabBarBackground: TabBarBackground,
        tabBarStyle: {
          height: 70,
          paddingBottom: 10,
          ...Platform.select({ ios: { position: 'absolute' } }),
        },
        tabBarButton: HapticTab,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <IconSymbol
              name="house.fill"
              size={28}
              color={focused ? '#D50000' : '#757575'}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="ScanQr"
        options={{
          title: 'Scan QR',
          tabBarButton: props => <QrTabButton {...props} />,
          tabBarIcon: ({ focused }) => (
            <IconSymbol
              name="qrcode"
              size={32}
              color={focused ? '#D50000' : '#757575'}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="InformasiPetugas"
        options={{
          title: 'Informasi',
          tabBarIcon: ({ focused }) => (
            <IconSymbol
              name="info.circle.fill"
              size={28}
              color={focused ? '#D50000' : '#757575'}
            />
          ),
        }}
      />
    </Tabs>
  );
}

type QrTabButtonProps = TouchableOpacity['props'] & {
  accessibilityState?: { selected?: boolean };
};

function QrTabButton({
  accessibilityState = {},
  style,
  children,
  onPress,
  ...rest
}: QrTabButtonProps) {
  const focused = accessibilityState.selected ?? false;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.qrButtonContainer, style]}
      activeOpacity={0.8}
      {...rest}
    >
      <View style={[styles.qrButton, focused && styles.qrButtonFocused]}>
        {children}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  qrButtonContainer: {
    top: -20,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 8,
  },
  qrButtonFocused: {
    borderWidth: 2,
    borderColor: '#D50000',
  },
});
