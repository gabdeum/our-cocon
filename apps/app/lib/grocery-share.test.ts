// Spec 072 FR-002: when a link ends, and how the sheet and page say it.
import { describe, expect, it, vi } from 'vitest';
import { endsText, expiresAtFor, hoursActive, setGroceryShareOptions } from './grocery-share';

vi.mock('expo-linking', () => ({ createURL: (p: string) => `ourcocon://${p}` }));
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));

// Wednesday 26 November 2026, 14:20 on this machine's clock.
const now = new Date(2026, 10, 26, 14, 20);
const words = { endsToday: (t: string) => `Ends today at ${t}`, endsOn: (d: string, t: string) => `Ends ${d} at ${t}` };

describe('expiresAtFor', () => {
  it('ends in an hour, tonight, on Sunday night, or never', () => {
    expect(expiresAtFor('1h', now)).toEqual(new Date(2026, 10, 26, 15, 20));
    expect(expiresAtFor('today', now)).toEqual(new Date(2026, 10, 26, 23, 59, 59, 999));
    expect(expiresAtFor('week', now)).toEqual(new Date(2026, 10, 29, 23, 59, 59, 999));
    expect(expiresAtFor('none', now)).toBeNull();
  });

  it('on a Sunday, "This week" is tonight', () => {
    expect(expiresAtFor('week', new Date(2026, 10, 29, 9, 0))).toEqual(new Date(2026, 10, 29, 23, 59, 59, 999));
  });
});

describe('endsText', () => {
  it('says today or the weekday, in the clock the person uses', () => {
    expect(endsText(new Date(2026, 10, 26, 23, 59).toISOString(), words, true, now)).toBe('Ends today at 23:59');
    expect(endsText(new Date(2026, 10, 29, 23, 59).toISOString(), words, true, now)).toBe('Ends Sunday at 23:59');
    expect(endsText(new Date(2026, 10, 26, 15, 20).toISOString(), words, false, now)).toBe('Ends today at 3:20 PM');
    expect(endsText(null, words, true, now)).toBeNull();
  });
});

describe('hoursActive', () => {
  it('counts whole hours', () => {
    expect(hoursActive(new Date(now.getTime() - 90 * 60_000).toISOString(), now.getTime())).toBe(1);
    expect(hoursActive(now.toISOString(), now.getTime() - 1000)).toBe(0);
  });
});

describe('setGroceryShareOptions', () => {
  function fakeClient() {
    const update = vi.fn(() => ({ eq: () => ({ is: async () => ({ error: null }) }) }));
    return { client: { from: vi.fn(() => ({ update })) } as never, update };
  }

  it('sends a new end with a new time, counted from now', async () => {
    const { client, update } = fakeClient();
    expect(await setGroceryShareOptions(client, 't', { duration: '1h' }, now)).toEqual({ expires_at: new Date(2026, 10, 26, 15, 20).toISOString() });
    expect(update).toHaveBeenCalledWith({ duration: '1h', expires_at: new Date(2026, 10, 26, 15, 20).toISOString() });
    expect(await setGroceryShareOptions(client, 't', { duration: 'none' }, now)).toEqual({ expires_at: null });
  });

  it('leaves the end alone for the switch', async () => {
    const { client, update } = fakeClient();
    expect(await setGroceryShareOptions(client, 't', { can_edit: false }, now)).toBeNull();
    expect(update).toHaveBeenCalledWith({ can_edit: false });
  });
});
