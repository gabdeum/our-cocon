// Spec 048: the Live Activity. What the card shows for US1–US3 and the edge cases, the buttons'
// taps applied as when they were tapped (FR-004), and start / update / end / re-attach (FR-001).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyLiveAction, createLiveActivity, DONE_SHOWN_MS, endLiveActivity, liveActivityState, type LiveTimerNative } from './live-activity';
import { liveAlert } from './timer-alerts';
import type { Timer } from './timers';
import { fakeTracker } from '../test/fakes';

const T0 = 1_760_000_000_000;
const USER = '0b6c3c3e-8d1a-4c55-9f0e-6a1d2b3c4d5e';
const OTHER = '9e8d7c6b-5a49-4382-9716-0a1b2c3d4e5f';

const running = (id: string, label: string, left: number, extra: Partial<Timer> = {}): Timer => ({
  id,
  label,
  totalSeconds: 900,
  state: 'running',
  endsAt: T0 + left * 1000,
  ...extra,
});
const paused = (id: string, label: string, left: number): Timer => ({ id, label, totalSeconds: 900, state: 'paused', remainingSeconds: left, stoppedAt: T0 });
const done = (id: string, label: string, agoMs: number, extra: Partial<Timer> = {}): Timer => ({ id, label, totalSeconds: 900, state: 'done', stoppedAt: T0 - agoMs, ...extra });

const quiche = { recipeId: 'r1', stepId: 's3', recipeName: 'Leek & bacon quiche', stepNumber: 3 };
const blindBake = running('a-1', 'Blind bake', 252, quiche);
const pasta = running('a-2', 'Pasta water', 700);

describe('what the card shows', () => {
  it('US1: the most urgent timer, its step, the next one, and both buttons', () => {
    const view = liveActivityState([pasta, blindBake], T0);
    expect(view?.state).toMatchObject({
      id: 'a-1',
      state: 'running',
      label: 'Blind bake',
      endsAt: T0 + 252_000,
      totalSeconds: 900,
      others: [{ label: 'Pasta water', endsAt: T0 + 700_000 }],
      othersCount: 1,
    });
    expect(view?.state.copy).toMatchObject({
      title: 'Timers',
      count: '2 running',
      sub: 'Leek & bacon quiche · step 3',
      more: '',
      addMinute: '+1 min',
      pause: 'Pause',
      resume: 'Resume',
    });
    // The phone draws the countdown itself; the card turns done at zero with no update.
    expect(view?.staleAt).toBe(T0 + 252_000);
    expect(view?.changeAt).toBeNull();
  });

  it('US2: the island says which recipe and how many more', () => {
    expect(liveActivityState([pasta, blindBake], T0)?.state.copy.islandSub).toBe('Leek & bacon quiche · +1 more');
    expect(liveActivityState([blindBake], T0)?.state.copy.islandSub).toBe('Leek & bacon quiche · step 3');
    expect(liveActivityState([running('q-1', 'Kitchen timer', 300, { totalSeconds: 300 })], T0)?.state.copy.sub).toBe('5-minute kitchen timer');
  });

  it('more than 2 timers: the next one and "+1 more"', () => {
    const view = liveActivityState([pasta, blindBake, running('a-3', 'Rice', 1200)], T0);
    expect(view?.state.others).toEqual([{ label: 'Pasta water', endsAt: T0 + 700_000 }]);
    expect(view?.state.copy.more).toBe(' · +1 more');
    expect(view?.state.copy.count).toBe('3 running');
  });

  it('all paused: "Paused", the frozen time, "Resume", and no done date', () => {
    const view = liveActivityState([paused('a-1', 'Blind bake', 252), paused('a-2', 'Pasta water', 700)], T0);
    expect(view?.state).toMatchObject({ id: 'a-1', state: 'paused', remainingSeconds: 252, others: [{ label: 'Pasta water', remainingSeconds: 700 }] });
    expect(view?.state.endsAt).toBeUndefined();
    expect(view?.state.copy).toMatchObject({ count: '2 paused', pausedSub: 'Paused', countToggled: '1 running' });
    expect(view?.staleAt).toBeNull();
  });

  it('the counts after "Pause" and once the first one ends are ready for the phone', () => {
    const copy = liveActivityState([pasta, blindBake], T0)?.state.copy;
    expect(copy).toMatchObject({ countToggled: '1 running', countDone: '1 running', doneTitle: 'Blind bake is done' });
  });

  it('US3: a done timer stays first for 10 minutes, with the next one below, then the next shows', () => {
    const ended = done('a-1', 'Blind bake', 60_000, quiche);
    const view = liveActivityState([ended, pasta], T0);
    expect(view?.state).toMatchObject({ id: 'a-1', state: 'done', others: [{ label: 'Pasta water', endsAt: T0 + 700_000 }] });
    expect(view?.state.copy).toMatchObject({ doneTitle: 'Blind bake is done', sub: 'Leek & bacon quiche · step 3', count: '1 running', left: 'left' });
    expect(view?.changeAt).toBe(T0 - 60_000 + DONE_SHOWN_MS);
    expect(view?.staleAt).toBeNull();

    const later = liveActivityState([ended, pasta], T0 - 60_000 + DONE_SHOWN_MS);
    expect(later?.state).toMatchObject({ id: 'a-2', state: 'running' });
  });

  it('ends with nothing running or recently done (FR-001)', () => {
    expect(liveActivityState([], T0)).toBeNull();
    expect(liveActivityState([done('a-1', 'Blind bake', DONE_SHOWN_MS)], T0)).toBeNull();
  });

  it("carries the primary timer's alerts only while they're on, for the card's buttons", () => {
    const withAlerts = liveActivityState([blindBake], T0, { alertsFor: (t) => liveAlert(t, USER) })?.state.alert;
    expect(withAlerts).toEqual({
      alertId: 'timer:a-1',
      againId: 'timer:a-1:again',
      title: 'Blind bake is done',
      body: 'Leek & bacon quiche · step 3',
      againTitle: 'Still waiting: Blind bake',
      againBody: 'Done 2 minutes ago.',
      againAfterMs: 120_000,
      sound: 'kitchen-bell.caf',
      thread: 'timers',
      category: 'timer_done',
      data: { kind: 'timer_done', route: '/timers', timerId: 'a-1', userId: USER },
    });
    expect(liveActivityState([blindBake], T0)?.state.alert).toBeUndefined();
    expect(liveActivityState([done('a-1', 'Blind bake', 1000)], T0, { alertsFor: (t) => liveAlert(t, USER) })?.state.alert).toBeUndefined();
  });

  it('a tap opens the step in cooking mode, or Timers for a quick timer; "2 running" opens Timers', () => {
    const url = (p: string) => `ourcocon://${p.slice(1)}`;
    expect(liveActivityState([blindBake], T0, { url })?.state).toMatchObject({ openUrl: 'ourcocon://recipes/r1/cook?step=s3', timersUrl: 'ourcocon://timers' });
    expect(liveActivityState([pasta], T0, { url })?.state).toMatchObject({ openUrl: 'ourcocon://timers', timersUrl: 'ourcocon://timers' });
    expect(liveActivityState([pasta], T0)?.state.copy.removeMinute).toBe('−1 min');
    expect(liveActivityState([pasta], T0)?.state.minLeftSeconds).toBe(30);
  });

  it('the hidden pill changes nothing: the card reads only the timers', () => {
    expect(liveActivityState([blindBake], T0)).toEqual(liveActivityState([blindBake], T0));
  });
});

describe("the card's buttons, applied as when they were tapped (FR-004)", () => {
  const tapAt = T0 + 10_000;

  it('+1 min adds a minute to that timer and its total', () => {
    const [t] = applyLiveAction([blindBake], { timerId: 'a-1', action: 'add_minute', at: tapAt });
    expect(t).toMatchObject({ state: 'running', endsAt: T0 + 312_000, totalSeconds: 960 });
  });

  it('−1 min takes a minute off, never below 0:30 (as in the app)', () => {
    const [t] = applyLiveAction([blindBake], { timerId: 'a-1', action: 'remove_minute', at: T0 });
    expect(t).toMatchObject({ endsAt: T0 + 192_000, totalSeconds: 840 });
    const [short] = applyLiveAction([running('a-1', 'Blind bake', 50)], { timerId: 'a-1', action: 'remove_minute', at: T0 });
    expect(short?.endsAt).toBe(T0 + 30_000);
  });

  it('pause keeps the time left at the tap, resume counts it from the tap', () => {
    const afterPause = applyLiveAction([blindBake], { timerId: 'a-1', action: 'pause', at: tapAt });
    expect(afterPause[0]).toMatchObject({ state: 'paused', remainingSeconds: 242 });
    const [r] = applyLiveAction(afterPause, { timerId: 'a-1', action: 'resume', at: T0 + 60_000 });
    expect(r).toMatchObject({ state: 'running', endsAt: T0 + 60_000 + 242_000 });
  });

  it('a timer marked done since, but still counting at the tap, takes the tap', () => {
    // Tapped 2 s before its end; the app only ran a minute later and had marked it done.
    const ended: Timer = { ...done('a-1', 'Blind bake', 0, quiche), stoppedAt: T0 };
    const [t] = applyLiveAction([ended], { timerId: 'a-1', action: 'add_minute', at: T0 - 2000 });
    expect(t).toMatchObject({ state: 'running', endsAt: T0 + 60_000, recipeName: 'Leek & bacon quiche' });
    expect(t?.stoppedAt).toBeUndefined();
  });

  it('leaves other timers alone, and a gone timer is nothing', () => {
    const out = applyLiveAction([blindBake, pasta], { timerId: 'a-1', action: 'pause', at: tapAt });
    expect(out[1]).toBe(pasta);
    expect(applyLiveAction([pasta], { timerId: 'a-1', action: 'add_minute', at: tapAt })).toEqual([pasta]);
  });
});

describe('the Live Activity on the phone (FR-001)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(T0);
  });
  afterEach(() => vi.useRealTimers());

  function fakeNative(current: { owner: string } | null = null) {
    let showing = current;
    const taps: unknown[] = [];
    const native = {
      enabled: vi.fn(() => true),
      current: vi.fn(async () => showing),
      start: vi.fn(async (owner: string) => {
        showing = { owner };
        return true;
      }),
      update: vi.fn(async (_owner: string, _state: unknown, _staleAt: number | null) => showing !== null),
      end: vi.fn(async () => {
        showing = null;
        taps.length = 0;
      }),
      takeActions: vi.fn(async () => taps.splice(0)),
      onAction: vi.fn(() => () => undefined),
    } satisfies LiveTimerNative;
    return { native, taps };
  }
  const flushAll = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  const setup = (opts: { current?: { owner: string } | null; enabled?: boolean; foreground?: boolean } = {}) => {
    const { native, taps } = fakeNative(opts.current ?? null);
    const tracker = fakeTracker();
    let foreground = opts.foreground ?? true;
    const live = createLiveActivity({ native, userId: USER, tracker, enabled: opts.enabled ?? true, isForeground: () => foreground });
    return { native, taps, tracker, live, background: () => void (foreground = false) };
  };

  it('starts with the first timer, updates on each change, ends when nothing is left', async () => {
    const { native, tracker, live } = setup();
    live.sync([blindBake]);
    await flushAll();
    expect(native.start).toHaveBeenCalledWith(USER, expect.objectContaining({ id: 'a-1', label: 'Blind bake' }), T0 + 252_000);
    expect(tracker.track).toHaveBeenCalledWith('timer_live_activity_started', { timer_count: 1 });

    live.sync([blindBake, pasta]);
    await flushAll();
    expect(native.update).toHaveBeenCalledWith(USER, expect.objectContaining({ othersCount: 1 }), T0 + 252_000);
    expect(native.start).toHaveBeenCalledTimes(1);

    // The same card again: nothing sent.
    live.sync([blindBake, pasta]);
    await flushAll();
    expect(native.update).toHaveBeenCalledTimes(1);

    live.sync([]);
    await flushAll();
    expect(native.end).toHaveBeenCalledTimes(1);
  });

  it('re-attaches to its own card after a relaunch (no second start)', async () => {
    const { native, tracker, live } = setup({ current: { owner: USER } });
    live.sync([blindBake]);
    await flushAll();
    expect(native.start).not.toHaveBeenCalled();
    expect(native.update).toHaveBeenCalledTimes(1);
    expect(tracker.track).not.toHaveBeenCalled();
  });

  it("ends someone else's card before showing this person's", async () => {
    const { native, live } = setup({ current: { owner: OTHER } });
    live.sync([blindBake]);
    await flushAll();
    expect(native.end).toHaveBeenCalledTimes(1);
    expect(native.start).toHaveBeenCalledWith(USER, expect.anything(), expect.anything());
  });

  it('"Timer on Lock Screen" off: no card, and one already showing ends', async () => {
    const { native, live } = setup({ current: { owner: USER }, enabled: false });
    live.sync([blindBake]);
    await flushAll();
    expect(native.end).toHaveBeenCalledTimes(1);
    expect(native.start).not.toHaveBeenCalled();
  });

  it('Live Activities off in iPhone Settings, or the app not on screen: nothing starts', async () => {
    const off = setup();
    off.native.enabled.mockReturnValue(false);
    off.live.sync([blindBake]);
    await flushAll();
    expect(off.native.start).not.toHaveBeenCalled();

    const away = setup();
    away.background();
    away.live.sync([blindBake]);
    await flushAll();
    expect(away.native.start).not.toHaveBeenCalled();
  });

  it('starts a new one when the last one is gone (8 hours, or swiped away)', async () => {
    const { native, live } = setup();
    live.sync([blindBake]);
    await flushAll();
    native.update.mockResolvedValueOnce(false);
    live.sync([blindBake, pasta]);
    await flushAll();
    expect(native.start).toHaveBeenCalledTimes(2);
  });

  it('after sign-out, a sync already under way never brings the card back (security review)', async () => {
    const { native, live } = setup();
    let answer: (v: null) => void = () => undefined;
    native.current.mockImplementationOnce(() => new Promise((r) => (answer = r)));
    live.sync([blindBake]);
    await flushAll();
    await endLiveActivity(native);
    answer(null);
    await flushAll();
    live.sync([blindBake]);
    await flushAll();
    expect(native.start).not.toHaveBeenCalled();
  });

  it('the system refusing to start it changes nothing else', async () => {
    const { native, tracker, live } = setup();
    native.start.mockResolvedValueOnce(false);
    live.sync([blindBake]);
    await flushAll();
    expect(tracker.track).not.toHaveBeenCalled();
  });

  it('moves on by itself 10 minutes after a timer is done', async () => {
    const { native, live } = setup();
    live.sync([done('a-1', 'Blind bake', 0), pasta]);
    await flushAll();
    expect(native.start).toHaveBeenCalledWith(USER, expect.objectContaining({ id: 'a-1', state: 'done' }), null);
    await vi.advanceTimersByTimeAsync(DONE_SHOWN_MS);
    await flushAll();
    expect(native.update).toHaveBeenLastCalledWith(USER, expect.objectContaining({ id: 'a-2', state: 'running' }), T0 + 700_000);
  });

  it("reads only this person's taps, and nothing that isn't one", async () => {
    const { taps, live } = setup();
    taps.push(
      { owner: USER, timerId: 'a-1', action: 'add_minute', at: T0 },
      { owner: OTHER, timerId: 'a-1', action: 'pause', at: T0 },
      { owner: USER, timerId: 'a-1', action: 'explode', at: T0 },
      'junk',
    );
    expect(await live.takeActions()).toEqual([{ owner: USER, timerId: 'a-1', action: 'add_minute', at: T0 }]);
    expect(await live.takeActions()).toEqual([]);
  });
});

it('the Swift data is the same file in the app module and the widget (ActivityKit matches them by name)', () => {
  const root = join(import.meta.dirname, '..');
  const module = readFileSync(join(root, 'modules/live-timer/ios/TimerActivityAttributes.swift'), 'utf8');
  const widget = readFileSync(join(root, 'targets/timer-activity/_shared/TimerActivityAttributes.swift'), 'utf8');
  expect(module).toBe(widget);
});
