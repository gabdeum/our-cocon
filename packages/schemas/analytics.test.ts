import { describe, expect, it, vi } from 'vitest';
import { createTracker, type AnalyticsTransport } from './analytics';

function fakeTransport() {
  return { capture: vi.fn(), identify: vi.fn(), group: vi.fn() } satisfies AnalyticsTransport;
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
});
