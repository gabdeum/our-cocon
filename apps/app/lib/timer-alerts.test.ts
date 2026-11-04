// Spec 047: what a timer alert says (US1, FR-002), when it is scheduled or cancelled (FR-001, SC-002)
// and the one follow-up (US3).
import { describe, expect, it, vi } from 'vitest';
import { alertChanges, alertContent, createTimerAlerts, FOLLOW_UP_MS, followUpContent, type LocalNotifications } from './timer-alerts';
import * as T from './timers';
import type { Timer } from './timers';
import { createTimerStore } from './timer-store';
import { fakeTracker } from '../test/fakes';

const T0: number = 1_760_000_000_000;
/** The one timer in a list. */
function only(ts: readonly Timer[]): Timer {
  const [t] = ts;
  if (!t) throw new Error('no timer');
  return t;
}
const endOf = (t: Timer) => t.endsAt ?? 0;
const quiche = { recipeId: 'r1', stepId: 's3', recipeName: 'Leek & bacon quiche', stepNumber: 3 };
const blindBake = (): Timer => only(T.start([], 'a', 'Blind bake', 12 * 60, T0, quiche));

function memoryStorage() {
  const data = new Map<string, string>();
  return { data, getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => void data.set(k, v) };
}

/** The phone's notification list: what's scheduled, and when. */
function fakePhone(): LocalNotifications & { at: Map<string, { at: number; title: string; body: string; data: unknown }> } {
  const at = new Map<string, { at: number; title: string; body: string; data: unknown }>();
  return {
    at,
    scheduleAt: vi.fn(async (id, when, content, data) => void at.set(id, { at: when, ...content, data })),
    remove: vi.fn(async (ids: readonly string[]) => ids.forEach((id) => at.delete(id))),
    ids: async () => [...at.keys()],
  };
}

function alertsFor(phone: LocalNotifications, { enabled = true, now = () => T0 } = {}) {
  const storage = memoryStorage();
  const tracker = fakeTracker();
  return { storage, tracker, alerts: createTimerAlerts({ local: phone, userId: 'u1', storage, tracker, enabled, now }) };
}

describe('content (FR-002)', () => {
  it('US1: a step timer says its recipe and step', () => {
    expect(alertContent(blindBake())).toEqual({ title: 'Blind bake is done', body: 'Leek & bacon quiche · step 3' });
  });

  it('a quick timer says its length', () => {
    const t = only(T.start([], 'k', 'Kitchen timer', 10 * 60, T0));
    expect(alertContent(t)).toEqual({ title: 'Kitchen timer is done', body: '10-minute kitchen timer' });
  });

  it('a step timer saved before this spec has no step number: just the recipe', () => {
    const t = only(T.start([], 'a', 'Blind bake', 60, T0, { recipeId: 'r1', recipeName: 'Leek & bacon quiche' }));
    expect(alertContent(t).body).toBe('Leek & bacon quiche');
  });

  it('US3: the follow-up', () => {
    expect(followUpContent(blindBake())).toEqual({ title: 'Still waiting: Blind bake', body: 'Done 2 minutes ago.' });
  });
});

describe('alertChanges (FR-001, SC-002)', () => {
  const one = [blindBake()];
  it('start, resume, ±1 min and set schedule; pause, stop and dismiss cancel', () => {
    expect(alertChanges([], one).schedule.map((t) => t.id)).toEqual(['a']);
    const paused = T.pause(one, 'a', T0 + 1000);
    expect(alertChanges(one, paused)).toEqual({ schedule: [], cancel: ['a'] });
    expect(alertChanges(paused, T.resume(paused, 'a', T0 + 5000)).schedule).toHaveLength(1);
    expect(alertChanges(one, T.add(one, 'a', 60, T0)).schedule).toHaveLength(1);
    expect(alertChanges(one, T.add(one, 'a', -60, T0)).schedule).toHaveLength(1);
    expect(alertChanges(one, T.set(one, 'a', 300, T0)).schedule).toHaveLength(1);
    expect(alertChanges(one, T.stop(one, 'a'))).toEqual({ schedule: [], cancel: ['a'] });
    const done = T.settle(one, T0 + 13 * 60_000).timers;
    expect(alertChanges(done, T.dismiss(done, 'a'))).toEqual({ schedule: [], cancel: ['a'] });
  });

  it('a timer that ends keeps its follow-up; a paused one that goes has nothing to cancel', () => {
    expect(alertChanges(one, T.settle(one, T0 + 13 * 60_000).timers)).toEqual({ schedule: [], cancel: [] });
    const paused = T.pause(one, 'a', T0);
    expect(alertChanges(paused, T.stop(paused, 'a'))).toEqual({ schedule: [], cancel: [] });
    expect(alertChanges(one, one)).toEqual({ schedule: [], cancel: [] });
  });
});

describe('createTimerAlerts', () => {
  it('US1 and US3: the alert at endsAt and one follow-up 2 minutes later, both for Timers', async () => {
    const phone = fakePhone();
    const { alerts } = alertsFor(phone);
    const t = blindBake();
    await alerts.schedule(t);
    const data = { kind: 'timer_done', route: '/timers', timerId: 'a', userId: 'u1' };
    expect(phone.at.get('timer:a')).toEqual({ at: t.endsAt, title: 'Blind bake is done', body: 'Leek & bacon quiche · step 3', data });
    expect(phone.at.get('timer:a:again')).toEqual({ at: endOf(t) + FOLLOW_UP_MS, title: 'Still waiting: Blind bake', body: 'Done 2 minutes ago.', data });
    expect(phone.at.size).toBe(2);
  });

  it('two timers ending together: two alerts', async () => {
    const phone = fakePhone();
    const { alerts } = alertsFor(phone);
    const both = T.start(T.start([], 'a', 'Blind bake', 600, T0), 'b', 'Soften leeks', 600, T0);
    for (const t of both) await alerts.schedule(t);
    expect([...phone.at.keys()].sort()).toEqual(['timer:a', 'timer:a:again', 'timer:b', 'timer:b:again']);
  });

  it('switched off or not allowed: nothing is scheduled, and reconcile clears what was', async () => {
    const phone = fakePhone();
    await alertsFor(phone).alerts.schedule(blindBake());
    const { alerts } = alertsFor(phone, { enabled: false });
    await alerts.schedule(blindBake());
    await alerts.reconcile([blindBake()]);
    expect(phone.at.size).toBe(0);
  });

  it('cancel removes both, waiting or shown', async () => {
    const phone = fakePhone();
    const { alerts } = alertsFor(phone);
    await alerts.schedule(blindBake());
    await alerts.cancel(['a']);
    expect(phone.remove).toHaveBeenCalledWith(['timer:a', 'timer:a:again']);
    expect(phone.at.size).toBe(0);
  });

  it('reconcile keeps a done timer’s follow-up, clears alerts of timers that are gone, and reschedules running ones', async () => {
    const phone = fakePhone();
    let now = T0;
    const { alerts } = alertsFor(phone, { now: () => now });
    const t = blindBake();
    await alerts.schedule(t);
    await alerts.schedule({ ...t, id: 'gone' });
    now = endOf(t) + 1000;
    const done = T.settle([t], now).timers;
    await alerts.reconcile(done);
    expect([...phone.at.keys()].sort()).toEqual(['timer:a', 'timer:a:again']);
    phone.at.clear();
    now = T0;
    await alerts.reconcile([t]);
    expect([...phone.at.keys()].sort()).toEqual(['timer:a', 'timer:a:again']);
  });

  it('US3: a follow-up that arrived is counted once; a cancelled one never', async () => {
    const phone = fakePhone();
    let now = T0;
    const { alerts, tracker } = alertsFor(phone, { now: () => now });
    const t = blindBake();
    const other = { ...t, id: 'b' };
    await alerts.schedule(t);
    await alerts.schedule(other);
    await alerts.cancel(['b']);
    now = endOf(t) + FOLLOW_UP_MS + 1;
    const done = T.settle([t], now).timers;
    await alerts.reconcile(done);
    await alerts.reconcile(done);
    expect(tracker.track.mock.calls.filter(([e]) => e === 'timer_alert_followup_sent')).toHaveLength(1);
  });

  it('a follow-up not yet due is not counted', async () => {
    const phone = fakePhone();
    let now = T0;
    const { alerts, tracker } = alertsFor(phone, { now: () => now });
    const t = blindBake();
    await alerts.schedule(t);
    now = endOf(t) + 1000;
    await alerts.reconcile(T.settle([t], now).timers);
    expect(tracker.track).not.toHaveBeenCalled();
  });

  it('cancelAll (sign-out) clears every timer alert, and only ours', async () => {
    const phone = fakePhone();
    const { alerts } = alertsFor(phone);
    await alerts.schedule(blindBake());
    phone.at.set('reminder-1', { at: T0, title: '', body: '', data: null });
    await alerts.cancelAll();
    expect([...phone.at.keys()]).toEqual(['reminder-1']);
  });

  it('a phone that refuses never breaks the timer', async () => {
    const phone = fakePhone();
    phone.scheduleAt = vi.fn(async () => {
      throw new Error('not allowed');
    });
    const { alerts } = alertsFor(phone);
    await expect(alerts.schedule(blindBake())).resolves.toBeUndefined();
  });
});

describe('reconcile before and after the switches are known', () => {
  it('a follow-up removed because alerts are off is never counted as sent', async () => {
    const phone = fakePhone();
    let now = T0;
    const storage = memoryStorage();
    const tracker = fakeTracker();
    const make = (enabled: boolean) => createTimerAlerts({ local: phone, userId: 'u1', storage, tracker, enabled, now: () => now });
    const t = blindBake();
    await make(true).schedule(t);
    await make(false).reconcile([t]);
    now = endOf(t) + FOLLOW_UP_MS + 1;
    await make(true).reconcile(T.settle([t], now).timers);
    expect(tracker.track).not.toHaveBeenCalled();
  });
});

describe('no waiting (Gabriel: lock the phone right after the tap, the alert still comes on time)', () => {
  /** Like the iPhone: each request applies in the order it was made, and answers later. */
  function slowPhone() {
    const at = new Map<string, number>();
    const calls: string[] = [];
    const answers: (() => void)[] = [];
    const later = () => new Promise<void>((r) => answers.push(r));
    const local: LocalNotifications = {
      scheduleAt: (id, when) => (calls.push(`${id} ${(when - T0) / 1000}`), at.set(id, when), later()),
      remove: (ids) => (calls.push(`remove ${ids.join(' ')}`), ids.forEach((id) => at.delete(id)), later()),
      ids: () => later().then(() => [...at.keys()]),
    };
    return { local, at, calls, answerAll: () => answers.splice(0).forEach((a) => a()) };
  }

  it('both requests reach the iPhone in the same moment as the tap, through the store', () => {
    const phone = slowPhone();
    const alerts = createTimerAlerts({ local: phone.local, userId: 'u1', storage: memoryStorage(), tracker: fakeTracker(), enabled: true, now: () => T0 });
    const store = createTimerStore({ storage: memoryStorage(), userId: 'u1', tracker: fakeTracker(), alerts, now: () => T0 });
    const id = store.start('Blind bake', 60, 'step');
    // Nothing awaited yet: already asked.
    expect(phone.calls).toEqual([`timer:${id} 60`, `timer:${id}:again 180`]);
    store.destroy();
  });

  it('quick −1 taps and a pause apply in order, while the iPhone is still answering', () => {
    const phone = slowPhone();
    const { alerts } = alertsFor(phone.local);
    let t = blindBake();
    void alerts.schedule(t);
    for (const left of [660, 600, 540, 60]) {
      t = { ...t, endsAt: T0 + left * 1000 };
      void alerts.schedule(t);
    }
    expect(phone.at.get('timer:a')).toBe(T0 + 60_000);
    expect(phone.at.get('timer:a:again')).toBe(T0 + 60_000 + FOLLOW_UP_MS);
    void alerts.cancel(['a']);
    expect(phone.at.size).toBe(0);
  });

  it('a re-check under way leaves a timer started meanwhile alone', async () => {
    const phone = slowPhone();
    const { alerts } = alertsFor(phone.local);
    phone.at.set('timer:old', T0);
    const checking = alerts.reconcile([]);
    await Promise.resolve();
    const t = blindBake();
    void alerts.schedule(t);
    await vi.waitFor(() => {
      phone.answerAll();
      expect(phone.calls).toContain('remove timer:old');
    });
    phone.answerAll();
    await checking;
    expect([...phone.at.keys()].sort()).toEqual(['timer:a', 'timer:a:again']);
  });
});

describe('whole seconds (iOS drops the fraction)', () => {
  it('rounds up so the alert never comes before 0:00, and skips one under a second away', async () => {
    const phone = fakePhone();
    const { alerts } = alertsFor(phone);
    await alerts.schedule({ ...blindBake(), endsAt: T0 + 60_400 });
    expect(phone.at.get('timer:a')?.at).toBe(T0 + 61_000);
    expect(phone.at.get('timer:a:again')?.at).toBe(T0 + 61_000 + FOLLOW_UP_MS);
    // At 0.7 s past a second, ending 0.2 s later: iOS would get under a second.
    const late = alertsFor(phone, { now: () => T0 + 700 }).alerts;
    phone.at.clear();
    await late.schedule({ ...blindBake(), endsAt: T0 + 900 });
    expect(phone.at.size).toBe(0);
  });
});
