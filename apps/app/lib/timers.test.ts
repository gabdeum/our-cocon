import { describe, expect, it } from 'vitest';
import { add, clock, dismiss, mostUrgent, parseStored, pause, remaining, resume, set, settle, start, stop, type Timer } from './timers';

const T0 = 1_760_000_000_000;
const sec = (s: number) => s * 1000;
const one = (timers: Timer[]): Timer => {
  const [t] = timers;
  if (!t) throw new Error('no timer');
  return t;
};
const running = (left: number) => start([], 't1', 'Blind bake', left, T0);
const show = (timers: Timer[], now = T0) => clock(remaining(one(timers), now));

describe('timers (spec 010)', () => {
  it('counts from endsAt, rounding up to the shown second', () => {
    const ts = running(12 * 60);
    expect(show(ts)).toBe('12:00');
    expect(show(ts, T0 + 400)).toBe('12:00');
    expect(show(ts, T0 + 1000)).toBe('11:59');
    expect(show(ts, T0 + sec(12 * 60) + 5000)).toBe('00:00');
  });

  it('SC-001: no drift over 60 minutes, because nothing counts down', () => {
    const ts = running(90 * 60);
    expect(remaining(one(ts), T0 + sec(60 * 60))).toBe(30 * 60);
  });

  it('US2.1: 05:10 → +1 → 06:10, still running', () => {
    const ts = add(running(310), 't1', 60, T0);
    expect(show(ts)).toBe('06:10');
    expect(one(ts).state).toBe('running');
    expect(one(ts).totalSeconds).toBe(370);
  });

  it('US2.2: −1 stops at 00:30 and never adds time', () => {
    expect(show(add(running(50), 't1', -60, T0))).toBe('00:30');
    expect(show(add(running(20), 't1', -60, T0))).toBe('00:20');
    expect(show(add(running(300), 't1', -60, T0))).toBe('04:00');
  });

  it('US2.3: Set to 15 min starts over with the same state; a done timer runs again', () => {
    const run = set(running(310), 't1', 900, T0);
    expect(show(run)).toBe('15:00');
    expect(one(run)).toMatchObject({ state: 'running', totalSeconds: 900 });

    const held = set(pause(running(310), 't1', T0), 't1', 900, T0);
    expect(one(held)).toMatchObject({ state: 'paused', remainingSeconds: 900, totalSeconds: 900 });

    const done = settle(running(60), T0 + sec(61)).timers;
    expect(one(set(done, 't1', 900, T0)).state).toBe('running');
  });

  it('pauses and resumes with the time that was left', () => {
    const p = pause(running(600), 't1', T0 + sec(100));
    expect(one(p)).toMatchObject({ state: 'paused', remainingSeconds: 500 });
    expect(show(p, T0 + sec(9999))).toBe('08:20');
    const r = resume(p, 't1', T0 + sec(200));
    expect(show(r, T0 + sec(200))).toBe('08:20');
    expect(show(add(p, 't1', -60, T0), T0)).toBe('07:20');
  });

  it('settles a timer at zero to done, once', () => {
    const ts = start(running(60), 't2', 'Soften leeks', 30, T0);
    const first = settle(ts, T0 + sec(60));
    expect(first.finished.map((t) => t.label)).toEqual(['Soften leeks', 'Blind bake']);
    expect(first.timers.every((t) => t.state === 'done')).toBe(true);
    expect(settle(first.timers, T0 + sec(120)).finished).toEqual([]);
  });

  it('+1 on a done timer runs it for one more minute', () => {
    const done = settle(running(60), T0 + sec(60)).timers;
    const again = add(done, 't1', 60, T0 + sec(60));
    expect(one(again).state).toBe('running');
    expect(show(again, T0 + sec(60))).toBe('01:00');
    expect(add(done, 't1', -60, T0)).toEqual(done);
  });

  it('stop and dismiss take the timer away', () => {
    expect(stop(running(60), 't1')).toEqual([]);
    expect(dismiss(running(60), 't1')).toEqual([]);
  });

  it('keeps where a step timer came from', () => {
    const ts = start([], 't1', 'Blind bake', 720, T0, { recipeId: 'r1', stepId: 's2' });
    expect(one(pause(ts, 't1', T0))).toMatchObject({ recipeId: 'r1', stepId: 's2' });
    expect(one(settle(ts, T0 + sec(720)).timers)).toMatchObject({ recipeId: 'r1', stepId: 's2', state: 'done' });
  });

  it('FR-004: most urgent is the running timer with least left, else the paused one', () => {
    let ts = start([], 'a', 'A', 600, T0);
    ts = start(ts, 'b', 'B', 300, T0);
    ts = start(ts, 'c', 'C', 100, T0);
    ts = pause(ts, 'c', T0);
    expect(mostUrgent(ts, T0)?.id).toBe('b');
    ts = pause(pause(ts, 'a', T0), 'b', T0);
    expect(mostUrgent(ts, T0)?.id).toBe('c');
    expect(mostUrgent(settle(start([], 'd', 'D', 1, T0), T0 + sec(2)).timers, T0)).toBeNull();
  });

  it('reloads valid stored timers and drops anything else', () => {
    const ts = running(60);
    const back = parseStored(JSON.parse(JSON.stringify(ts)));
    expect(back).toEqual(ts);
    expect(parseStored('nope')).toEqual([]);
    expect(parseStored([{ id: 'x', state: 'running' }, { id: 'y', label: 'Y', totalSeconds: 60, state: 'running' }])).toEqual([]);
  });

  it('a timer that ended while the app was closed comes back done', () => {
    const back = parseStored(JSON.parse(JSON.stringify(running(60))));
    expect(one(settle(back, T0 + sec(3600)).timers).state).toBe('done');
  });
});
