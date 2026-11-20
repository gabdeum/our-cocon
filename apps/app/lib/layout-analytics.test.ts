import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { createTracker } from '@cocon/schemas';
import { deviceClass, useLayoutAnalytics, type DeviceTraits } from './layout-analytics';

const dims = vi.hoisted(() => ({ width: 390, height: 844, scale: 3, fontScale: 1 }));
vi.mock('react-native', async (actual) => ({ ...(await actual<typeof import('react-native')>()), useWindowDimensions: () => ({ ...dims }) }));

afterEach(() => {
  cleanup();
  dims.width = 390;
});

const traits = (over: Partial<DeviceTraits>): DeviceTraits => ({ os: 'web', isPad: false, coarsePointer: false, screenShort: 0, ...over });

describe('deviceClass', () => {
  it.each([
    [traits({ os: 'ios' }), 'phone'],
    [traits({ os: 'ios', isPad: true }), 'tablet'],
    [traits({ coarsePointer: true, screenShort: 390 }), 'phone'],
    [traits({ coarsePointer: true, screenShort: 820 }), 'tablet'],
    [traits({ screenShort: 900 }), 'desktop'],
  ] as const)('%o is a %s', (t, expected) => {
    expect(deviceClass(t)).toBe(expected);
  });
});

// Spec 063 Tracking: layout_tier and device_class go with every event, and follow the window.
it('registers the tier and device class, again when the tier changes', () => {
  const transport = { capture: vi.fn(), identify: vi.fn(), group: vi.fn(), reset: vi.fn(), register: vi.fn() };
  const tracker = createTracker(transport);
  const desktop = () => traits({ screenShort: 900 });
  const { rerender } = renderHook(() => useLayoutAnalytics(tracker, desktop));
  expect(transport.register).toHaveBeenLastCalledWith({ layout_tier: 'compact', device_class: 'desktop' });
  dims.width = 1280;
  rerender();
  expect(transport.register).toHaveBeenLastCalledWith({ layout_tier: 'expanded', device_class: 'desktop' });
  rerender();
  expect(transport.register).toHaveBeenCalledTimes(2);
});
