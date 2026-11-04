import type { Tracker } from '@cocon/schemas';
import type { ChoiceStorage } from './recipe-choices';
import { TIMER_CATEGORY, TimerAlertAction, TimerAlertData, timerOwner, type TimerAlertScheduler } from './timer-alerts';
import { liveTimerStore, queueTimerWrite, timerStorageKey } from './timer-store';
import * as T from './timers';

/** A tap on a timer notification's "+1 min" or "Stop", as the phone reports it. */
export interface TimerActionResponse {
  actionIdentifier: string;
  categoryIdentifier: string | null;
  /** From a push sent by a server: never a timer action (only the phone schedules those). */
  fromPush: boolean;
  data: unknown;
}

export interface TimerActionDeps {
  storage: ChoiceStorage;
  tracker: Tracker;
  /** That person's alerts, for when the app was closed and no store is running. */
  alertsFor: (userId: string) => Promise<TimerAlertScheduler>;
  now?: () => number;
}

/**
 * Spec 047 FR-003: "+1 min" runs the timer again for a minute and schedules a new alert; "Stop" ends it.
 * Both run without opening the app. With the app running, they go through that person's timer store;
 * otherwise straight to the saved timers, which the store reads when it next loads. Anything that
 * isn't one of ours is ignored. Returns whether it was handled.
 */
export async function handleTimerAction(response: TimerActionResponse, deps: TimerActionDeps): Promise<boolean> {
  const action = TimerAlertAction.safeParse(response.actionIdentifier);
  const data = TimerAlertData.safeParse(response.data);
  if (response.fromPush || response.categoryIdentifier !== TIMER_CATEGORY || !action.success || !data.success) return false;
  const { timerId, userId } = data.data;
  deps.tracker.track('timer_alert_action', { action: action.data });

  const loading = liveTimerStore(userId);
  const store = loading ? await loading : null;
  if (store) {
    if (action.data === 'add_minute') store.add(timerId, T.MINUTE);
    else store.stop(timerId);
    return true;
  }

  // Queued at once (nothing awaited since the check above), so a store that starts loading now reads it.
  const now = deps.now ?? Date.now;
  await queueTimerWrite(async () => {
    const alerts = await deps.alertsFor(userId);
    // Left over from someone who is no longer signed in here: it just goes.
    if ((await timerOwner(deps.storage)) !== userId) {
      await alerts.cancel([timerId]);
      return;
    }
    const key = timerStorageKey(userId);
    let raw: unknown;
    try {
      const text = await deps.storage.getItem(key);
      raw = text ? JSON.parse(text) : null;
    } catch {
      raw = null;
    }
    const at = now();
    const saved = T.settle(T.parseStored(raw), at).timers;
    if (!saved.some((t) => t.id === timerId)) {
      await alerts.cancel([timerId]);
      return;
    }
    const next = action.data === 'add_minute' ? T.add(saved, timerId, T.MINUTE, at) : T.stop(saved, timerId);
    await deps.storage.setItem(key, JSON.stringify(next));
    const timer = next.find((t) => t.id === timerId);
    if (timer) await alerts.schedule(timer);
    else await alerts.cancel([timerId]);
  });
  return true;
}
