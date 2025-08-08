// hooks/useOfflineQueue.ts
// hooks/useOfflineQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const QUEUE_KEY = 'OFFLINE_QUEUE';

export function useOfflineQueue() {
  const [count, setCount] = useState(0);

  const checkQueue = async () => {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const q = raw ? JSON.parse(raw) : [];
    const len = Array.isArray(q) ? q.length : 0;
    console.log('[Debug] useOfflineQueue.checkQueue →', len);
    setCount(len);
  };

  useEffect(() => {
    checkQueue(); // cek segera
    const iv = setInterval(checkQueue, 3000);
    return () => clearInterval(iv);
  }, []);

  return { count, refreshQueue: checkQueue };
}
