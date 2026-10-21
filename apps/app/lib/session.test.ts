import { describe, expect, it } from 'vitest';
import { gateRedirect } from './session';

describe('gateRedirect', () => {
  it('sends signed-out people to sign in, except on public pages', () => {
    expect(gateRedirect('signedOut', ['(tabs)', 'settings'])).toBe('/welcome');
    expect(gateRedirect('signedOut', ['welcome'])).toBeNull();
    expect(gateRedirect('signedOut', ['join', '[token]'])).toBeNull();
    expect(gateRedirect('signedOut', ['auth', 'callback'])).toBeNull();
    expect(gateRedirect('signedOut', ['r', '[token]'])).toBeNull();
    expect(gateRedirect('signedOut', ['welcome', 'family'])).toBe('/welcome');
  });

  it('asks a signed-in person without a family to set one up, unless they are joining', () => {
    expect(gateRedirect('noFamily', ['(tabs)'])).toBe('/welcome/family');
    expect(gateRedirect('noFamily', ['welcome'])).toBe('/welcome/family');
    expect(gateRedirect('noFamily', ['welcome', 'family'])).toBeNull();
    expect(gateRedirect('noFamily', ['join', '[token]'])).toBeNull();
    expect(gateRedirect('noFamily', ['r', '[token]'])).toBeNull();
  });

  it('lands members on Home and keeps them out of the welcome pages (US1)', () => {
    expect(gateRedirect('ready', ['welcome', 'family'])).toBe('/');
    expect(gateRedirect('ready', ['(tabs)', 'settings'])).toBeNull();
    expect(gateRedirect('ready', ['join', '[token]'])).toBeNull();
    expect(gateRedirect('ready', ['r', '[token]'])).toBeNull();
  });

  it('waits while loading', () => {
    expect(gateRedirect('loading', ['(tabs)'])).toBeNull();
  });
});
