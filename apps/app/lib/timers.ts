import { z } from 'zod';
import { timerClock } from './recipe-view';

/**
 * Timers (spec 010): personal, on this device only. Time always comes from `endsAt`, never from
 * counting down, so a sleeping tab or phone is still right when it wakes (FR-003, SC-001).
 * Every function takes `now` (ms) and returns a new list; nothing here holds a clock.
 */
export const TimerSchema = z.object({
  id: z.string().min(1).max(64),
  /** "Blind bake", "Kitchen timer". Stays on the device; never sent to analytics. */
  label: z.string().max(200),
  recipeId: z.string().max(64).optional(),
  stepId: z.string().max(64).optional(),
  /** The recipe's name when it started, for the Timers screen (spec 011). Stays on the device too. */
  recipeName: z.string().max(200).optional(),
  totalSeconds: z.int().min(1).max(24 * 3600),
  state: z.enum(['running', 'paused', 'done']),
  /** Set while running. */
  endsAt: z.number().optional(),
  /** Set while paused. */
  remainingSeconds: z.int().min(0).max(24 * 3600).optional(),
});
export type Timer = z.infer<typeof TimerSchema>;

/** −1 never takes a timer below this (StepCard README › Rules). */
export const MIN_REDUCED_SECONDS = 30;
export const MINUTE = 60;
/** The quick kitchen timer (FR-002). */
export const QUICK_SECONDS = 5 * MINUTE;
const MAX_SECONDS = 24 * 3600;

export const clock = timerClock;

/** Seconds left, rounded up so 11:59.4 reads 12:00 until a whole second has passed. */
export function remaining(t: Timer, now: number): number {
  if (t.state === 'done') return 0;
  if (t.state === 'paused') return t.remainingSeconds ?? 0;
  return Math.max(0, Math.ceil(((t.endsAt ?? now) - now) / 1000));
}

export interface TimerOrigin {
  recipeId?: string;
  stepId?: string;
  recipeName?: string;
}

export function start(timers: readonly Timer[], id: string, label: string, seconds: number, now: number, origin: TimerOrigin = {}): Timer[] {
  const total = clampSeconds(seconds);
  const timer: Timer = { id, label, ...origin, totalSeconds: total, state: 'running', endsAt: now + total * 1000 };
  return [...timers, timer];
}

export function pause(timers: readonly Timer[], id: string, now: number): Timer[] {
  return update(timers, id, (t) => (t.state === 'running' ? paused(t, remaining(t, now)) : t));
}

export function resume(timers: readonly Timer[], id: string, now: number): Timer[] {
  return update(timers, id, (t) => (t.state === 'paused' ? running(t, t.remainingSeconds ?? 0, now) : t));
}

/**
 * ±1 minute (FR-002), even while running. Reducing stops at 0:30 and never adds time: 0:50 → 0:30,
 * 0:20 stays 0:20. Adding to a done timer runs it again ("Add 1 more minute", spec 011).
 */
export function add(timers: readonly Timer[], id: string, deltaSeconds: number, now: number): Timer[] {
  return update(timers, id, (t) => {
    if (t.state === 'done') return deltaSeconds > 0 ? running({ ...t, totalSeconds: adjusted(0, deltaSeconds) }, adjusted(0, deltaSeconds), now) : t;
    const left = remaining(t, now);
    const next = adjusted(left, deltaSeconds);
    if (next === left) return t;
    return withLeft({ ...t, totalSeconds: clampSeconds(Math.max(next, t.totalSeconds + (next - left))) }, next, now);
  });
}

/** The ±1 rule on a number of seconds, also for a step's time before its timer starts. */
export function adjusted(seconds: number, deltaSeconds: number): number {
  if (deltaSeconds >= 0) return clampSeconds(seconds + deltaSeconds);
  if (seconds <= MIN_REDUCED_SECONDS) return seconds;
  return Math.max(MIN_REDUCED_SECONDS, seconds + deltaSeconds);
}

/** "Set to 15 min" (FR-002): starts over at that time with the same running state; done runs again. */
export function set(timers: readonly Timer[], id: string, seconds: number, now: number): Timer[] {
  const s = clampSeconds(seconds);
  return update(timers, id, (t) => (t.state === 'paused' ? paused({ ...t, totalSeconds: s }, s) : running({ ...t, totalSeconds: s }, s, now)));
}

/** Stop (while counting) and Dismiss (once done) both take the timer away. */
export function remove(timers: readonly Timer[], id: string): Timer[] {
  return timers.filter((t) => t.id !== id);
}
export const stop = remove;
export const dismiss = remove;

/** Running timers whose time is up become done; `finished` lists them, in end order. */
export function settle(timers: readonly Timer[], now: number): { timers: Timer[]; finished: Timer[] } {
  const ended = timers.filter((t) => t.state === 'running' && remaining(t, now) === 0).sort((a, b) => (a.endsAt ?? 0) - (b.endsAt ?? 0));
  const done = (t: Timer): Timer => ({ id: t.id, label: t.label, ...origin(t), totalSeconds: t.totalSeconds, state: 'done' });
  return { timers: timers.map((t) => (ended.includes(t) ? done(t) : t)), finished: ended.map(done) };
}

/** FR-004: the running timer with the least time left; otherwise the paused one with the least left. */
export function mostUrgent(timers: readonly Timer[], now: number): Timer | null {
  const least = (state: Timer['state']) =>
    timers.filter((t) => t.state === state).reduce<Timer | null>((best, t) => (best === null || remaining(t, now) < remaining(best, now) ? t : best), null);
  return least('running') ?? least('paused');
}

/** The pill (spec 011): the most urgent timer; once none is counting, a done one, so it shows while any exists. */
export function pillTimer(timers: readonly Timer[], now: number): Timer | null {
  return mostUrgent(timers, now) ?? timers.find((t) => t.state === 'done') ?? null;
}

/** The pill's label stops at 14 characters with an ellipsis (spec 011 › Edge cases); the clock never does. */
export const PILL_NAME_MAX = 14;
export function pillName(label: string): string {
  const chars = [...label];
  return chars.length > PILL_NAME_MAX ? `${chars.slice(0, PILL_NAME_MAX).join('').trimEnd()}…` : label;
}

/** 0–1 of the time gone, for the Timers screen's progress bar. */
export function progress(t: Timer, now: number): number {
  if (t.state === 'done') return 1;
  return Math.min(1, Math.max(0, 1 - remaining(t, now) / t.totalSeconds));
}

/** What came back from device storage: valid timers only; anything else is dropped. */
export function parseStored(raw: unknown): Timer[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const parsed = TimerSchema.safeParse(item);
    if (!parsed.success) return [];
    const t = parsed.data;
    if (t.state === 'running' && t.endsAt === undefined) return [];
    if (t.state === 'paused' && t.remainingSeconds === undefined) return [];
    return [t];
  });
}

function update(timers: readonly Timer[], id: string, f: (t: Timer) => Timer): Timer[] {
  return timers.map((t) => (t.id === id ? f(t) : t));
}

function origin(t: Timer): TimerOrigin {
  return {
    ...(t.recipeId ? { recipeId: t.recipeId } : {}),
    ...(t.stepId ? { stepId: t.stepId } : {}),
    ...(t.recipeName ? { recipeName: t.recipeName } : {}),
  };
}

function running(t: Timer, seconds: number, now: number): Timer {
  return { id: t.id, label: t.label, ...origin(t), totalSeconds: t.totalSeconds, state: 'running', endsAt: now + seconds * 1000 };
}

function paused(t: Timer, seconds: number): Timer {
  return { id: t.id, label: t.label, ...origin(t), totalSeconds: t.totalSeconds, state: 'paused', remainingSeconds: seconds };
}

/** Same state, new time left. */
function withLeft(t: Timer, seconds: number, now: number): Timer {
  return t.state === 'paused' ? paused(t, seconds) : running(t, seconds, now);
}

function clampSeconds(s: number): number {
  return Math.min(MAX_SECONDS, Math.max(1, Math.round(s)));
}
