// Spec 051: the cards' lines, the Cooked meta line, and the events Done, Cancel and Start send.
import { describe, expect, it, vi } from 'vitest';
import { alex, fakeTracker, gabriel } from '../test/fakes';
import { beginCook, cancelCook, cookedLine, daysSince, finishCook, listLine, pageCard, type CookSession } from './cook-sessions';

const now = new Date('2026-11-12T19:00:00');
const cook: CookSession = {
  id: 'c1',
  recipe_id: '00000000-0000-4000-8000-0000000000e1',
  started_by: gabriel.user_id,
  started_at: '2026-11-12T18:40:00',
  last_active_at: '2026-11-12T18:55:00',
  current_step: 2,
  variant_id: 'v-veg',
  servings: 6,
  status: 'in_progress',
};
const members = [gabriel, alex];

/** A client whose writes all succeed and return one row. */
function fakeClient() {
  const chain: Record<string, unknown> = {};
  for (const m of ['update', 'eq', 'lt', 'insert']) chain[m] = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({ data: { ...cook, id: 'c2' }, error: null }));
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: [{ id: 'c1' }], error: null });
  return { from: vi.fn(() => chain) } as never;
}

describe('what the cards say (FR-003, FR-004)', () => {
  it('"Step 3 of 6 · Gabriel · since 18:40", or "started yesterday" a day later', () => {
    expect(listLine(cook, 6, members, now, true)).toBe('Step 3 of 6 · Gabriel · since 18:40');
    expect(listLine(cook, 6, members, now, false)).toBe('Step 3 of 6 · Gabriel · since 6:40 PM');
    expect(listLine({ ...cook, last_active_at: '2026-11-11T18:00:00' }, 6, members, now, true)).toBe('Step 3 of 6 · Gabriel · started yesterday');
  });

  it('the page card names the version and servings', () => {
    const variants = [{ id: 'v-veg', name: 'Vegetarian' }] as never;
    expect(pageCard(cook, { variants }, 6, members, now, true)).toEqual({ title: 'Cooking now · step 3 of 6', line: 'Gabriel started at 18:40 · Vegetarian, serves 6' });
    expect(pageCard({ ...cook, variant_id: null }, { variants }, 6, members, now, true).line).toBe('Gabriel started at 18:40 · Classic, serves 6');
    expect(pageCard(cook, { variants: [] }, 6, members, now, true).line).toBe('Gabriel started at 18:40 · Serves 6');
  });
});

describe('the Cooked line (FR-005)', () => {
  it('counts calendar days', () => {
    expect(daysSince('2026-11-12T00:30:00', now)).toBe(0);
    expect(daysSince('2026-11-11T23:30:00', now)).toBe(1);
  });

  it('"Cooked 4 times · last by Alex, 3 weeks ago", "Cooked once · today", nothing when never', () => {
    expect(cookedLine({ times: 4, lastBy: alex.user_id, lastAt: '2026-10-22T19:00:00' }, members, now)).toBe('Cooked 4 times · last by Alex, 3 weeks ago');
    expect(cookedLine({ times: 1, lastBy: gabriel.user_id, lastAt: '2026-11-12T18:00:00' }, members, now)).toBe('Cooked once · today');
    expect(cookedLine({ times: 2, lastBy: 'u-gone', lastAt: '2026-08-01T18:00:00' }, members, now)).toBe('Cooked 2 times · last by Former member, 3 months ago');
    expect(cookedLine(null, members, now)).toBeNull();
  });
});

describe('events (Tracking)', () => {
  it('Done and Cancel send cook_finished with the steps seen and the minutes', async () => {
    const tracker = fakeTracker();
    await finishCook({ client: fakeClient(), tracker, now: () => now }, cook);
    await cancelCook({ client: fakeClient(), tracker, now: () => now }, cook);
    expect(tracker.track).toHaveBeenCalledWith('cook_finished', { status: 'done', cancel_reason: null, steps_seen: 3, minutes: 20 });
    expect(tracker.track).toHaveBeenCalledWith('cook_finished', { status: 'cancelled', cancel_reason: 'user', steps_seen: 3, minutes: 20 });
  });

  it('Start over ends the old cook as replaced and starts a new one', async () => {
    const tracker = fakeTracker();
    const started = await beginCook({ client: fakeClient(), tracker, now: () => now }, 'fam', cook.recipe_id, { current_step: 0, variant_id: null, servings: 6 }, cook);
    expect(started.id).toBe('c2');
    expect(tracker.track).toHaveBeenCalledWith('cook_finished', { status: 'cancelled', cancel_reason: 'replaced', steps_seen: 3, minutes: 20 });
    expect(tracker.track).toHaveBeenCalledWith('cook_started', { recipe_id: cook.recipe_id, resumed_existing: false });
  });
});
