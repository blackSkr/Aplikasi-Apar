// hooks/useInitialSyncOnLogin.ts
import { runInitialSync, SyncProgress } from '@/src/services/initialSync';
import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';

export function useInitialSyncOnLogin() {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>({ phase:'prepare', total:0, done:0, message:'Memulai…' });
  const resultRef = useRef<{total:number;success:number;failed:number}|null>(null);

  const start = useCallback(async (badge: string) => {
    setVisible(true);
    setProgress({ phase:'prepare', total:0, done:0, message:'Memulai…' });
    try {
      const res = await runInitialSync(badge, p => setProgress(p));
      resultRef.current = res;

      if (res.failed > 0) {
        Alert.alert(
          'Sinkronisasi Selesai (Sebagian Gagal)',
          `Berhasil: ${res.success}/${res.total}. Beberapa item gagal diunduh.\nKamu masih bisa lanjut, item yang gagal akan dicoba lagi saat online.`,
          [{ text: 'OK' }]
        );
      }
    } catch (e: any) {
      Alert.alert(
        'Gagal Menyinkronkan',
        'Tidak bisa menyiapkan data offline. Kamu bisa lanjut dengan data cache lama (jika ada) atau coba lagi.',
        [{ text: 'OK' }]
      );
    } finally {
      setVisible(false);
    }
  }, []);

  return { visible, progress, start };
}
