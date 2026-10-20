import { describe, expect, it, vi } from 'vitest';
import { createTracker, type AnalyticsTransport } from './analytics';

function fakeTransport() {
  return { capture: vi.fn(), identify: vi.fn(), group: vi.fn(), reset: vi.fn() } satisfies AnalyticsTransport;
}

describe('createTracker', () => {
  it('sends a valid event with its props', () => {
    const t = fakeTransport();
    createTracker(t).track('app_opened', { platform: 'web', app_version: '1.0.0' });
    expect(t.capture).toHaveBeenCalledWith('app_opened', { platform: 'web', app_version: '1.0.0' });
  });

  it('rejects an unknown event', () => {
    const tracker = createTracker(fakeTransport());
    // @ts-expect-error unknown events don't type-check either
    expect(() => tracker.track('recipe_text', {})).toThrow(/Unknown analytics event/);
  });

  it('rejects extra props, so user content cannot be sent', () => {
    const t = fakeTransport();
    const props = { platform: 'web', app_version: '1.0.0', name: 'Gabriel' } as never;
    expect(() => createTracker(t).track('app_opened', props)).toThrow();
    expect(t.capture).not.toHaveBeenCalled();
  });

  it('rejects a wrong platform', () => {
    const props = { platform: 'android', app_version: '1.0.0' } as never;
    expect(() => createTracker(fakeTransport()).track('app_opened', props)).toThrow();
  });

  it('identifies by user id with the family as a group', () => {
    const t = fakeTransport();
    const user = '0b7c6a52-6d0f-4c55-9b0e-3c7e8a1f2d44';
    const family = '5f3e2d1c-0b9a-4876-9543-210fedcba987';
    createTracker(t).identify(user, family);
    expect(t.identify).toHaveBeenCalledWith(user);
    expect(t.group).toHaveBeenCalledWith('family', family);
  });

  it('refuses to identify by anything but an id', () => {
    expect(() => createTracker(fakeTransport()).identify('gabriel@example.com', null)).toThrow();
  });

  it('sends tab_selected with the tab only', () => {
    const t = fakeTransport();
    createTracker(t).track('tab_selected', { tab: 'groceries' });
    expect(t.capture).toHaveBeenCalledWith('tab_selected', { tab: 'groceries' });
  });

  it('rejects an unknown tab', () => {
    const props = { tab: 'timers' } as never;
    expect(() => createTracker(fakeTransport()).track('tab_selected', props)).toThrow();
  });

  it('does nothing without a transport', () => {
    expect(() => createTracker(null).track('app_opened', { platform: 'ios', app_version: '1' })).not.toThrow();
  });

  it('sends the spec 003 events with only their typed props', () => {
    const t = fakeTransport();
    const tracker = createTracker(t);
    tracker.track('signed_up', { method: 'google' });
    tracker.track('invite_accepted', { days_since_sent: 2 });
    tracker.track('family_deleted', { member_count: 3 });
    tracker.track('family_created', {});
    expect(t.capture.mock.calls).toEqual([
      ['signed_up', { method: 'google' }],
      ['invite_accepted', { days_since_sent: 2 }],
      ['family_deleted', { member_count: 3 }],
      ['family_created', {}],
    ]);
  });

  it('refuses names or emails on the spec 003 events', () => {
    const tracker = createTracker(fakeTransport());
    expect(() => tracker.track('family_created', { name: 'The Demanges' } as never)).toThrow();
    expect(() => tracker.track('signed_in', { method: 'apple' } as never)).toThrow();
    expect(() => tracker.track('invite_accepted', { days_since_sent: 1.5 })).toThrow();
  });

  it('resets on sign-out', () => {
    const t = fakeTransport();
    createTracker(t).reset();
    expect(t.reset).toHaveBeenCalled();
  });

  it('sends spec 006 search and open events without the query text', () => {
    const t = fakeTransport();
    const tracker = createTracker(t);
    tracker.track('recipes_searched', { query_length: 4, result_count: 1 });
    tracker.track('recipe_opened', { from: 'search' });
    expect(t.capture).toHaveBeenCalledWith('recipes_searched', { query_length: 4, result_count: 1 });
    expect(() => tracker.track('recipes_searched', { query_length: 4, result_count: 1, query: 'leek' } as never)).toThrow();
  });

  it('sends recipe_filters_applied with group keys only (spec 007)', () => {
    const t = fakeTransport();
    createTracker(t).track('recipe_filters_applied', { filter_keys: ['months', 'time', 'added_by'], result_count: 4 });
    expect(t.capture).toHaveBeenCalledWith('recipe_filters_applied', { filter_keys: ['months', 'time', 'added_by'], result_count: 4 });
    const tracker = createTracker(fakeTransport());
    expect(() => tracker.track('recipe_filters_applied', { filter_keys: ['french'], result_count: 1 } as never)).toThrow();
    expect(() => tracker.track('recipe_filters_applied', { filter_keys: [], result_count: 1, cuisines: ['french'] } as never)).toThrow();
  });

  it('sends servings_changed and variant_selected with numbers only (spec 008)', () => {
    const t = fakeTransport();
    const tracker = createTracker(t);
    tracker.track('servings_changed', { from: 6, to: 9 });
    tracker.track('variant_selected', { variant_count: 2 });
    expect(t.capture).toHaveBeenCalledWith('servings_changed', { from: 6, to: 9 });
    expect(t.capture).toHaveBeenCalledWith('variant_selected', { variant_count: 2 });
    expect(() => tracker.track('servings_changed', { from: 6, to: 0 })).toThrow();
    expect(() => tracker.track('variant_selected', { variant_count: 1, name: 'Vegetarian' } as never)).toThrow();
  });

  it('sends the timer events with numbers and enums only (spec 010)', () => {
    const t = fakeTransport();
    const tracker = createTracker(t);
    tracker.track('timer_started', { from: 'step' });
    tracker.track('timer_adjusted', { delta_min: -1 });
    tracker.track('timer_finished', {});
    tracker.track('step_timer_started', { step_index: 1 });
    expect(t.capture).toHaveBeenCalledWith('timer_started', { from: 'step' });
    expect(t.capture).toHaveBeenCalledWith('timer_adjusted', { delta_min: -1 });
    expect(t.capture).toHaveBeenCalledWith('timer_finished', {});
    expect(t.capture).toHaveBeenCalledWith('step_timer_started', { step_index: 1 });
    expect(() => tracker.track('timer_started', { from: 'cook' } as never)).toThrow();
    expect(() => tracker.track('timer_finished', { label: 'Blind bake' } as never)).toThrow();
    expect(() => tracker.track('timer_adjusted', { delta_min: 0.5 })).toThrow();
  });

  it('sends the pill and Timers screen events with a count only (spec 011)', () => {
    const t = fakeTransport();
    const tracker = createTracker(t);
    tracker.track('timer_pill_tapped', { timer_count: 2 });
    tracker.track('timers_screen_opened', { timer_count: 0 });
    expect(t.capture).toHaveBeenCalledWith('timer_pill_tapped', { timer_count: 2 });
    expect(t.capture).toHaveBeenCalledWith('timers_screen_opened', { timer_count: 0 });
    expect(() => tracker.track('timer_pill_tapped', { timer_count: 0 })).toThrow();
    expect(() => tracker.track('timers_screen_opened', { timer_count: 1, label: 'Blind bake' } as never)).toThrow();
  });

  it('validates the cooking-mode events (spec 012)', () => {
    const t = fakeTransport();
    const tracker = createTracker(t);
    tracker.track('cooking_started', { step_count: 6 });
    tracker.track('cooking_finished', { step_count: 6, minutes: 42 });
    tracker.track('cooking_exited', { at_step: 3, step_count: 6 });
    expect(t.capture).toHaveBeenCalledWith('cooking_started', { step_count: 6 });
    expect(t.capture).toHaveBeenCalledWith('cooking_finished', { step_count: 6, minutes: 42 });
    expect(t.capture).toHaveBeenCalledWith('cooking_exited', { at_step: 3, step_count: 6 });
    expect(() => tracker.track('cooking_started', { step_count: 0 })).toThrow();
    expect(() => tracker.track('cooking_exited', { at_step: 0, step_count: 6 })).toThrow();
    expect(() => tracker.track('cooking_finished', { step_count: 6, minutes: 1.5 })).toThrow();
    expect(() => tracker.track('cooking_started', { step_count: 6, recipe: 'Quiche' } as never)).toThrow();
  });
});
