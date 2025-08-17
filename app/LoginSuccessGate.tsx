// app/LoginSuccessGate.tsx (contoh integrasi)
import InitialSyncModal from '@/components/Sync/InitialSyncModal';
import { useBadge } from '@/context/BadgeContext';
import { useInitialSyncOnLogin } from '@/hooks/useInitialSyncOnLogin';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';

export default function LoginSuccessGate() {
  const router = useRouter();
  const { badgeNumber } = useBadge();
  const { visible, progress, start } = useInitialSyncOnLogin();

  useEffect(() => {
    if (badgeNumber) {
      // mulai sync; UI akan block dengan modal sampai selesai
      start(badgeNumber).then(() => {
        router.replace('/(tabs)/index'); // lanjut ke home setelah sync selesai
      });
    }
  }, [badgeNumber]);

  return <InitialSyncModal visible={visible} progress={progress} />;
}
