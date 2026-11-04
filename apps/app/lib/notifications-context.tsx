import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { DEFAULT_NOTIFICATION_PREFS, type NotificationAskTrigger, type NotificationPrefs, type Tracker } from '@cocon/schemas';
import { AskSheet } from '../components/notifications/AskSheet';
import { strings } from '../strings/en';
import {
  deviceId,
  NO_ASK,
  openedRoute,
  readAsk,
  readPrefs,
  recordAsk,
  registerDevice,
  savePushPrefs,
  shouldAsk,
  writeAsk,
  writePrefs,
  type AskState,
  type NativeNotifications,
  type PermissionStatus,
  type Storage,
} from './notifications';
import type { Client } from './supabase';

export interface NotificationsContextValue {
  /** False on the web: the page says "Notifications work in the iPhone app." */
  supported: boolean;
  /** Null until the iPhone has said. */
  status: PermissionStatus | null;
  prefs: NotificationPrefs;
  setPref: <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => void;
  /** FR-002: shows the ask sheet when it may (the first timer, the first reminder), never at launch. */
  maybeAsk: (trigger: 'timer' | 'reminder') => void;
  /** The iPhone's own prompt, from the sheet or the page's "Turn on notifications". */
  turnOn: (trigger: NotificationAskTrigger) => Promise<void>;
  openSettings: () => void;
}

const off: NotificationsContextValue = {
  supported: false,
  status: null,
  prefs: DEFAULT_NOTIFICATION_PREFS,
  setPref: () => undefined,
  maybeAsk: () => undefined,
  turnOn: async () => undefined,
  openSettings: () => undefined,
};
const NotificationsContext = createContext<NotificationsContextValue>(off);

export interface NotificationsProviderProps {
  native: NativeNotifications | null;
  storage: Storage;
  client: Pick<Client, 'rpc'>;
  tracker: Tracker;
  /** The signed-in member with a family, or '' (nothing is registered or opened before that). */
  userId: string;
  /** Opens a tapped notification's screen (FR-006). */
  navigate: (route: string) => void;
  /** A reminder that arrived while the app is open: a StatusBanner with the same text, "Open" goes to the event. */
  showBanner: (text: string, onOpen: () => void) => void;
  now?: () => number;
  children: ReactNode;
}

/** Spec 046 for every screen (root layout): permission, the ask sheet, this phone's registration and taps. */
export function NotificationsProvider({ native, storage, client, tracker, userId, navigate, showBanner, now = Date.now, children }: NotificationsProviderProps) {
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIFICATION_PREFS);
  const [asking, setAsking] = useState<'timer' | 'reminder' | null>(null);
  const [busy, setBusy] = useState(false);
  const ask = useRef<AskState>(NO_ASK);
  const prefsRef = useRef(prefs);
  const pending = useRef<string | null>(null);
  // Listeners set up once read the latest values through these.
  const userRef = useRef(userId);
  useEffect(() => {
    prefsRef.current = prefs;
    userRef.current = userId;
  }, [prefs, userId]);

  // The iPhone's answer, read again whenever the app comes back (Settings may have changed it).
  useEffect(() => {
    if (!native) return;
    const read = () => void native.permission().then(setStatus, () => setStatus('undetermined'));
    read();
    void readAsk(storage).then((a) => (ask.current = a));
    const sub = AppState.addEventListener('change', (s) => s === 'active' && read());
    return () => sub.remove();
  }, [native, storage]);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    void readPrefs(storage, userId).then((p) => live && setPrefs(p));
    return () => {
      live = false;
    };
  }, [storage, userId]);

  // FR-004: registered once allowed, on every start (token refresh, last seen) and when the token changes.
  useEffect(() => {
    if (!native || !userId || status !== 'granted') return;
    const register = async () => {
      const prefsNow = await readPrefs(storage, userId);
      await registerDevice(client, native, storage, prefsNow).catch(() => false);
    };
    void register();
    return native.onTokenChange(() => void register());
  }, [native, client, storage, userId, status]);

  // FR-006: a tap opens its screen, once someone is signed in (cold start included).
  useEffect(() => {
    if (!native) return;
    return native.onOpen((data, coldStart) => {
      const opened = openedRoute(data);
      if (!opened) return;
      tracker.track('notification_opened', { kind: opened.kind, cold_start: coldStart });
      if (opened.kind === 'timer_done') tracker.track('timer_alert_action', { action: 'open' });
      if (userRef.current) navigate(opened.route);
      else pending.current = opened.route;
    });
  }, [native, tracker, navigate]);
  useEffect(() => {
    if (userId && pending.current) {
      navigate(pending.current);
      pending.current = null;
    }
  }, [userId, navigate]);

  useEffect(() => {
    if (!native) return;
    return native.onForeground((n) => {
      const opened = openedRoute(n.data);
      if (!opened || opened.kind !== 'reminder' || !userRef.current) return;
      showBanner(strings.notifications.inApp(n.title, n.body), () => navigate(opened.route));
    });
  }, [native, showBanner, navigate]);

  const maybeAsk = useCallback(
    (trigger: 'timer' | 'reminder') => {
      if (!native || !userRef.current) return;
      void (async () => {
        const current = status ?? (await native.permission().catch(() => 'undetermined' as const));
        if (!shouldAsk(ask.current, current, now())) return;
        setAsking((open) => {
          if (open === null) tracker.track('notifications_ask_shown', { trigger });
          return open ?? trigger;
        });
      })();
    },
    [native, status, now, tracker],
  );

  const turnOn = useCallback(
    async (trigger: NotificationAskTrigger) => {
      if (!native) return;
      const result = await native.request().catch(() => 'undetermined' as const);
      setStatus(result);
      if (result !== 'undetermined') {
        tracker.track('notifications_permission_result', { granted: result === 'granted', trigger });
        ask.current = recordAsk(ask.current, result, now());
        await writeAsk(storage, ask.current);
      }
    },
    [native, tracker, storage, now],
  );

  const sheetTurnOn = async () => {
    if (!asking) return;
    setBusy(true);
    try {
      await turnOn(asking);
    } finally {
      setBusy(false);
      setAsking(null);
    }
  };
  const notNow = () => {
    ask.current = recordAsk(ask.current, 'not_now', now());
    void writeAsk(storage, ask.current);
    setAsking(null);
  };

  const setPref = useCallback(
    <K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) => {
      const next = { ...prefsRef.current, [key]: value };
      setPrefs(next);
      tracker.track('notification_settings_changed', { setting: key, value: typeof value === 'boolean' ? (value ? 'on' : 'off') : (value as 'mine' | 'all') });
      if (!userRef.current) return;
      void writePrefs(storage, userRef.current, next);
      if (native && status === 'granted') void deviceId(storage).then((id) => savePushPrefs(client, id, next)).catch(() => undefined);
    },
    [tracker, storage, native, status, client],
  );

  const value = useMemo<NotificationsContextValue>(
    () => (native ? { supported: true, status, prefs, setPref, maybeAsk, turnOn, openSettings: native.openSettings } : off),
    [native, status, prefs, setPref, maybeAsk, turnOn],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      {native ? <AskSheet trigger={asking} busy={busy} onTurnOn={() => void sheetTurnOn()} onNotNow={notNow} /> : null}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  return useContext(NotificationsContext);
}
