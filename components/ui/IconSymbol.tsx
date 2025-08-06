// components/ui/IconSymbol.tsx

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import React, { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Mapping SF Symbols → Material Icons
 */
const MAPPING = {
  'house.fill':           'home',
  'checkmark.circle.fill':'check-circle',
  'paperplane.fill':      'send',
  'plus.circle.fill':     'add-circle',
  'trash.fill':           'delete',
  'pencil.circle.fill':   'edit',
  'info.circle.fill':     'info',
  'gearshape.fill':       'settings',
  'bell.fill':            'notifications',
  'heart.fill':           'favorite',
  'book.fill':            'book',
  'timer':                'timer',
  'location.fill':        'location-on',
  'camera.fill':          'camera',
  'magnifyingglass':      'search',
  'person.fill':          'account-circle',
  'calendar':             'event',
  'exclamationmark.triangle.fill': 'warning',
  'checkmark.seal.fill':  'verified',
  'checkmark.circle':    'check-circle',
  'location':            'location-on',  // ← TAMBAHKAN INI!
  'arrow.counterclockwise': 'refresh',
  // 'calendar':             'calendar',
  // Tambahan untuk QR
  'qrcode':               'qr-code',
} as IconMapping;

/**
 * Icon yang pakai SF Symbols di iOS,
 * dan Material Icons di Android/Web.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <MaterialIcons
      name={MAPPING[name]}
      size={size}
      color={color}
      style={style}
    />
  );
}
