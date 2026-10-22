import * as Notifications from 'expo-notifications';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { SERVICE_AREAS } from '@fixnow/shared';
import { useI18n } from '../i18n';
import type { TranslationKey } from '../i18n/en';
import { api } from './api';

export interface AppNotification {
  id: string; type: string; bookingId: string | null; params: Record<string, any>; read: boolean; createdAt: string;
}

interface NotifState {
  items: AppNotification[];
  unread: number;
  toast: AppNotification | null;
  dismissToast: () => void;
  format: (n: AppNotification) => string;
  markRead: (ids?: string[]) => Promise<void>;
  reload: () => Promise<void>;
  open: (n: AppNotification) => void;
}

const Ctx = createContext<NotifState | null>(null);
const POLL_MS = 6000;

if (Platform.OS !== 'web') {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
    });
  } catch { /* module unavailable */ }
}

/** Shows an OS notification on the device (local notification — works in Expo Go; no FCM needed). */
async function showLocal(title: string, body: string) {
  if (Platform.OS === 'web') return;
  try {
    await Notifications.scheduleNotificationAsync({ content: { title, body }, trigger: null });
  } catch { /* permission denied or unsupported */ }
}

/**
 * In-app notification feed (push fallback). Polls the API; new items raise an in-app toast
 * and, on Android, a local system notification. Rendering is localized on the device.
 */
export function NotificationsProvider({ children, onOpen }: { children: ReactNode; onOpen: (n: AppNotification) => void }) {
  const { t, pick, lang } = useI18n();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<AppNotification | null>(null);
  const seen = useRef<Set<string> | null>(null);

  const format = useCallback((n: AppNotification) => {
    const p = n.params ?? {};
    const area = SERVICE_AREAS.find((a) => a.code === p.area);
    const key = `notif.${n.type}` as TranslationKey;
    const text = t(key, {
      code: p.bookingCode ?? '', service: pick(p.serviceEn, p.serviceKm), area: area ? (lang === 'km' ? area.name_km : area.name_en) : p.area ?? '',
      amount: p.amount ?? '', score: p.score ?? '', status: p.status ?? '', reason: p.reason ?? '', ticketCode: p.ticketCode ?? '', reference: p.reference ?? '',
    });
    return text === key ? n.type : text;
  }, [t, pick, lang]);

  const reload = useCallback(async () => {
    try {
      const r = await api<{ unread: number; items: AppNotification[] }>('/notifications?pageSize=40');
      setItems(r.items);
      setUnread(r.unread);
      if (seen.current === null) {
        // First load: everything already present counts as seen (no toast storm on sign-in).
        seen.current = new Set(r.items.map((n) => n.id));
        return;
      }
      const fresh = r.items.filter((n) => !seen.current!.has(n.id) && !n.read);
      fresh.forEach((n) => seen.current!.add(n.id));
      if (fresh.length) {
        setToast(fresh[0]);
        await showLocal('FixNow', format(fresh[0]));
      }
    } catch { /* offline: keep last state, the offline banner explains */ }
  }, [format]);

  useEffect(() => {
    if (Platform.OS !== 'web') {
      (async () => {
        try {
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('fixnow', { name: 'FixNow updates', importance: Notifications.AndroidImportance.HIGH });
          }
          const perm = await Notifications.getPermissionsAsync();
          if (!perm.granted) await Notifications.requestPermissionsAsync();
        } catch { /* ignore */ }
      })();
    }
    reload();
    const id = setInterval(reload, POLL_MS);
    return () => clearInterval(id);
  }, [reload]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  const markRead = useCallback(async (ids?: string[]) => {
    try {
      await api('/notifications/read', { method: 'POST', body: ids ? { ids } : {} });
      await reload();
    } catch { /* ignore */ }
  }, [reload]);

  const value = useMemo<NotifState>(() => ({
    items, unread, toast, format, markRead, reload,
    dismissToast: () => setToast(null),
    open: (n) => { setToast(null); if (!n.read) markRead([n.id]); onOpen(n); },
  }), [items, unread, toast, format, markRead, reload, onOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Nullable: screens outside the tabbed app (welcome, pending gate) have no feed. */
export function useNotifications() {
  return useContext(Ctx);
}
