import { describe, expect, it } from 'vitest';
import { gateRedirect, openedPath } from './session';

describe('gateRedirect', () => {
  it('sends signed-out people to sign in, except on public pages', () => {
    expect(gateRedirect('signedOut', ['(tabs)', 'settings'])).toBe('/welcome');
    expect(gateRedirect('signedOut', ['welcome'])).toBeNull();
    expect(gateRedirect('signedOut', ['join', '[token]'])).toBeNull();
    expect(gateRedirect('signedOut', ['auth', 'callback'])).toBeNull();
    expect(gateRedirect('signedOut', ['r', '[token]'])).toBeNull();
    expect(gateRedirect('signedOut', ['e', '[token]'])).toBeNull();
    expect(gateRedirect('signedOut', ['oauth', 'consent'])).toBeNull();
    expect(gateRedirect('signedOut', ['welcome', 'family'])).toBe('/welcome');
  });

  it('asks a signed-in person without a family to set one up, unless they are joining', () => {
    expect(gateRedirect('noFamily', ['(tabs)'])).toBe('/welcome/family');
    expect(gateRedirect('noFamily', ['welcome'])).toBe('/welcome/family');
    expect(gateRedirect('noFamily', ['welcome', 'family'])).toBeNull();
    expect(gateRedirect('noFamily', ['join', '[token]'])).toBeNull();
    expect(gateRedirect('noFamily', ['r', '[token]'])).toBeNull();
    expect(gateRedirect('noFamily', ['e', '[token]'])).toBeNull();
    expect(gateRedirect('noFamily', ['oauth', 'consent'])).toBeNull();
  });

  it('lands members on Home and keeps them out of the welcome pages (US1)', () => {
    expect(gateRedirect('ready', ['welcome', 'family'])).toBe('/');
    expect(gateRedirect('ready', ['(tabs)', 'settings'])).toBeNull();
    expect(gateRedirect('ready', ['join', '[token]'])).toBeNull();
    expect(gateRedirect('ready', ['r', '[token]'])).toBeNull();
    expect(gateRedirect('ready', ['e', '[token]'])).toBeNull();
  });

  it('waits while loading', () => {
    expect(gateRedirect('loading', ['(tabs)'])).toBeNull();
  });

  it('brings a link opened signed out back after signing in (spec 054 FR-002)', () => {
    expect(gateRedirect('signedOut', ['calendar', '[id]'], '/calendar/abc?date=2026-11-12')).toBe(`/welcome?next=${encodeURIComponent('/calendar/abc?date=2026-11-12')}`);
    expect(gateRedirect('signedOut', ['settings', 'notifications'], '/settings/notifications')).toBe('/welcome?next=%2Fsettings%2Fnotifications');
    expect(gateRedirect('signedOut', ['(tabs)'], '/')).toBe('/welcome');
    expect(gateRedirect('signedOut', ['welcome', 'family'], '/welcome/family')).toBe('/welcome');
    // Only the app's own paths.
    expect(gateRedirect('signedOut', ['(tabs)'], '//evil.example')).toBe('/welcome');
  });
});

describe('openedPath', () => {
  it("keeps the query but not the route's own segments", () => {
    expect(openedPath('/calendar/abc', ['calendar', '[id]'], { id: 'abc', date: '2026-11-12' })).toBe('/calendar/abc?date=2026-11-12');
    expect(openedPath('/recipes/abc/cook', ['recipes', '[id]', 'cook'], { id: 'abc', step: 's 1' })).toBe('/recipes/abc/cook?step=s+1');
    expect(openedPath('/recipes', ['(tabs)', 'recipes'], {})).toBe('/recipes');
  });
});
