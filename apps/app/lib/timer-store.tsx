import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AppState } from 'react-native';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../strings/en';
import { applyLiveAction, type LiveActionRecord, type LiveTimerActivity } from './live-activity';
import type { ChoiceStorage } from './recipe-choices';
import { alertChanges, setTimerOwner, type TimerAlertScheduler } from './timer-alerts';
import * as T from './timers';
import type { Timer, TimerOrigin } from './timers';

/**
 * The app's timers (spec 010): one list per person on this device, kept in device storage so they
 * survive a reload (FR-001). Screens read `{timers, now}` and compute each clock from `endsAt`.
 */
export interface TimersSnapshot {
  timers: readonly Timer[];
  now: number;
  /** The pill's ✕ was tapped (spec 011 FR-008): until a timer starts or finishes, or the app reopens. */
  pillHidden: boolean;
}

export interface TimerStore {
  subscribe(listener: () => void): () => void;
  getSnapshot(): TimersSnapshot;
  /** Returns the new timer's id. */
  start(label: string, seconds: number, from: 'step' | 'quick', origin?: TimerOrigin): string;
  /** A quick "Kitchen timer" (FR-002); 5 min unless the Timers screen picks 10, 15 or 30 (spec 011). */
  quick(seconds?: number): string;
  pause(id: string): void;
  resume(id: string): void;
  /** ±60 s (FR-002). */
  add(id: string, deltaSeconds: number): void;
  set(id: string, seconds: number): void;
  stop(id: string): void;
  dismiss(id: string): void;
  /** Hides the TimerPill on every screen without touching any timer (spec 011 FR-008). */
  hidePill(): void;
  /** Called for each timer that reaches zero while the app is on screen (not one that ended while closed, asleep or in the background). */
  onFinished(listener: (timer: Timer) => void): () => void;
  /** Called after every start: the first may ask for notifications (spec 046 FR-002). */
  onStarted(listener: () => void): () => void;
  /** The Timers screen is on screen (spec 047 FR-001): done timers' alerts and follow-ups go. Ignored while the app isn't. */
  seenDone(): void;
  /** Matches the phone's timer notifications to the timers again (app back in front, a switch changed). */
  reconcileAlerts(): void;
  /** Spec 048: shows the timers on the Lock Screen card again (app back in front, a switch changed). */
  syncLive(): void;
  /** Spec 048 FR-004: "+1 min", "Pause" or "Resume" tapped on the card, applied as at the moment of the tap. */
  applyLiveActions(): Promise<void>;
  /** Reads the saved timers; ones that ended while the app was closed come back done, silently. */
  load(): Promise<void>;
  destroy(): void;
}

export interface TimerStoreOptions {
  storage: ChoiceStorage;
  /** Whose timers: each person on a shared device has their own. Empty when signed out: nothing is saved. */
  userId: string;
  tracker: Tracker;
  /** Spec 047: the phone's alerts for timers that end while the app is closed. None on the web. */
  alerts?: TimerAlertScheduler;
  /** Spec 048: the Live Activity on the Lock Screen and in the Dynamic Island. None on the web. */
  live?: LiveTimerActivity;
  /** Whether the app is on screen. It can also run in the background (audio), unseen. */
  isForeground?: () => boolean;
  now?: () => number;
}

/** Often enough that a clock never shows a second late by more than a quarter of one. */
export const TICK_MS = 250;
/**
 * A timer reached zero "in the app" only if the app was on screen and ticking right up to it: no tick
 * for longer than this means it was asleep or in the background, and the phone's alert did the job.
 */
export const SEEN_GAP_MS = 5000;

export const timerStorageKey = (userId: string) => `cocon.timers.${userId}`;
const storageKey = timerStorageKey;

// Spec 047: a "+1 min" or "Stop" tapped on the Lock Screen goes to that person's store once it has
// loaded; before that it is written to storage, and a load waits for those writes first.
const loaded = new Map<string, { store: TimerStore; ready: Promise<boolean> }>();
let writes: Promise<unknown> = Promise.resolve();
let pendingWrites = 0;

// Spec 047: when a store was last on screen, ticking (see SEEN_GAP_MS).
let lastSeenOnScreen = -Infinity;

/**
 * While the app is open, the phone's own timer alert is hidden only when the app plays its own: on
 * screen and ticking right up to now. Just woken (unlocked in the very second it ends): the phone's shows.
 */
export function timersOnScreen(at = Date.now()): boolean {
  return at - lastSeenOnScreen <= SEEN_GAP_MS;
}

/**
 * That person's store on this device, once it has read its timers (null if that failed); null right
 * away when none has started loading, so a caller can queue a write before any load reads.
 */
export function liveTimerStore(userId: string): Promise<TimerStore | null> | null {
  const entry = loaded.get(userId);
  return entry ? entry.ready.then((ok) => (ok ? entry.store : null)) : null;
}

/** Runs a change to saved timers after the ones before it; loads wait for all of them. */
export function queueTimerWrite(f: () => Promise<void>): Promise<void> {
  pendingWrites++;
  const next = writes
    .then(f)
    .catch(() => undefined)
    .finally(() => pendingWrites--);
  writes = next;
  return next;
}

/** On sign-out: labels are recipe text, so nothing stays behind on a shared device. */
export async function clearTimers(storage: { removeItem: (key: string) => Promise<void> }, userId: string): Promise<void> {
  try {
    await storage.removeItem(storageKey(userId));
  } catch {
    // Nothing else to do; the next sign-in on this device reads only its own key.
  }
}

export function createTimerStore({ storage, userId, tracker, alerts, live, isForeground = () => AppState.currentState === 'active', now = Date.now }: TimerStoreOptions): TimerStore {
  let timers: Timer[] = [];
  // Not saved: reopening the app shows the pill again.
  let pillHidden = false;
  let snapshot: TimersSnapshot = { timers, now: now(), pillHidden };
  let shown = '';
  let interval: ReturnType<typeof setInterval> | null = null;
  // Wakes the store when a paused or done timer is due to be cleared (3 h, spec 011).
  let expiry: ReturnType<typeof setTimeout> | null = null;
  let nextId = 0;
  // Set by destroy(): a load still reading storage must not start ticking a store nobody uses.
  let destroyed = false;
  // Set once the saved timers are read: matching alerts to an empty list would cancel them all.
  let hasRead = false;
  // The last moment the app was seen on screen (a tick or a tap there).
  let seenAt = -Infinity;
  const markSeen = (at: number) => {
    seenAt = isForeground() ? at : -Infinity;
    lastSeenOnScreen = seenAt;
  };
  const listeners = new Set<() => void>();
  const finishedListeners = new Set<(t: Timer) => void>();
  const startedListeners = new Set<() => void>();

  /** What the screens show: only a change here re-renders them, so 10 timers stay cheap (SC-002). */
  const shownKey = (at: number) => timers.map((t) => `${t.id}:${t.state}:${T.remaining(t, at)}`).join('|');

  function publish(at: number, force = false) {
    const key = shownKey(at);
    if (!force && key === shown) return;
    shown = key;
    snapshot = { timers, now: at, pillHidden };
    listeners.forEach((l) => l());
  }

  function save() {
    // Signed out: nothing is kept (no one to keep it for).
    if (!userId || destroyed) return;
    // Best effort: if the device refuses, timers still run, they just won't survive a reload.
    storage.setItem(storageKey(userId), JSON.stringify(timers)).catch(() => undefined);
  }

  // Spec 047 SC-002: every change to the list (re)schedules or cancels its alerts. Best effort.
  function syncAlerts(prev: readonly Timer[], next: readonly Timer[], seen: readonly string[] = []) {
    if (!alerts) return;
    const { schedule: due, cancel } = alertChanges(prev, next);
    const gone = [...new Set([...cancel, ...seen])];
    if (gone.length) void alerts.cancel(gone);
    due.forEach((t) => void alerts.schedule(t));
  }

  // Spec 048 FR-001: the card follows every change. Not before the saved timers are read: an empty
  // list would end the card still showing them.
  function syncLive() {
    if (live && hasRead && !destroyed) live.sync(timers);
  }

  function tick() {
    const at = now();
    // Seen only if on screen now and a moment ago too: not asleep, not running unseen in the background.
    const onScreen = isForeground() && at - seenAt <= SEEN_GAP_MS;
    markSeen(at);
    const { timers: settled, finished } = T.settle(timers, at);
    const next = T.expire(settled, at);
    const cleared = next.length !== settled.length;
    if (finished.length || cleared) {
      // Ended on screen: the in-app alert plays (spec 010) and the phone's is already hidden, so its
      // follow-up goes (047 edge cases). Ended unseen: the phone's alert and follow-up stay, silently.
      const seen = onScreen ? finished : [];
      syncAlerts(timers, next, seen.map((t) => t.id));
      timers = next;
      if (seen.length) pillHidden = false;
      save();
      syncLive();
      seen.forEach((t) => {
        tracker.track('timer_finished', {});
        finishedListeners.forEach((l) => l(t));
      });
    }
    publish(at, finished.length > 0 || cleared);
    schedule();
  }

  function schedule() {
    const anyRunning = !destroyed && timers.some((t) => t.state === 'running');
    if (anyRunning && !interval) interval = setInterval(tick, TICK_MS);
    if (!anyRunning && interval) {
      clearInterval(interval);
      interval = null;
    }
    if (expiry) clearTimeout(expiry);
    expiry = null;
    const due = destroyed ? null : T.nextExpiry(timers);
    // setTimeout can't wait longer than about 24 days; 3 h is far below that.
    if (due !== null) expiry = setTimeout(tick, Math.max(0, due - now()));
  }

  function change(f: (ts: readonly Timer[], at: number) => Timer[]) {
    const at = now();
    markSeen(at);
    const prev = timers;
    timers = f(timers, at);
    syncAlerts(prev, timers);
    save();
    syncLive();
    publish(at, true);
    schedule();
  }

  const leftOf = (id: string) => {
    const t = timers.find((x) => x.id === id);
    return t ? T.remaining(t, now()) : null;
  };

  const store: TimerStore = {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    start(label, seconds, from, origin) {
      const id = `${now().toString(36)}-${(nextId++).toString(36)}`;
      pillHidden = false;
      change((ts, at) => T.start(ts, id, label, seconds, at, origin));
      tracker.track('timer_started', { from });
      startedListeners.forEach((l) => l());
      return id;
    },
    quick: (seconds = T.QUICK_SECONDS) => store.start(strings.timers.kitchenTimer, seconds, 'quick'),
    pause: (id) => change((ts, at) => T.pause(ts, id, at)),
    resume: (id) => change((ts, at) => T.resume(ts, id, at)),
    add(id, deltaSeconds) {
      if (leftOf(id) === null) return;
      change((ts, at) => T.add(ts, id, deltaSeconds, at));
      tracker.track('timer_adjusted', { delta_min: Math.round(deltaSeconds / T.MINUTE) });
    },
    set(id, seconds) {
      const left = leftOf(id);
      if (left === null) return;
      change((ts, at) => T.set(ts, id, seconds, at));
      tracker.track('timer_adjusted', { delta_min: Math.round((seconds - left) / T.MINUTE) });
    },
    stop: (id) => change((ts) => T.stop(ts, id)),
    dismiss: (id) => change((ts) => T.dismiss(ts, id)),
    hidePill() {
      if (pillHidden) return;
      pillHidden = true;
      publish(now(), true);
    },
    onFinished(listener) {
      finishedListeners.add(listener);
      return () => finishedListeners.delete(listener);
    },
    onStarted(listener) {
      startedListeners.add(listener);
      return () => startedListeners.delete(listener);
    },
    seenDone() {
      // The Timers screen can stay open behind the Lock Screen: only on screen does it count.
      if (!isForeground()) return;
      const done = timers.filter((t) => t.state === 'done').map((t) => t.id);
      if (alerts && done.length) void alerts.cancel(done);
    },
    reconcileAlerts() {
      if (alerts && hasRead && !destroyed) void alerts.reconcile(timers);
    },
    syncLive,
    async applyLiveActions() {
      if (!live || !hasRead || destroyed) return;
      const taps = await live.takeActions();
      if (destroyed) return;
      taps.forEach((tap: LiveActionRecord) => {
        tracker.track('timer_live_activity_action', { action: tap.action });
        // Never later than now, whatever the phone's clock said.
        change((ts, at) => applyLiveAction(ts, { ...tap, at: Math.min(tap.at, at) }));
      });
    },
    async load() {
      if (!userId) return;
      let ready: (ok: boolean) => void = () => undefined;
      const entry = { store, ready: new Promise<boolean>((r) => (ready = r)) };
      loaded.set(userId, entry);
      try {
        await read();
        ready(!destroyed);
      } catch {
        ready(false);
      }
    },
    destroy() {
      destroyed = true;
      if (loaded.get(userId)?.store === store) loaded.delete(userId);
      if (interval) clearInterval(interval);
      interval = null;
      if (expiry) clearTimeout(expiry);
      expiry = null;
      listeners.clear();
      finishedListeners.clear();
      startedListeners.clear();
    },
  };

  async function read() {
    // A "+1 min" from the Lock Screen may still be writing (spec 047).
    while (pendingWrites) await writes;
    let raw: unknown;
    try {
      const text = await storage.getItem(storageKey(userId));
      raw = text ? JSON.parse(text) : null;
    } catch {
      raw = null;
    }
    if (destroyed) return;
    const at = now();
    const stored = T.expire(T.settle(T.parseStored(raw), at).timers, at);
    // Anything started while storage was being read stays.
    const ids = new Set(timers.map((t) => t.id));
    timers = [...stored.filter((t) => !ids.has(t.id)), ...timers];
    // Write back what changed while closed (ended, cleared, given a stop time), so a reload doesn't
    // restart a paused timer's 3 hours.
    if (raw !== null) save();
    publish(at, true);
    markSeen(at);
    schedule();
    hasRead = true;
    store.reconcileAlerts();
    // Taps on the card while the app was closed first (spec 048): showing the saved timers before
    // would put the old time back on the card for a moment.
    await store.applyLiveActions();
    syncLive();
  }
  return store;
}

/** The store keeps one scheduler, which passes each call to the latest alerts; with none it does nothing. */
function forwardingAlerts(): TimerAlertScheduler & { use: (alerts: TimerAlertScheduler | undefined) => void } {
  let current: TimerAlertScheduler | undefined;
  return {
    use: (alerts) => void (current = alerts),
    schedule: async (t) => current?.schedule(t),
    cancel: async (ids) => current?.cancel(ids),
    reconcile: async (ts) => current?.reconcile(ts),
    cancelAll: async () => current?.cancelAll(),
  };
}

/** The same for the Live Activity (spec 048): turning "Timer on Lock Screen" off never makes a new store. */
function forwardingLive(): LiveTimerActivity & { use: (live: LiveTimerActivity | undefined) => void } {
  let current: LiveTimerActivity | undefined;
  return {
    use: (live) => void (current = live),
    sync: (timers) => current?.sync(timers),
    takeActions: async () => (current ? current.takeActions() : []),
    onAction: (listener) => (current ? current.onAction(listener) : () => undefined),
    dispose: () => current?.dispose(),
  };
}

/**
 * Spec 047, security review: who owns the timers on this phone, for "+1 min" with no screen yet; once
 * signed out (expired, or signed out elsewhere too), the last person's Lock Screen alerts go. Never
 * while the session is still loading: every launch starts there, and the alerts waiting must stay.
 */
export function useTimerOwner(storage: ChoiceStorage, status: 'loading' | 'signedOut' | 'noFamily' | 'ready', userId: string, removeAlerts?: () => Promise<void>): void {
  const remove = useRef(removeAlerts);
  useEffect(() => {
    remove.current = removeAlerts;
  });
  // Through the same line as a Lock Screen "+1 min" (security review): an action already under way
  // can't put an alert back after this, and the next person's store reads its timers only after.
  const handOver = (owner: string, clear: boolean) =>
    void queueTimerWrite(async () => {
      if (clear) await remove.current?.();
      await setTimerOwner(storage, owner);
    });
  const previous = useRef('');
  useEffect(() => {
    if (!userId) return;
    // Straight from one person to another (a sign-in link opened on a signed-in phone): the last one's go too.
    handOver(userId, previous.current !== '' && previous.current !== userId);
    previous.current = userId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage, userId]);
  const signedOut = status === 'signedOut';
  useEffect(() => {
    if (!signedOut) return;
    handOver('', true);
    previous.current = '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storage, signedOut]);
}

/** Exported for tests that hand a screen their own store. */
export const TimersContext = createContext<TimerStore | null>(null);

export interface TimersProviderProps {
  userId: string;
  storage: ChoiceStorage;
  tracker: Tracker;
  now?: () => number;
  /** After every start (spec 046: the first may ask for notifications). */
  onStart?: () => void;
  /** Spec 047: alerts when the app is closed. Changes (a switch, the permission) never make a new store. */
  alerts?: TimerAlertScheduler;
  /** Spec 048: the Lock Screen card. The same: a new one never makes a new store. */
  live?: LiveTimerActivity;
  children: ReactNode;
}

/** App-wide, so timers keep running on every screen (US1). A new person on the device gets their own. */
export function TimersProvider({ userId, storage, tracker, now, onStart, alerts, live, children }: TimersProviderProps) {
  const [forward] = useState(forwardingAlerts);
  const [forwardLive] = useState(forwardingLive);
  const store = useMemo(
    () => createTimerStore({ storage, userId, tracker, now, alerts: forward, live: forwardLive }),
    [storage, userId, tracker, now, forward, forwardLive],
  );
  useEffect(() => {
    forward.use(alerts);
    store.reconcileAlerts();
  }, [alerts, forward, store]);
  // Spec 048: a tap on the card while the app runs (even unseen, woken by the tap) is applied at once.
  useEffect(() => {
    forwardLive.use(live);
    store.syncLive();
    const off = live?.onAction(() => void store.applyLiveActions());
    return () => {
      off?.();
      live?.dispose();
    };
  }, [live, forwardLive, store]);
  // Back in front: follow-ups that arrived are counted, and nothing stale waits (spec 047); the card
  // shows the timers as they are now, with any taps on it since (spec 048).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') return;
      // The card's taps first, so the app and the card show the new time at once (never the old one).
      void store.applyLiveActions().then(() => {
        store.reconcileAlerts();
        store.syncLive();
      });
    });
    return () => sub.remove();
  }, [store]);
  // A listener, not a store option: a new callback must not make a new store (that would drop the running timers).
  useEffect(() => (onStart ? store.onStarted(onStart) : undefined), [store, onStart]);
  useEffect(() => {
    void store.load();
    return () => store.destroy();
  }, [store]);
  return <TimersContext.Provider value={store}>{children}</TimersContext.Provider>;
}

export function useTimerStore(): TimerStore {
  const store = useContext(TimersContext);
  if (!store) throw new Error('useTimerStore needs a TimersProvider');
  return store;
}

export function useTimers(): TimersSnapshot {
  const store = useTimerStore();
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}

/** A step's timer, if one is going (or done) for it. */
export function useStepTimer(recipeId: string, stepId: string): { timer: Timer | null; left: number } {
  const { timers, now } = useTimers();
  const timer = timers.find((t) => t.recipeId === recipeId && t.stepId === stepId) ?? null;
  return { timer, left: timer ? T.remaining(timer, now) : 0 };
}

/**
 * FR-004, for the TimerPill (spec 011): only running timers count. `timer` is null, and the pill
 * hidden, when nothing is running or its ✕ was tapped (FR-008); `running` gives its "+N" and label.
 */
export function useMostUrgent(): { timer: Timer | null; left: number; count: number; running: number } {
  const { timers, now, pillHidden } = useTimers();
  const timer = pillHidden ? null : T.pillTimer(timers, now);
  const running = timers.filter((t) => t.state === 'running').length;
  return { timer, left: timer ? T.remaining(timer, now) : 0, count: timers.length, running };
}
