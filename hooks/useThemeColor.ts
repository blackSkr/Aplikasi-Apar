// src/hooks/useThemeColor.ts
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

/**
 * Pilih nama warna hanya dari key di Colors yang bertipe string.
 */
type ColorName =
  { [K in keyof typeof Colors]: typeof Colors[K] extends string ? K : never }[keyof typeof Colors];

interface ThemeProps {
  light?: string;
  dark?: string;
}

/**
 * Jika props.light/props.dark disuplai, pakai itu sesuai skema,
 * kalau tidak, fallback ke Colors[colorName].
 */
export function useThemeColor(
  props: ThemeProps,
  colorName: ColorName
): string {
  const theme = useColorScheme(); // 'light' | 'dark' | null

  // override via props jika ada
  const override = theme === 'dark' ? props.dark : props.light;
  if (override) {
    return override;
  }

  // fallback ke flat Colors
  return Colors[colorName];
}
