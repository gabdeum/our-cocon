// Spec 012 US3 and FR-005: the screen stays on in cooking mode, and can lock again after.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';

const keepAwake = vi.hoisted(() => ({
  isAvailableAsync: vi.fn(async () => true),
  activateKeepAwakeAsync: vi.fn(async () => undefined),
  deactivateKeepAwake: vi.fn(async () => undefined),
}));
vi.mock('expo-keep-awake', () => keepAwake);

const { useCookAwake } = await import('./keep-awake');

const settle = () =>
  act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });

beforeEach(() => {
  keepAwake.isAvailableAsync.mockResolvedValue(true);
  keepAwake.activateKeepAwakeAsync.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('useCookAwake', () => {
  it('keeps the screen on while mounted and lets it lock on leaving', async () => {
    const { result, unmount } = renderHook(() => useCookAwake(true));
    await settle();
    expect(result.current).toBe('on');
    expect(keepAwake.activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
    unmount();
    await settle();
    expect(keepAwake.deactivateKeepAwake).toHaveBeenCalledTimes(1);
  });

  it('says unsupported when the browser has no Wake Lock, or refuses it', async () => {
    keepAwake.isAvailableAsync.mockResolvedValue(false);
    const a = renderHook(() => useCookAwake(true));
    await settle();
    expect(a.result.current).toBe('unsupported');
    expect(keepAwake.activateKeepAwakeAsync).not.toHaveBeenCalled();

    keepAwake.isAvailableAsync.mockResolvedValue(true);
    keepAwake.activateKeepAwakeAsync.mockRejectedValue(new Error('NotAllowedError'));
    const b = renderHook(() => useCookAwake(true));
    await settle();
    expect(b.result.current).toBe('unsupported');
  });

  it('does nothing when "Keep screen on" is off', async () => {
    const { result } = renderHook(() => useCookAwake(false));
    await settle();
    expect(result.current).toBe('off');
    expect(keepAwake.activateKeepAwakeAsync).not.toHaveBeenCalled();
  });

  it('asks again when the tab comes back (browsers drop the lock while hidden)', async () => {
    renderHook(() => useCookAwake(true));
    await settle();
    document.dispatchEvent(new Event('visibilitychange'));
    await settle();
    expect(keepAwake.activateKeepAwakeAsync).toHaveBeenCalledTimes(2);
  });
});
