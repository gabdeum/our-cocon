import { z } from 'zod';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../strings/en';
import { cookStepPath } from './links';
import { alertContent, devLog, TimerAlertData, type LiveAlert } from './timer-alerts';
import * as T from './timers';
import type { Timer } from './timers';

/**
 * Spec 048: one Live Activity for all of this phone's timers, on the Lock Screen and in the Dynamic
 * Island. On the Lock Screen it is the Timers screen's card (TimerCard README › Timers screen). The
 * app decides everything here, words included; the phone draws the countdown and the progress bar
 * from `endsAt` by itself, so nothing is sent every second (FR-002). The phone's own calls are behind
 * `LiveTimerNative` (live-timer-native.ios.ts, none on the web).
 */

/** A done timer stays on the card this long, then the next one shows (US3). */
export const DONE_SHOWN_MS = 10 * 60 * 1000;

/** One timer as the card shows it, every word ready. Swift only places them (targets/timer-activity). */
export interface LiveFace {
  id: string;
  state: Timer['state'];
  label: string;
  /** "Leek & bacon quiche · Running", and the same once paused or done (the phone switches by itself). */
  subRunning: string;
  subPaused: string;
  subDone: string;
  /** The Dynamic Island: "Leek & bacon quiche · +1 more", or the step. */
  islandSub: string;
  doneTitle: string;
  /** Running: the phone counts down to it. */
  endsAt?: number;
  /** Paused: the time it stays at. */
  remainingSeconds?: number;
  totalSeconds: number;
  /** A tap on the card: the step in cooking mode for a step timer, otherwise Timers. */
  openUrl: string;
  /** The "2 running" pill now; after "Pause", "Resume" or "Add 1 more minute" on the card; once this one ends. */
  count: string;
  countToggled: string;
  countDone: string;
  /** Only while its alerts are on (047): the card's buttons move them. */
  alert?: LiveAlert;
}

/** The buttons' words, from the Timers screen (and the island's). */
export interface LiveCopy {
  minus: string;
  plus: string;
  minusA11y: string;
  plusA11y: string;
  pause: string;
  resume: string;
  addMore: string;
  stop: string;
  dismiss: string;
  removeMinute: string;
  addMinute: string;
  pausedSub: string;
}

/** What the phone gets. Same shape in Swift (TimerActivityAttributes.swift). */
export interface LiveActivityState {
  face: LiveFace;
  /** What the card shows once this one is stopped or dismissed on the Lock Screen; none: the card ends. */
  next?: LiveFace;
  copy: LiveCopy;
  /** "−1" never takes the time left below this (lib/timers.ts). */
  minLeftSeconds: number;
  /** A tap on the "2 running" pill: Timers. */
  timersUrl: string;
}

export interface LiveView {
  state: LiveActivityState;
  /** When the timer shown ends: the phone then shows the done card by itself (no update needed). */
  staleAt: number | null;
  /** When the card next changes with no timer touched (a done timer's 10 minutes). */
  changeAt: number | null;
  timerCount: number;
}

const live = strings.liveTimer;
const screen = strings.timersScreen;

const header = (running: number, paused: number) => (running ? live.running(running) : paused ? live.paused(paused) : '');

export interface LiveStateOptions {
  /** A timer's alerts, while 047's are on. */
  alertsFor?: (t: Timer) => LiveAlert | undefined;
  /** A path in the app as a link the phone opens (the app's own scheme). */
  url?: (path: string) => string;
}

/** A timer that ended in the last 10 minutes comes first (US3), the latest one; otherwise the most urgent (spec 010 FR-004). */
function shownTimer(timers: readonly Timer[], now: number): Timer | null {
  const recent = timers.filter((t) => t.state === 'done' && now - (t.stoppedAt ?? now) < DONE_SHOWN_MS);
  return recent.sort((a, b) => (b.stoppedAt ?? 0) - (a.stoppedAt ?? 0))[0] ?? T.mostUrgent(timers, now);
}

function faceOf(timers: readonly Timer[], t: Timer, { alertsFor, url = (p) => p }: LiveStateOptions): LiveFace {
  const others = timers.filter((o) => o.state !== 'done' && o.id !== t.id);
  const running = others.filter((o) => o.state === 'running').length;
  const paused = others.length - running;
  const count = t.state === 'running' ? header(running + 1, paused) : t.state === 'paused' ? header(running, paused + 1) : header(running, paused);
  // Pause, Resume, or "Add 1 more minute" on a done one (it runs again).
  const countToggled = t.state === 'running' ? header(running, paused + 1) : header(running + 1, paused);
  const recipe = t.recipeName ?? screen.noRecipe;
  const step = alertContent(t).body;
  const face: LiveFace = {
    id: t.id,
    state: t.state,
    label: t.label,
    subRunning: screen.sub(recipe, screen.running),
    subPaused: screen.sub(recipe, screen.paused),
    subDone: screen.sub(recipe, screen.done),
    islandSub: others.length ? live.more(t.recipeName ?? step, others.length) : step,
    doneTitle: strings.notifications.timerDone.title(t.label),
    ...(t.state === 'running' ? { endsAt: t.endsAt } : {}),
    ...(t.state === 'paused' ? { remainingSeconds: t.remainingSeconds } : {}),
    totalSeconds: t.totalSeconds,
    openUrl: url(t.recipeId && t.stepId ? cookStepPath(t.recipeId, t.stepId) : '/timers'),
    count,
    countToggled,
    countDone: header(running, paused),
  };
  const alert = alertsFor?.(t);
  if (alert) face.alert = alert;
  return face;
}

/** What the card shows, or null for no card (FR-001: nothing running or recently done). */
export function liveActivityState(timers: readonly Timer[], now: number, options: LiveStateOptions = {}): LiveView | null {
  const primary = shownTimer(timers, now);
  if (!primary) return null;
  const rest = timers.filter((t) => t.id !== primary.id);
  const after = shownTimer(rest, now);
  const state: LiveActivityState = {
    face: faceOf(timers, primary, options),
    ...(after ? { next: faceOf(rest, after, options) } : {}),
    copy: {
      minus: screen.minus,
      plus: screen.plus,
      minusA11y: screen.minusA11y,
      plusA11y: screen.plusA11y,
      pause: screen.pause,
      resume: screen.resume,
      addMore: screen.addMinute,
      stop: screen.stop,
      dismiss: screen.dismiss,
      removeMinute: live.removeMinute,
      addMinute: live.addMinute,
      pausedSub: live.pausedSub,
    },
    minLeftSeconds: T.MIN_REDUCED_SECONDS,
    timersUrl: (options.url ?? ((p) => p))('/timers'),
  };
  const ends = timers.filter((t) => t.state === 'done' && now - (t.stoppedAt ?? now) < DONE_SHOWN_MS).map((t) => (t.stoppedAt ?? now) + DONE_SHOWN_MS);
  return {
    state,
    staleAt: primary.state === 'running' ? (primary.endsAt ?? null) : null,
    changeAt: ends.length ? Math.min(...ends) : null,
    timerCount: timers.filter((t) => t.state !== 'done').length + (primary.state === 'done' ? 1 : 0),
  };
}

/** The card's buttons (FR-004), as the phone recorded them. */
export const LiveTimerAction = z.enum(['add_minute', 'remove_minute', 'pause', 'resume', 'stop', 'dismiss']);
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
 * later. A timer marked done since, but still counting then, counts again first; one that had reached
 * zero by then is done ("Add 1 more minute" runs it again for a minute).
 */
export function applyLiveAction(timers: readonly Timer[], { timerId, action, at }: Pick<LiveActionRecord, 'timerId' | 'action' | 'at'>): Timer[] {
  const rewound = timers.map((t): Timer => {
    if (t.id !== timerId || t.state !== 'done' || t.stoppedAt === undefined || t.stoppedAt <= at) return t;
    const { stoppedAt, ...rest } = t;
    return { ...rest, state: 'running', endsAt: stoppedAt };
  });
  const then = T.settle(rewound, at).timers;
  if (action === 'add_minute') return T.add(then, timerId, T.MINUTE, at);
  if (action === 'remove_minute') return T.add(then, timerId, -T.MINUTE, at);
  if (action === 'pause') return T.pause(then, timerId, at);
  if (action === 'resume') return T.resume(then, timerId, at);
  return T.stop(then, timerId);
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
  url?: (path: string) => string;
  /** ActivityKit only starts one while the app is on screen. */
  isForeground: () => boolean;
  now?: () => number;
}

export function createLiveActivity({ native, userId, tracker, enabled, alertsFor, url, isForeground, now = Date.now }: LiveActivityOptions): LiveTimerActivity {
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
    const view = liveActivityState(latest, at, { alertsFor, url });
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
