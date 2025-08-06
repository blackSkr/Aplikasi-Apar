// hooks/useOfflineQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const QUEUE_KEY = 'OFFLINE_QUEUE';

export function useOfflineQueue() {
  const [count, setCount] = useState(0);

  const checkQueue = async () => {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const q = raw ? JSON.parse(raw) : [];
    setCount(q.length);
  };

  useEffect(() => {
    const interval = setInterval(checkQueue, 3000); // optional auto refresh
    return () => clearInterval(interval);
  }, []);

  return { count, refreshQueue: checkQueue };
}
