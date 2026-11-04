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

/**
 * A line in the `pnpm dev:phone` terminal, to see why an alert did or didn't go (scheduling errors are
 * otherwise silent so the timer keeps working). Development only: never in TestFlight or the App
 * Store app, and only ids and times, never a label.
 */
export function devLog(...parts: unknown[]): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__ && !process.env.VITEST) console.log('[timer alerts]', ...parts);
}

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

/**
 * The phone's local notifications, so tests can fake them. Each call reaches the iPhone the moment it
 * is made, and the iPhone handles them in that order (Expo runs native calls one after another).
 */
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
 * Spec 047 on a phone. A timer's two notifications go to the iPhone at once, in the same moment as the
 * tap: nothing waits in front of them, so locking the phone right after still gets the alert on time,
 * and a later pause or "+1 min" always wins because the iPhone takes requests in order.
 * Follow-ups that were scheduled and never cancelled are remembered on the phone (`timer id → when it
 * fires`), so `timer_alert_followup_sent` goes once for each one that arrived.
 */
export function createTimerAlerts({ local, userId, storage, tracker, enabled, now = Date.now }: TimerAlertsOptions): TimerAlertScheduler {
  const failed = (e: unknown) => devLog('failed:', e instanceof Error ? e.message : String(e));
  // The follow-up record is only storage: its changes go one after another, after the iPhone has the requests.
  let records: Promise<unknown> = Promise.resolve();
  const record = (f: (r: Record<string, number>) => Record<string, number>): Promise<void> => {
    const next = records.then(async () => writeFollowUps(f)).catch(failed);
    records = next;
    return next;
  };
  // When each timer was last scheduled or cancelled, so a re-check already under way leaves it alone.
  const touched = new Map<string, number>();
  let generation = 0;
  const touch = (id: string) => touched.set(id, ++generation);

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

  function schedule(t: Timer): Promise<void> {
    if (!enabled || t.state !== 'running' || t.endsAt === undefined || t.endsAt <= now()) return Promise.resolve();
    touch(t.id);
    const data: TimerAlertData = { kind: 'timer_done', route: '/timers', timerId: t.id, userId };
    const again = t.endsAt + FOLLOW_UP_MS;
    // Both asked for now, before any await.
    const asked = [local.scheduleAt(alertId(t.id), t.endsAt, alertContent(t), data), local.scheduleAt(followUpId(t.id), again, followUpContent(t), data)];
    return Promise.all(asked).then(() => record((r) => ({ ...r, [t.id]: again })), failed);
  }

  function cancel(ids: readonly string[]): Promise<void> {
    if (!ids.length) return Promise.resolve();
    ids.forEach(touch);
    const asked = local.remove(ids.flatMap((id) => [alertId(id), followUpId(id)]));
    return Promise.all([asked.catch(failed), record((r) => without(r, ids))]).then(() => undefined);
  }

  /** "timer:abc-1:again" → "abc-1". */
  const timerOf = (notificationId: string) => notificationId.slice('timer:'.length).replace(/:again$/, '');

  return {
    schedule,
    cancel,
    async reconcile(timers) {
      const since = generation;
      // US3: the follow-ups whose time came without being cancelled arrived. Never more than one each.
      const at = now();
      await record((r) => {
        const fired = Object.entries(r).filter(([, fireAt]) => fireAt <= at);
        fired.forEach(() => tracker.track('timer_alert_followup_sent', {}));
        return without(r, fired.map(([id]) => id));
      });
      try {
        const waiting = (await local.ids()).filter(isTimerAlert);
        // A timer scheduled or cancelled since this re-check began is already right.
        const changed = (id: string) => (touched.get(id) ?? 0) > since;
        // Keep a running timer's two, and a done one's follow-up still to come; anything else goes.
        const keep = new Set(enabled ? timers.flatMap((t) => (t.state === 'paused' ? [] : [alertId(t.id), followUpId(t.id)])) : []);
        const stale = waiting.filter((id) => !keep.has(id) && !changed(timerOf(id)));
        if (stale.length) {
          void local.remove(stale).catch(failed);
          void record((r) => without(r, Object.keys(r).filter((id) => stale.includes(followUpId(id)))));
        }
        // Running timers whose alert the iPhone doesn't have (switched on again, a restart): asked for now.
        const has = new Set(waiting);
        await Promise.all(timers.filter((t) => t.state === 'running' && !changed(t.id) && !has.has(alertId(t.id))).map(schedule));
      } catch (e) {
        failed(e);
      }
    },
    async cancelAll() {
      touched.clear();
      try {
        const ours = (await local.ids()).filter(isTimerAlert);
        if (ours.length) await local.remove(ours);
      } catch (e) {
        failed(e);
      }
      await record(() => ({}));
    },
  };
}
