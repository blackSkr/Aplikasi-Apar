import { createLogger } from '@/src/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const log = createLogger('notif');
const NOTIF_MAP_KEY = 'APAR_NOTIF_MAP'; // { [tokenKey]: { id: string, due: string } }
const DAYS_BEFORE_KEY = 'APAR_DAYS_BEFORE_OVERRIDE'; // number | null

// ====== KONSTAN DESAIN NOTIF ======
const CHANNEL_ID = 'apar-reminders';
const CHANNEL_NAME = 'APAR Reminders';
const CHANNEL_DESC = 'Pengingat jatuh tempo inspeksi APAR';
const BRAND_COLOR = '#FF3B30'; // samakan dengan app.json notification.color
const VIBRATE_PATTERN: number[] = [0, 250, 200, 250]; // start, vibrate, pause, vibrate

export type AparItem = {
  Id: number;
  Kode: string;
  LokasiNama?: string | null;
  JenisNama?: string | null;
  TokenQR?: string | null;
  NextDueDate?: string | null; // ISO
};

// ===== Util tanggal (pakai waktu LOKAL device) =====
const startOfLocalDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const fmt = (x: any) => {
  try { const d = x instanceof Date ? x : new Date(x); return `${d.toISOString()} (${d.toLocaleString()})`; }
  catch { return String(x); }
};

// ===== Setup notifikasi (local only) — sekali saja =====
let setupDone = false;
export async function ensureNotifSetup() {
  if (setupDone) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: CHANNEL_NAME,
      description: CHANNEL_DESC,
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      vibrationPattern: VIBRATE_PATTERN,
      enableLights: true,
      lightColor: BRAND_COLOR,
      sound: 'default',
      showBadge: true
    });
  }

  const p = await Notifications.getPermissionsAsync();
  if (!p.granted) {
    const req = await Notifications.requestPermissionsAsync();
    log.info('[perm] requested →', req);
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      priority: Notifications.AndroidNotificationPriority.MAX
    })
  });

  setupDone = true;
}

async function loadMap(): Promise<Record<string, { id: string; due: string }>> {
  const raw = await AsyncStorage.getItem(NOTIF_MAP_KEY);
  return raw ? JSON.parse(raw) : {};
}
async function saveMap(map: Record<string, { id: string; due: string }>) {
  await AsyncStorage.setItem(NOTIF_MAP_KEY, JSON.stringify(map));
}

const tokenKeyOf = (a: AparItem) => (a.TokenQR ? `QR:${a.TokenQR}` : `ID:${a.Id}`);

// ====== Override daysBefore (opsional, untuk testing dari FE saja) ======
export async function setDaysBeforeOverride(n: number | null) {
  if (n == null) {
    await AsyncStorage.removeItem(DAYS_BEFORE_KEY);
    log.info('[daysBefore-override] cleared (back to default H-2)');
    return;
  }
  const v = Math.max(0, Math.floor(n));
  await AsyncStorage.setItem(DAYS_BEFORE_KEY, String(v));
  log.info('[daysBefore-override] set to', v);
}
export async function getDaysBeforeOverride(): Promise<number | null> {
  const raw = await AsyncStorage.getItem(DAYS_BEFORE_KEY);
  if (!raw) return null;
  const num = parseInt(raw, 10);
  return Number.isFinite(num) ? num : null;
}
async function resolveDaysBefore(opts?: ScheduleOpts): Promise<number> {
  const ov = await getDaysBeforeOverride();
  if (ov != null) return ov;
  return opts?.daysBefore ?? 2;
}

// Hitung waktu pengingat: H-X jam 09:00 lokal
function computeReminderTime(nextDueISO: string, daysBefore = 2) {
  const due = new Date(nextDueISO);
  const dueLocalDay = startOfLocalDay(due);
  const remind = new Date(dueLocalDay);
  remind.setDate(remind.getDate() - daysBefore);
  remind.setHours(9, 0, 0, 0);
  return remind;
}

// Utility judul/body yang rapi & profesional
function buildContent(item: AparItem, daysBefore: number) {
  const lokasi = item.LokasiNama ?? '-';
  const jenis = item.JenisNama ?? 'APAR';
  // judul dinamis mengikuti H-X
  const title = `Pengingat H-${daysBefore}: ${item.Kode}`;
  // body ringkas, otomatis jadi expanded/big text saat panjang (Android)
  const body = `${jenis} • ${lokasi}\nInspeksi akan jatuh tempo. Ketuk untuk buka detail.`;
  return {
    title,
    body,
    data: {
      tokenQR: item.TokenQR ?? String(item.Id),
      peralatanId: item.Id,
      kode: item.Kode
    },
    // styling per notifikasi (Android focus)
    color: BRAND_COLOR,
    sound: true,
    priority: Notifications.AndroidNotificationPriority.MAX
  };
}

type ScheduleOpts = {
  /** DEV: paksa trigger relatif sekian detik untuk uji cepat */
  overrideSeconds?: number;
  /** H-X (default 2). Bisa di-override global via setDaysBeforeOverride(). */
  daysBefore?: number;
};

// ===== Idempotency & anti re-entry =====
let lastSignature: string | null = null;   // signature data terakhir
let scheduleInFlight = false;              // lock agar tidak overlap

// signature stabil dari daftar APAR (KEY + due YYYY-MM-DD) + daysBefore + overrideSeconds
function makeSignature(apars: AparItem[] | undefined, overrideSeconds?: number, daysBefore = 2) {
  const head = `${overrideSeconds ?? 'prod'}|D${daysBefore}`;
  if (!apars?.length) return `${head}::EMPTY`;
  const arr = apars
    .filter(a => !!a?.Id && !!a?.NextDueDate)
    .map(a => {
      const key = tokenKeyOf(a);
      const d = new Date(a.NextDueDate as string);
      const ymd = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
      return `${key}|${ymd}`;
    })
    .sort();
  return `${head}::${arr.join(',')}`;
}

/**
 * LOGIC: jadwalkan ke waktu absolut (NextDueDate - H-X @ 09:00).
 * - Idempotent (signature memasukkan daysBefore).
 * - De-dupe per APAR (TokenQR/Id).
 * - Skip jika H-X sudah lewat (tidak backdated).
 * - Keep bila due sama (hindari re-schedule).
 */
export async function scheduleRemindersForList(apars: AparItem[], opts?: ScheduleOpts) {
  await ensureNotifSetup();

  const daysBefore = await resolveDaysBefore(opts);
  const sig = makeSignature(apars, opts?.overrideSeconds, daysBefore);
  if (!opts?.overrideSeconds && sig === lastSignature) {
    log.debug('[noop] same signature, skip scheduling');
    return;
  }
  if (scheduleInFlight) {
    log.debug('[skip] schedule already in-flight');
    return;
  }
  scheduleInFlight = true;

  try {
    const map = await loadMap();

    // De-dupe input
    const unique = new Map<string, AparItem>();
    for (const a of apars || []) {
      if (!a?.Id || !a?.NextDueDate) continue;
      const k = tokenKeyOf(a);
      if (!unique.has(k)) unique.set(k, a);
    }
    log.info(`[schedule] uniqueItems=${unique.size} daysBefore=${daysBefore} overrideSeconds=${opts?.overrideSeconds ?? 'none'}`);

    const validKeys = new Set<string>();
    const now = new Date();

    for (const [key, a] of unique) {
      validKeys.add(key);

      const dueISO = a.NextDueDate!;
      const remindAt = computeReminderTime(dueISO, daysBefore);
      const planned = map[key];

      // Jika H-X @ 09:00 sudah LEWAT → pastikan tidak ada jadwal lama & SKIP
      if (!opts?.overrideSeconds && remindAt.getTime() <= now.getTime()) {
        if (planned?.id) {
          try { await Notifications.cancelScheduledNotificationAsync(planned.id); } catch {}
          delete map[key];
          log.debug(`[skip-past] ${a.Kode} key=${key} H-${daysBefore}=${fmt(remindAt)}`);
        }
        continue;
      }

      // Jika due sama dan sudah ada → KEEP
      if (!opts?.overrideSeconds && planned?.due === dueISO) {
        log.debug(`[keep] ${a.Kode} key=${key} due=${dueISO} H-${daysBefore}=${fmt(remindAt)}`);
        continue;
      }

      // Cancel jadwal lama bila ada (due berubah / override DEV)
      if (planned?.id) {
        try { await Notifications.cancelScheduledNotificationAsync(planned.id); } catch {}
        log.debug(`[cancel-old] ${a.Kode} key=${key} oldId=${planned.id}`);
      }

      // Trigger absolut (atau override detik untuk DEV)
      const trigger: any = opts?.overrideSeconds && opts.overrideSeconds > 0
        ? { seconds: opts.overrideSeconds }
        : remindAt;

      const id = await Notifications.scheduleNotificationAsync({
        content: { ...buildContent(a, daysBefore), channelId: CHANNEL_ID },
        trigger
      });

      map[key] = { id, due: dueISO };
      log.info(
        `[scheduled] ${a.Kode} key=${key} id=${id} → ` +
        ('seconds' in (trigger as any) ? `${(trigger as any).seconds}s` : fmt(trigger))
      );
    }

    // Bersihkan jadwal yang tidak ada lagi di list
    for (const key of Object.keys(map)) {
      if (!validKeys.has(key)) {
        try { await Notifications.cancelScheduledNotificationAsync(map[key].id); } catch {}
        log.debug(`[cleanup] drop key=${key} id=${map[key].id}`);
        delete map[key];
      }
    }

    await saveMap(map);
    lastSignature = sig;
    await debugListScheduled('after-schedule');
  } finally {
    scheduleInFlight = false;
  }
}

// Reschedule satu item (mis. setelah submit online sukses)
export async function rescheduleReminderForItem(item: AparItem, opts?: ScheduleOpts) {
  return scheduleRemindersForList([item], opts);
}

export async function cancelAllAparReminders() {
  const map = await loadMap();
  for (const k of Object.keys(map)) {
    try { await Notifications.cancelScheduledNotificationAsync(map[k].id); } catch {}
  }
  await saveMap({});
  lastSignature = null;
  log.info('[cancel-all] done');
  await debugListScheduled('after-cancel-all');
}

// Hard reset: batalkan SEMUA (termasuk yang tak tercatat di storage)
export async function hardResetScheduled() {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of all) {
    try { await Notifications.cancelScheduledNotificationAsync(n.identifier); } catch {}
  }
  await AsyncStorage.setItem(NOTIF_MAP_KEY, JSON.stringify({}));
  lastSignature = null;
  log.info(`[hard-reset] cancelled ${all.length} notifications`);
  await debugListScheduled('after-hard-reset');
}

// Tester dev (notifikasi manual dalam X detik)
export async function scheduleTestReminder(text = 'Tes notifikasi APAR', seconds = 10) {
  await ensureNotifSetup();
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: '🔔 Pengujian Notifikasi',
      body: text,
      data: { test: true },
      color: BRAND_COLOR,
      priority: Notifications.AndroidNotificationPriority.MAX,
      channelId: CHANNEL_ID
    },
    trigger: { seconds }
  });
  log.info(`[test] scheduled id=${id} in ${seconds}s`);
  await debugListScheduled('after-test');
  return id;
}

// Dump daftar scheduled (untuk log terminal)
export async function debugListScheduled(tag = 'dump') {
  const all = await Notifications.getAllScheduledNotificationsAsync();
  const brief = all.map((n) => {
    const trg: any = (n as any).trigger;
    const t =
      trg?.seconds != null
        ? `${trg.seconds}s`
        : (trg?.date ?? trg?.timestamp ? fmt(trg.date ?? trg.timestamp) : 'unknown');
    return { id: n.identifier, title: n.content?.title, trigger: t };
  });
  log.info(`[${tag}] scheduled count=${all.length}`, brief);
}

// Listener log (diterima/di-tap)
export function registerNotificationListeners(
  onTap?: (data: any) => void,
  onReceive?: (data: Notifications.Notification) => void
) {
  const rcv = Notifications.addNotificationReceivedListener((n) => {
    log.info('[receive]', { id: n.request.identifier, title: n.request.content.title, data: n.request.content.data });
    onReceive?.(n);
  });
  const rsp = Notifications.addNotificationResponseReceivedListener((resp) => {
    const d = resp.notification.request.content.data;
    log.info('[tap]', d);
    onTap?.(d);
  });
  return () => { try { rcv.remove(); } catch {} try { rsp.remove(); } catch {} };
}
