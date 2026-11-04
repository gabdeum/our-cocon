import { z } from 'zod';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../strings/en';
import { alertContent, devLog, TimerAlertData, type LiveAlert } from './timer-alerts';
import * as T from './timers';
import type { Timer } from './timers';

/**
 * Spec 048: one Live Activity for all of this phone's timers, on the Lock Screen and in the Dynamic
 * Island. The app decides everything here, words included; the phone draws the countdown and the
 * progress bar from `endsAt` by itself, so nothing is sent every second (FR-002). The phone's own
 * calls are behind `LiveTimerNative` (live-timer-native.ios.ts, none on the web).
 */

/** A done timer stays on the card this long, then the next one shows (US3). */
export const DONE_SHOWN_MS = 10 * 60 * 1000;

export interface LiveRow {
  label: string;
  /** Running: the phone counts down to it. */
  endsAt?: number;
  /** Paused: the time it stays at. */
  remainingSeconds?: number;
}

/** Every word on the card, ready to show. Swift only places them (targets/timer-activity). */
export interface LiveCopy {
  title: string;
  /** "2 running" now; after "Pause" or "Resume" on the card; once the primary timer ends. */
  count: string;
  countToggled: string;
  countDone: string;
  /** "Leek & bacon quiche · step 3", shown under the name ("Paused" while paused). */
  sub: string;
  pausedSub: string;
  /** "Leek & bacon quiche · +1 more" in the expanded island. */
  islandSub: string;
  /** " · +1 more" after the next timer's time, with more than 2 timers. */
  more: string;
  doneTitle: string;
  left: string;
  addMinute: string;
  pause: string;
  resume: string;
}

/** FR-002, plus the primary timer's id (for the buttons), its words, and its alerts (047). Same shape in Swift. */
export interface LiveActivityState {
  id: string;
  state: Timer['state'];
  label: string;
  endsAt?: number;
  remainingSeconds?: number;
  totalSeconds: number;
  /** The next timer only: the card shows one more line. */
  others: LiveRow[];
  othersCount: number;
  copy: LiveCopy;
  /** Only while the primary timer's alerts are on (047): the card's "+1 min" or "Resume" moves them. */
  alert?: LiveAlert;
}

export interface LiveView {
  state: LiveActivityState;
  /** When the primary ends: the phone then shows the done card by itself (no update needed). */
  staleAt: number | null;
  /** When the card next changes with no timer touched (a done timer's 10 minutes). */
  changeAt: number | null;
  timerCount: number;
}

const copy = strings.liveTimer;

const header = (running: number, paused: number) => (running ? copy.running(running) : paused ? copy.paused(paused) : '');

/**
 * What the card shows, or null for no card (FR-001: nothing running or done). A timer that ended in
 * the last 10 minutes comes first (US3), the latest one; otherwise the most urgent (spec 010 FR-004).
 */
export function liveActivityState(timers: readonly Timer[], now: number, alertsFor?: (t: Timer) => LiveAlert | undefined): LiveView | null {
  const shownDone = (t: Timer) => t.state === 'done' && now - (t.stoppedAt ?? now) < DONE_SHOWN_MS;
  const recent = timers.filter(shownDone).sort((a, b) => (b.stoppedAt ?? 0) - (a.stoppedAt ?? 0));
  const primary = recent[0] ?? T.mostUrgent(timers, now);
  if (!primary) return null;

  const counting = timers.filter((t) => t.state !== 'done' && t.id !== primary.id);
  const order = (t: Timer) => (t.state === 'running' ? 0 : 1) * 1e9 + T.remaining(t, now);
  const others = [...counting].sort((a, b) => order(a) - order(b));
  const running = counting.filter((t) => t.state === 'running').length;
  const paused = counting.length - running;

  const count =
    primary.state === 'running' ? header(running + 1, paused) : primary.state === 'paused' ? header(running, paused + 1) : header(running, paused);
  const countToggled =
    primary.state === 'running' ? header(running, paused + 1) : primary.state === 'paused' ? header(running + 1, paused) : count;
  const sub = alertContent(primary).body;
  const recipe = primary.recipeName ?? sub;

  const state: LiveActivityState = {
    id: primary.id,
    state: primary.state,
    label: primary.label,
    ...(primary.state === 'running' ? { endsAt: primary.endsAt } : {}),
    ...(primary.state === 'paused' ? { remainingSeconds: primary.remainingSeconds } : {}),
    totalSeconds: primary.totalSeconds,
    others: others.slice(0, 1).map(row),
    othersCount: others.length,
    copy: {
      title: copy.title,
      count,
      countToggled,
      countDone: header(running, paused),
      sub,
      pausedSub: copy.pausedSub,
      islandSub: others.length ? copy.more(recipe, others.length) : sub,
      more: others.length > 1 ? copy.more('', others.length - 1) : '',
      doneTitle: strings.notifications.timerDone.title(primary.label),
      left: copy.left,
      addMinute: copy.addMinute,
      pause: copy.pause,
      resume: copy.resume,
    },
  };
  const alert = primary.state !== 'done' ? alertsFor?.(primary) : undefined;
  if (alert) state.alert = alert;

  const ends = recent.map((t) => (t.stoppedAt ?? now) + DONE_SHOWN_MS);
  return {
    state,
    staleAt: primary.state === 'running' ? (primary.endsAt ?? null) : null,
    changeAt: ends.length ? Math.min(...ends) : null,
    timerCount: others.length + 1,
  };
}

function row(t: Timer): LiveRow {
  return t.state === 'running' ? { label: t.label, endsAt: t.endsAt } : { label: t.label, remainingSeconds: t.remainingSeconds ?? 0 };
}

/** The card's buttons (FR-004), as the phone recorded them. */
export const LiveTimerAction = z.enum(['add_minute', 'pause', 'resume']);
export type LiveTimerAction = z.infer<typeof LiveTimerAction>;

export const LiveActionRecord = z.object({
  /** Whose card it was (the activity's owner): one left from someone else is dropped. */
  owner: z.uuid(),
  timerId: TimerAlertData.shape.timerId,
  action: LiveTimerAction,
  /** When it was tapped (ms). The app may only see it later. */
  at: z.number(),
});
export type LiveActionRecord = z.infer<typeof LiveActionRecord>;

/**
 * A button tapped on the card, applied as at the moment it was tapped: the app may only run minutes
 * later. A timer that has since been marked done but was still counting then counts again first.
 */
export function applyLiveAction(timers: readonly Timer[], { timerId, action, at }: Pick<LiveActionRecord, 'timerId' | 'action' | 'at'>): Timer[] {
  const rewound = timers.map((t): Timer => {
    if (t.id !== timerId || t.state !== 'done' || t.stoppedAt === undefined || t.stoppedAt <= at) return t;
    const { stoppedAt, ...rest } = t;
    return { ...rest, state: 'running', endsAt: stoppedAt };
  });
  if (action === 'add_minute') return T.add(rewound, timerId, T.MINUTE, at);
  if (action === 'pause') return T.pause(rewound, timerId, at);
  return T.resume(rewound, timerId, at);
}

/** The phone's Live Activity, so tests can fake it. Every call is best effort and never throws past here. */
export interface LiveTimerNative {
  /** Live Activities allowed for the app (iPhone Settings) on iOS 17 or later. */
  enabled(): boolean;
  /** The one already showing, if any (after a relaunch: FR-001). */
  current(): Promise<{ owner: string } | null>;
  start(owner: string, state: LiveActivityState, staleAt: number | null): Promise<boolean>;
  /** That person's card only. False when none was showing any more (ended by iOS after 8 hours, or swiped away). */
  update(owner: string, state: LiveActivityState, staleAt: number | null): Promise<boolean>;
  /** Ends every one of ours and forgets any taps not yet read. */
  end(): Promise<void>;
  /** The taps since the last call, oldest first. */
  takeActions(): Promise<unknown[]>;
  /** A tap on the card's buttons, while the app's code is running. */
  onAction(listener: () => void): () => void;
}

/** What the timer store calls after every change (spec 048 FR-001). */
export interface LiveTimerActivity {
  sync(timers: readonly Timer[]): void;
  /** The taps on the card, for that person, oldest first (FR-004). */
  takeActions(): Promise<LiveActionRecord[]>;
  /** A tap on the card while the app's code runs. */
  onAction(listener: () => void): () => void;
  dispose(): void;
}

// Bumped by `endLiveActivity`: a card object made before can no longer show anything (security
// review: a sync under way at sign-out must not bring the last person's timers back).
let generation = 0;

/** On sign-out or a switch to another person: the card goes, and no sync already under way can restart it. */
export async function endLiveActivity(native: LiveTimerNative): Promise<void> {
  generation++;
  await native.end();
}

export interface LiveActivityOptions {
  native: LiveTimerNative;
  userId: string;
  tracker: Tracker;
  /** "Timer on Lock Screen" (Settings › Notifications). Off: no card. */
  enabled: boolean;
  /** The primary timer's alerts, while 047's are on. */
  alertsFor?: (t: Timer) => LiveAlert | undefined;
  /** ActivityKit only starts one while the app is on screen. */
  isForeground: () => boolean;
  now?: () => number;
}

export function createLiveActivity({ native, userId, tracker, enabled, alertsFor, isForeground, now = Date.now }: LiveActivityOptions): LiveTimerActivity {
  const failed = (e: unknown) => devLog('live activity:', e instanceof Error ? e.message : String(e));
  // Whether this phone's card is ours; null until asked (a relaunch, another person signed in before).
  let attached: boolean | null = null;
  let shown = '';
  let latest: readonly Timer[] = [];
  let line: Promise<unknown> = Promise.resolve();
  let wake: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;
  const born = generation;
  // Checked again after every wait: the person may have signed out meanwhile.
  const gone = () => disposed || born !== generation;

  async function apply() {
    if (gone()) return;
    if (wake) clearTimeout(wake);
    wake = null;
    const at = now();
    const view = liveActivityState(latest, at, alertsFor);
    if (attached === null) {
      const current = await native.current();
      if (gone()) return;
      attached = current?.owner === userId;
      // Someone else's (signed out, or a switch): it goes.
      if (current && !attached) await native.end();
      if (gone()) return;
    }
    if (!enabled || !view) {
      if (attached) await native.end();
      attached = false;
      shown = '';
      return;
    }
    if (view.changeAt !== null) wake = setTimeout(() => sync(latest), Math.max(0, view.changeAt - at));
    const key = JSON.stringify(view);
    if (attached && key === shown) return;
    if (attached && (await native.update(userId, view.state, view.staleAt))) {
      shown = key;
      return;
    }
    attached = false;
    if (gone()) return;
    if (!isForeground() || !native.enabled()) return;
    attached = await native.start(userId, view.state, view.staleAt);
    if (gone() && attached) await native.end();
    if (!attached || gone()) return;
    shown = key;
    tracker.track('timer_live_activity_started', { timer_count: Math.min(100, view.timerCount) });
  }

  // One call at a time, each with the latest timers: a burst of changes ends in the last one.
  function sync(timers: readonly Timer[]) {
    latest = timers;
    line = line.then(apply).catch(failed);
  }

  return {
    sync,
    async takeActions() {
      let raw: unknown[] = [];
      try {
        raw = await native.takeActions();
      } catch (e) {
        failed(e);
      }
      return raw.flatMap((item) => {
        const parsed = LiveActionRecord.safeParse(item);
        return parsed.success && parsed.data.owner === userId ? [parsed.data] : [];
      });
    },
    onAction: (listener) => native.onAction(listener),
    dispose() {
      disposed = true;
      if (wake) clearTimeout(wake);
      wake = null;
    },
  };
}
