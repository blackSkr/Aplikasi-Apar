import {
  AparItem,
  ensureNotifSetup,
  registerNotificationListeners,
  scheduleRemindersForList,
} from '@/src/notifications/aparReminders';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef } from 'react';

type Props = {
  apars: AparItem[];                 // list APAR (punya NextDueDate)
  daysBefore?: number;               // H-X (default 2), FE-only testing
  debugOverrideSeconds?: number;     // DEV: paksa muncul dalam X detik
};

// Signature stabil: ikut daysBefore
function makeSig(items: AparItem[], daysBefore: number) {
  if (!items?.length) return `EMPTY|D${daysBefore}`;
  const arr = items
    .filter(a => a?.Id && a?.NextDueDate)
    .map(a => {
      const key = a.TokenQR ? `QR:${a.TokenQR}` : `ID:${a.Id}`;
      const d = new Date(a.NextDueDate as string);
      const ymd = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
      return `${key}|${ymd}`;
    })
    .sort();
  return `D${daysBefore}::${arr.join(',')}`;
}

export function useAparNotifications({ apars, daysBefore = 2, debugOverrideSeconds }: Props) {
  const router = useRouter();

  // Setup permission + listeners sekali
  useEffect(() => {
    ensureNotifSetup();
    const off = registerNotificationListeners((data) => {
      const tokenQR = data?.tokenQR;
      if (tokenQR) {
        router.push({ pathname: '/ManajemenApar/AparMaintenance', params: { token: tokenQR } });
      } else if (data?.peralatanId) {
        router.push({ pathname: '/ManajemenApar/AparHistory', params: { id: String(data.peralatanId) } });
      }
    });
    return () => off();
  }, []);

  // Hanya jadwalkan ketika data/signature berubah
  const sig = useMemo(() => makeSig(apars || [], daysBefore), [apars, daysBefore]);
  const lastSigRef = useRef<string>('INIT');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!apars?.length) return;

    // skip bila signature sama & tidak ada override detik
    if (!debugOverrideSeconds && sig === lastSigRef.current) return;

    // debounce ringan
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastSigRef.current = sig;
      scheduleRemindersForList(apars, {
        daysBefore,                    // H-X di FE
        overrideSeconds: debugOverrideSeconds, // DEV trigger cepat
      }).catch(() => {});
    }, 250);

    return () => {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    };
  }, [sig, debugOverrideSeconds, apars, daysBefore]);
}
