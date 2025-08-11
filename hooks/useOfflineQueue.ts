// hooks/useOfflineQueue.ts
import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { AppState, AppStateStatus } from 'react-native';
import { flushQueue } from '@/utils/ManajemenOffline';

const QUEUE_KEY = 'OFFLINE_QUEUE';

type Options = {
  autoFlushOnReconnect?: boolean;  // default false
  autoFlushOnForeground?: boolean; // default false
  pollMs?: number;                  // default 5000
};

export function useOfflineQueue(opts: Options = {}) {
  const {
    autoFlushOnReconnect = false,
    autoFlushOnForeground = false,
    pollMs = 5000,
  } = opts;

  const [count, setCount] = useState(0);
  const [isFlushing, setIsFlushing] = useState(false);

  const lockRef = useRef(false);
  const isOnlineRef = useRef<boolean>(true);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const getQueueCount = async () => {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const q = raw ? JSON.parse(raw) : [];
    return Array.isArray(q) ? q.length : 0;
  };
  const checkQueue = async () => {
    const len = await getQueueCount();
    if (__DEV__) console.log('[Debug][useOfflineQueue] checkQueue →', len);
    setCount(len);
    return len;
  };

  const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

  const flushLoop = async (reason: string) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setIsFlushing(true);
    try {
      let prev = await checkQueue();
      if (prev === 0) return;
      let rounds = 0;
      while (isOnlineRef.current && rounds < 6) {
        rounds += 1;
        const remaining = await flushQueue();
        if (__DEV__) console.log('[Debug][useOfflineQueue] flushQueue → remaining =', remaining);
        await sleep(500);
        const now = await checkQueue();
        if (now === 0) break;
        if (now >= prev) break; // no progress
        prev = now;
        await sleep(250);
      }
    } finally {
      setIsFlushing(false);
      lockRef.current = false;
    }
  };

  const flushNow = async () => {
    await flushLoop('manual-press');
  };

  useEffect(() => {
    checkQueue();
    const iv = setInterval(checkQueue, pollMs);
    return () => clearInterval(iv);
  }, [pollMs]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(async state => {
      const online = !!state.isConnected;
      isOnlineRef.current = online;
      if (__DEV__) console.log('[Debug][useOfflineQueue] NetInfo →', online);
      if (online && autoFlushOnReconnect) {
        await flushLoop('net-online');
      } else {
        await checkQueue();
      }
    });
    return () => unsub();
  }, [autoFlushOnReconnect]);

  useEffect(() => {
    const onAppStateChange = async (next: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (__DEV__) console.log('[Debug][useOfflineQueue] AppState:', prev, '→', next);
      if (prev.match(/inactive|background/) && next === 'active') {
        if (autoFlushOnForeground && isOnlineRef.current) {
          await flushLoop('app-foreground');
        } else {
          await checkQueue();
        }
      }
    };
    const sub = AppState.addEventListener('change', onAppStateChange);
    return () => sub.remove();
  }, [autoFlushOnForeground]);

  return { count, isFlushing, refreshQueue: checkQueue, flushNow };
}
