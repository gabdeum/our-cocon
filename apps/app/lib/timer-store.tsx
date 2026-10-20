import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../strings/en';
import type { ChoiceStorage } from './recipe-choices';
import * as T from './timers';
import type { Timer, TimerOrigin } from './timers';

/**
 * The app's timers (spec 010): one list per person on this device, kept in device storage so they
 * survive a reload (FR-001). Screens read `{timers, now}` and compute each clock from `endsAt`.
 */
export interface TimersSnapshot {
  timers: readonly Timer[];
  now: number;
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
  /** Called for each timer that reaches zero while the app is open (not for one that ended while closed). */
  onFinished(listener: (timer: Timer) => void): () => void;
  /** Reads the saved timers; ones that ended while the app was closed come back done, silently. */
  load(): Promise<void>;
  destroy(): void;
}

export interface TimerStoreOptions {
  storage: ChoiceStorage;
  /** Whose timers: each person on a shared device has their own. Empty when signed out: nothing is saved. */
  userId: string;
  tracker: Tracker;
  now?: () => number;
}

/** Often enough that a clock never shows a second late by more than a quarter of one. */
export const TICK_MS = 250;

const storageKey = (userId: string) => `cocon.timers.${userId}`;

/** On sign-out: labels are recipe text, so nothing stays behind on a shared device. */
export async function clearTimers(storage: { removeItem: (key: string) => Promise<void> }, userId: string): Promise<void> {
  try {
    await storage.removeItem(storageKey(userId));
  } catch {
    // Nothing else to do; the next sign-in on this device reads only its own key.
  }
}

export function createTimerStore({ storage, userId, tracker, now = Date.now }: TimerStoreOptions): TimerStore {
  let timers: Timer[] = [];
  let snapshot: TimersSnapshot = { timers, now: now() };
  let shown = '';
  let interval: ReturnType<typeof setInterval> | null = null;
  // Wakes the store when a paused or done timer is due to be cleared (3 h, spec 011).
  let expiry: ReturnType<typeof setTimeout> | null = null;
  let nextId = 0;
  // Set by destroy(): a load still reading storage must not start ticking a store nobody uses.
  let destroyed = false;
  const listeners = new Set<() => void>();
  const finishedListeners = new Set<(t: Timer) => void>();

  /** What the screens show: only a change here re-renders them, so 10 timers stay cheap (SC-002). */
  const shownKey = (at: number) => timers.map((t) => `${t.id}:${t.state}:${T.remaining(t, at)}`).join('|');

  function publish(at: number, force = false) {
    const key = shownKey(at);
    if (!force && key === shown) return;
    shown = key;
    snapshot = { timers, now: at };
    listeners.forEach((l) => l());
  }

  function save() {
    // Signed out: nothing is kept (no one to keep it for).
    if (!userId || destroyed) return;
    // Best effort: if the device refuses, timers still run, they just won't survive a reload.
    storage.setItem(storageKey(userId), JSON.stringify(timers)).catch(() => undefined);
  }

  function tick() {
    const at = now();
    const { timers: settled, finished } = T.settle(timers, at);
    const next = T.expire(settled, at);
    const cleared = next.length !== settled.length;
    if (finished.length || cleared) {
      timers = next;
      save();
      finished.forEach((t) => {
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
    timers = f(timers, at);
    save();
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
      change((ts, at) => T.start(ts, id, label, seconds, at, origin));
      tracker.track('timer_started', { from });
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
    onFinished(listener) {
      finishedListeners.add(listener);
      return () => finishedListeners.delete(listener);
    },
    async load() {
      if (!userId) return;
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
      schedule();
    },
    destroy() {
      destroyed = true;
      if (interval) clearInterval(interval);
      interval = null;
      if (expiry) clearTimeout(expiry);
      expiry = null;
      listeners.clear();
      finishedListeners.clear();
    },
  };
  return store;
}

/** Exported for tests that hand a screen their own store. */
export const TimersContext = createContext<TimerStore | null>(null);

export interface TimersProviderProps {
  userId: string;
  storage: ChoiceStorage;
  tracker: Tracker;
  now?: () => number;
  children: ReactNode;
}

/** App-wide, so timers keep running on every screen (US1). A new person on the device gets their own. */
export function TimersProvider({ userId, storage, tracker, now, children }: TimersProviderProps) {
  const store = useMemo(() => createTimerStore({ storage, userId, tracker, now }), [storage, userId, tracker, now]);
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
 * hidden, when nothing is running; `running` gives its "+N" and label.
 */
export function useMostUrgent(): { timer: Timer | null; left: number; count: number; running: number } {
  const { timers, now } = useTimers();
  const timer = T.pillTimer(timers, now);
  const running = timers.filter((t) => t.state === 'running').length;
  return { timer, left: timer ? T.remaining(timer, now) : 0, count: timers.length, running };
}
