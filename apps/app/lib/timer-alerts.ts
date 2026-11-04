import { z } from 'zod';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../strings/en';
import type { ChoiceStorage } from './recipe-choices';
import { MINUTE, type Timer } from './timers';

/**
 * Spec 047: a timer that ends while the app is closed or the phone is locked alerts through a local
 * notification at `endsAt` (no server), with one follow-up 2 minutes later. The rules are here; the
 * phone's own calls are behind `LocalNotifications` (timer-notifications.ios.ts, none on the web).
 */
export const TIMER_CATEGORY = 'timer_done';
export const TIMER_THREAD = 'timers';
/** The spec 010 chime, twice, bundled through the expo-notifications plugin (app.json). */
export const TIMER_SOUND = 'kitchen-bell.caf';
export const FOLLOW_UP_MS = 2 * MINUTE * 1000;
export const TimerAlertAction = z.enum(['add_minute', 'stop']);
export type TimerAlertAction = z.infer<typeof TimerAlertAction>;

export const alertId = (timerId: string) => `timer:${timerId}`;
export const followUpId = (timerId: string) => `timer:${timerId}:again`;
const isTimerAlert = (id: string) => id.startsWith('timer:');

/**
 * What a timer notification carries (spec 046 FR-006, plus whose timer it is). Local only: it never
 * leaves the phone, and the tap still opens only Timers.
 */
export const TimerAlertData = z.object({
  kind: z.literal('timer_done'),
  route: z.literal('/timers'),
  // As the timer store makes them (base-36 time, a dash, a counter).
  timerId: z.string().regex(/^[0-9a-z]+-[0-9a-z]+$/).max(64),
  userId: z.uuid(),
});
export type TimerAlertData = z.infer<typeof TimerAlertData>;

export interface AlertContent {
  title: string;
  body: string;
}

const copy = strings.notifications.timerDone;

/** FR-002: "Blind bake is done" · "Leek & bacon quiche · step 3", or "5-minute kitchen timer". */
export function alertContent(t: Timer): AlertContent {
  return { title: copy.title(t.label), body: bodyOf(t) };
}

/** FR-002: "Still waiting: Blind bake" · "Done 2 minutes ago." */
export function followUpContent(t: Timer): AlertContent {
  return { title: copy.followUpTitle(t.label), body: copy.followUpBody(FOLLOW_UP_MS / 1000 / MINUTE) };
}

function bodyOf(t: Timer): string {
  if (t.recipeName) return t.stepNumber ? copy.stepBody(t.recipeName, t.stepNumber) : t.recipeName;
  return copy.quickBody(Math.max(1, Math.round(t.totalSeconds / MINUTE)));
}

/**
 * FR-001, for every store action: running timers that are new or end at another time (start, resume,
 * ±1 min, set) get their alert (again); ones that are paused or gone (pause, stop, dismiss, cleared)
 * lose it. A running timer that becomes done keeps its follow-up.
 */
export function alertChanges(prev: readonly Timer[], next: readonly Timer[]): { schedule: Timer[]; cancel: string[] } {
  const before = new Map(prev.map((t) => [t.id, t]));
  const after = new Map(next.map((t) => [t.id, t]));
  const schedule = next.filter((t) => {
    const was = before.get(t.id);
    return t.state === 'running' && (was?.state !== 'running' || was.endsAt !== t.endsAt);
  });
  const cancel = prev.filter((t) => {
    if (t.state === 'paused') return false;
    const now = after.get(t.id);
    return !now || now.state === 'paused';
  });
  return { schedule, cancel: cancel.map((t) => t.id) };
}

/** What the timer store calls (spec 047 SC-002: every action). Each never throws: timers work without it. */
export interface TimerAlertScheduler {
  schedule(timer: Timer): Promise<void>;
  /** Both of each timer's notifications, waiting or already shown. */
  cancel(timerIds: readonly string[]): Promise<void>;
  /** On start and when the app comes back: matches the phone's notifications to the timers, and counts the follow-ups that arrived. */
  reconcile(timers: readonly Timer[]): Promise<void>;
  /** On sign-out: labels are recipe text, so nothing stays on the Lock Screen. */
  cancelAll(): Promise<void>;
}

/** The phone's local notifications, so tests can fake them. */
export interface LocalNotifications {
  scheduleAt(id: string, at: number, content: AlertContent, data: TimerAlertData): Promise<void>;
  /** Removes these, whether still waiting or already in Notification Center. */
  remove(ids: readonly string[]): Promise<void>;
  /** Ours, waiting or shown. */
  ids(): Promise<string[]>;
}

export interface TimerAlertsOptions {
  local: LocalNotifications;
  userId: string;
  storage: ChoiceStorage;
  tracker: Tracker;
  /** Notifications allowed on this phone and "Alert when a timer ends" on (FR, edge cases). */
  enabled: boolean;
  now?: () => number;
}

const followUpsKey = (userId: string) => `cocon.timers.followups.${userId}`;
const OWNER_KEY = 'cocon.timers.owner';

/**
 * Who is signed in, for "+1 min" when the app wakes with no screen (security review): an alert left
 * from someone no longer signed in never touches their timers. '' when nobody is.
 */
export async function setTimerOwner(storage: ChoiceStorage, userId: string): Promise<void> {
  await storage.setItem(OWNER_KEY, userId).catch(() => undefined);
}
export async function timerOwner(storage: ChoiceStorage): Promise<string> {
  try {
    return (await storage.getItem(OWNER_KEY)) ?? '';
  } catch {
    return '';
  }
}

/** On sign-out, with `cancelAll`. */
export async function clearFollowUps(storage: { removeItem: (key: string) => Promise<void> }, userId: string): Promise<void> {
  try {
    await storage.removeItem(followUpsKey(userId));
  } catch {
    // The next sign-in reads only its own key.
  }
}

/**
 * Spec 047 on a phone. Follow-ups that were scheduled and never cancelled are remembered on the phone
 * (`timer id → when it fires`), so `timer_alert_followup_sent` goes once for each one that arrived.
 */
export function createTimerAlerts({ local, userId, storage, tracker, enabled, now = Date.now }: TimerAlertsOptions): TimerAlertScheduler {
  // One change at a time, in order: a cancel right after a schedule must win.
  let queue: Promise<unknown> = Promise.resolve();
  const run = (f: () => Promise<void>): Promise<void> => {
    const next = queue.then(f).catch(() => undefined);
    queue = next;
    return next;
  };

  async function readFollowUps(): Promise<Record<string, number>> {
    try {
      const raw = await storage.getItem(followUpsKey(userId));
      const parsed = z.record(z.string(), z.number()).safeParse(raw ? JSON.parse(raw) : {});
      return parsed.success ? parsed.data : {};
    } catch {
      return {};
    }
  }
  async function writeFollowUps(f: (r: Record<string, number>) => Record<string, number>) {
    const next = f(await readFollowUps());
    await storage.setItem(followUpsKey(userId), JSON.stringify(next)).catch(() => undefined);
  }
  const without = (r: Record<string, number>, ids: readonly string[]) => Object.fromEntries(Object.entries(r).filter(([id]) => !ids.includes(id)));

  async function schedule(t: Timer) {
    if (!enabled || t.state !== 'running' || t.endsAt === undefined || t.endsAt <= now()) return;
    const data: TimerAlertData = { kind: 'timer_done', route: '/timers', timerId: t.id, userId };
    await local.scheduleAt(alertId(t.id), t.endsAt, alertContent(t), data);
    const again = t.endsAt + FOLLOW_UP_MS;
    await local.scheduleAt(followUpId(t.id), again, followUpContent(t), data);
    await writeFollowUps((r) => ({ ...r, [t.id]: again }));
  }

  async function cancel(ids: readonly string[]) {
    if (!ids.length) return;
    await local.remove(ids.flatMap((id) => [alertId(id), followUpId(id)]));
    await writeFollowUps((r) => without(r, ids));
  }

  return {
    schedule: (t) => run(() => schedule(t)),
    cancel: (ids) => run(() => cancel(ids)),
    reconcile: (timers) =>
      run(async () => {
        // US3: the follow-ups whose time came without being cancelled arrived. Never more than one each.
        const at = now();
        const fired = Object.entries(await readFollowUps()).filter(([, fireAt]) => fireAt <= at);
        fired.forEach(() => tracker.track('timer_alert_followup_sent', {}));
        if (fired.length) await writeFollowUps((r) => without(r, fired.map(([id]) => id)));
        // Keep a running timer's two, and a done one's follow-up still to come; anything else goes.
        const keep = new Set(enabled ? timers.flatMap((t) => (t.state === 'paused' ? [] : [alertId(t.id), followUpId(t.id)])) : []);
        const stale = (await local.ids()).filter((id) => isTimerAlert(id) && !keep.has(id));
        if (stale.length) {
          await local.remove(stale);
          await writeFollowUps((r) => without(r, Object.keys(r).filter((id) => stale.includes(followUpId(id)))));
        }
        for (const t of timers) await schedule(t);
      }),
    cancelAll: () =>
      run(async () => {
        const ours = (await local.ids()).filter(isTimerAlert);
        if (ours.length) await local.remove(ours);
        await writeFollowUps(() => ({}));
      }),
  };
}
