// Spec 061: on iOS 26, a timer's done alert is an alarm that rings until stopped (US1), with no
// follow-up; the app never hides it (US3); its "+1 min" and "Stop" reach the timers (US2).
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { alarmNotifications, useAlarmPermission, withAlarmCleanup, type AlarmPermission, type TimerAlarm, type TimerAlarmsNative } from './timer-alarms';
import { createTimerAlerts, type LocalNotifications } from './timer-alerts';
import { createTimerStore } from './timer-store';
import type { LiveActionRecord } from './live-activity';
import type { Timer } from './timers';
import { fakeTracker } from '../test/fakes';

const T0 = 1_760_000_000_000;
const USER = '0b6c3c3e-8d1a-4c55-9f0e-6a1d2b3c4d5e';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

function memoryStorage() {
  const data = new Map<string, string>();
  return { data, getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => void data.set(k, v), removeItem: async (k: string) => void data.delete(k) };
}

/** The phone: its notifications and its alarms. */
function fakePhone() {
  const notified = new Map<string, number>();
  const rung = new Map<string, { at: number; alarm: TimerAlarm }>();
  const notifications: LocalNotifications = {
    scheduleAt: vi.fn(async (id: string, at: number) => void notified.set(id, at)),
    remove: vi.fn(async (ids: readonly string[]) => ids.forEach((id) => notified.delete(id))),
    ids: async () => [...notified.keys()],
  };
  const alarms: TimerAlarmsNative = {
    permission: () => 'authorized',
    request: async () => 'authorized',
    schedule: vi.fn(async (alarm: TimerAlarm, at: number) => (rung.set(alarm.alertId, { at, alarm }), true)),
    cancel: vi.fn(async (ids: readonly string[]) => ids.forEach((id) => rung.delete(id))),
    ids: async () => [...rung.keys()],
    clear: vi.fn(async () => void rung.clear()),
  };
  return { notified, rung, notifications, alarms, local: alarmNotifications(notifications, alarms) };
}

function setup() {
  const phone = fakePhone();
  const tracker = fakeTracker();
  const storage = memoryStorage();
  const alerts = createTimerAlerts({ local: phone.local, userId: USER, storage, tracker, enabled: true, alarms: true });
  return { phone, tracker, storage, alerts };
}

const running = (id: string, endsAt: number): Timer => ({ id, label: 'Blind bake', totalSeconds: 600, state: 'running', endsAt, recipeName: 'Leek & bacon quiche', stepNumber: 3 });

describe('alarms in place of notifications (US1, FR-001)', () => {
  it('one alarm at endsAt, with its words and whose it is; no follow-up and no notification', async () => {
    const { phone, alerts } = setup();
    await alerts.schedule(running('a-1', T0 + 600_000));
    expect(alerts.rings).toBe(true);
    expect([...phone.rung.keys()]).toEqual(['timer:a-1']);
    expect(phone.rung.get('timer:a-1')).toEqual({
      at: T0 + 600_000,
      alarm: {
        alertId: 'timer:a-1',
        timerId: 'a-1',
        owner: USER,
        title: 'Blind bake is done',
        subtitle: 'Leek & bacon quiche · step 3',
        sound: 'kitchen-bell.caf',
        addMinute: '+1 min',
        stop: 'Stop',
      },
    });
    expect(phone.notified.size).toBe(0);
  });

  it('a cancel stops the alarm, and any notification left from before', async () => {
    const { phone, alerts } = setup();
    phone.notified.set('timer:a-1:again', T0);
    await alerts.schedule(running('a-1', T0 + 600_000));
    await alerts.cancel(['a-1']);
    expect(phone.rung.size).toBe(0);
    expect(phone.notified.size).toBe(0);
  });

  it('reconcile keeps a done timer’s alarm ringing, and turns notifications from before into alarms', async () => {
    const { phone, alerts } = setup();
    phone.rung.set('timer:d-1', { at: T0 - 1000, alarm: {} as TimerAlarm });
    // Started before iOS's question was answered: spec 047's two notifications.
    phone.notified.set('timer:a-1', T0 + 600_000);
    phone.notified.set('timer:a-1:again', T0 + 720_000);
    phone.notified.set('timer:d-1:again', T0 + 60_000);
    // Not a timer's: left alone.
    phone.notified.set('reminder:r-1', T0);
    const done: Timer = { id: 'd-1', label: 'Pasta water', totalSeconds: 60, state: 'done', stoppedAt: T0 - 1000 };
    await alerts.reconcile([done, running('a-1', T0 + 600_000)]);
    expect([...phone.rung.keys()].sort()).toEqual(['timer:a-1', 'timer:d-1']);
    expect(phone.rung.get('timer:a-1')?.at).toBe(T0 + 600_000);
    expect([...phone.notified.keys()]).toEqual(['reminder:r-1']);
  });

  it('sign-out with alarms not in use still stops every alarm', async () => {
    const phone = fakePhone();
    phone.rung.set('timer:a-1', { at: T0 + 1000, alarm: {} as TimerAlarm });
    phone.notified.set('timer:b-2', T0 + 1000);
    const local = withAlarmCleanup(phone.notifications, phone.alarms);
    await createTimerAlerts({ local, userId: '', storage: memoryStorage(), tracker: fakeTracker(), enabled: false }).cancelAll();
    expect(phone.rung.size).toBe(0);
    expect(phone.notified.size).toBe(0);
  });

  it('refused by iOS: the timer keeps working, and no follow-up is ever counted', async () => {
    const { phone, alerts, tracker } = setup();
    vi.mocked(phone.alarms.schedule).mockResolvedValueOnce(false);
    await expect(alerts.schedule(running('a-1', T0 + 600_000))).resolves.toBeUndefined();
    vi.setSystemTime(T0 + 3_600_000);
    await alerts.reconcile([]);
    expect(tracker.track).not.toHaveBeenCalledWith('timer_alert_followup_sent', {});
  });
});

describe('the app never hides a ringing alarm (US3)', () => {
  it('ending on screen and opening Timers leave the alarm alone; the in-app toast still shows', async () => {
    const { phone, alerts } = setup();
    const store = createTimerStore({ storage: memoryStorage(), userId: USER, tracker: fakeTracker(), alerts, isForeground: () => true });
    const finished = vi.fn();
    store.onFinished(finished);
    const id = store.start('Blind bake', 60, 'step');
    await act(async () => void vi.advanceTimersByTime(61_000));
    expect(finished).toHaveBeenCalledTimes(1);
    store.seenDone();
    await act(async () => void vi.advanceTimersByTime(0));
    expect(phone.rung.has(`timer:${id}`)).toBe(true);
    // Dismissed in the app: it stops.
    store.dismiss(id);
    await act(async () => void vi.advanceTimersByTime(0));
    expect(phone.rung.size).toBe(0);
    store.destroy();
  });
});

describe('"+1 min" and "Stop" on the alarm (US2, FR-003)', () => {
  function fakeLive() {
    const taps: LiveActionRecord[] = [];
    return { taps, sync: vi.fn(), takeActions: vi.fn(async () => taps.splice(0)), onAction: vi.fn(() => () => undefined), dispose: vi.fn() };
  }

  it('apply to the timer at their own time, counted as the alert’s actions', async () => {
    const live = fakeLive();
    const tracker = fakeTracker();
    const store = createTimerStore({ storage: memoryStorage(), userId: USER, tracker, live, isForeground: () => false });
    await store.load();
    const id = store.start('Blind bake', 60, 'step');
    vi.setSystemTime(T0 + 70_000);
    live.taps.push({ owner: USER, timerId: id, action: 'add_minute', at: T0 + 65_000, source: 'alarm' });
    await store.applyLiveActions();
    const [timer] = store.getSnapshot().timers;
    expect(timer).toMatchObject({ state: 'running', endsAt: T0 + 125_000 });
    expect(tracker.track).toHaveBeenCalledWith('timer_alert_action', { action: 'add_minute' });
    live.taps.push({ owner: USER, timerId: id, action: 'dismiss', at: T0 + 130_000, source: 'alarm' });
    vi.setSystemTime(T0 + 131_000);
    await store.applyLiveActions();
    expect(store.getSnapshot().timers).toEqual([]);
    expect(tracker.track).toHaveBeenCalledWith('timer_alert_action', { action: 'stop' });
    expect(tracker.track).not.toHaveBeenCalledWith('timer_live_activity_action', expect.anything());
    store.destroy();
  });
});

describe('SC-002 through the timer store: no alarm ever rings for a paused or stopped timer', () => {
  it('pause, stop and clear cancel it; resume, ±1 min and set move it, in order', async () => {
    const { phone, alerts } = setup();
    const store = createTimerStore({ storage: memoryStorage(), userId: USER, tracker: fakeTracker(), alerts, isForeground: () => true });
    const at = () => phone.rung.get(`timer:${id}`)?.at;
    const id = store.start('Blind bake', 600, 'step');
    await act(async () => void vi.advanceTimersByTime(0));
    expect(at()).toBe(T0 + 600_000);
    store.add(id, 60);
    store.add(id, -60);
    store.add(id, 60);
    await act(async () => void vi.advanceTimersByTime(0));
    expect(at()).toBe(T0 + 660_000);
    store.pause(id);
    await act(async () => void vi.advanceTimersByTime(0));
    expect(phone.rung.size).toBe(0);
    store.resume(id);
    store.set(id, 120);
    await act(async () => void vi.advanceTimersByTime(0));
    expect(at()).toBe(T0 + 120_000);
    store.stop(id);
    await act(async () => void vi.advanceTimersByTime(0));
    expect(phone.rung.size).toBe(0);
    store.destroy();
  });

  it('rounds up to the second, sets none under a second away, and none while "Alert when a timer ends" is off', async () => {
    const { phone, alerts } = setup();
    await alerts.schedule(running('a-1', T0 + 90_400));
    expect(phone.rung.get('timer:a-1')?.at).toBe(T0 + 91_000);
    // Rounded up to T0 + 1 s, which is then under a second away.
    vi.setSystemTime(T0 + 200);
    await alerts.schedule(running('b-2', T0 + 900));
    expect(phone.rung.has('timer:b-2')).toBe(false);
    const off = createTimerAlerts({ local: phone.local, userId: USER, storage: memoryStorage(), tracker: fakeTracker(), enabled: false, alarms: true });
    await off.schedule(running('c-3', T0 + 600_000));
    expect(phone.rung.has('timer:c-3')).toBe(false);
  });
});

describe('the alarm question (FR-002)', () => {
  it('reads the answer, asks iOS, and sends whether it was allowed', async () => {
    const tracker = fakeTracker();
    const { alarms } = fakePhone();
    let answer: 'notDetermined' | 'authorized' | 'denied' = 'notDetermined';
    const native: TimerAlarmsNative = { ...alarms, permission: () => answer, request: vi.fn(async (): Promise<AlarmPermission> => (answer = 'denied')) };
    const { result } = renderHook(() => useAlarmPermission(native, tracker));
    expect(result.current.permission).toBe('notDetermined');
    await act(async () => void (await result.current.request()));
    expect(result.current.permission).toBe('denied');
    expect(tracker.track).toHaveBeenCalledWith('timer_alarms_permission_result', { granted: false });
    native.request = vi.fn(async (): Promise<AlarmPermission> => (answer = 'authorized'));
    await act(async () => void (await result.current.request()));
    expect(tracker.track).toHaveBeenCalledWith('timer_alarms_permission_result', { granted: true });
  });

  it('none on this phone: no answer, and asking says no without a question', async () => {
    const tracker = fakeTracker();
    const { result } = renderHook(() => useAlarmPermission(null, tracker));
    expect(result.current.permission).toBeNull();
    await act(async () => expect(await result.current.request()).toBe('denied'));
    expect(tracker.track).not.toHaveBeenCalled();
  });
});
