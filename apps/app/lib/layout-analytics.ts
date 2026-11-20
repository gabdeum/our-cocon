import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useLayoutTier } from '@cocon/ui';
import type { SuperProperties, Tracker } from '@cocon/schemas';

type DeviceClass = SuperProperties['device_class'];

export interface DeviceTraits {
  os: string;
  isPad: boolean;
  /** Touch is the main pointer (a phone or tablet browser). */
  coarsePointer: boolean;
  /** The screen's shorter side, in points. */
  screenShort: number;
}

/**
 * For analytics only (spec 063 Tracking); layouts follow the window's tier, never this. The iPhone
 * app says itself; on the web a touch screen under 600 on its short side is a phone, a larger one a
 * tablet, and anything with a mouse or trackpad a desktop.
 */
export function deviceClass({ os, isPad, coarsePointer, screenShort }: DeviceTraits): DeviceClass {
  if (os === 'ios') return isPad ? 'tablet' : 'phone';
  if (!coarsePointer) return 'desktop';
  return screenShort < 600 ? 'phone' : 'tablet';
}

function currentTraits(): DeviceTraits {
  const web = Platform.OS === 'web' && typeof window !== 'undefined';
  return {
    os: Platform.OS,
    isPad: Platform.OS === 'ios' && Platform.isPad,
    coarsePointer: web ? (window.matchMedia?.('(pointer: coarse)').matches ?? false) : true,
    screenShort: web ? Math.min(window.screen.width, window.screen.height) : 0,
  };
}

/** Keeps `layout_tier` and `device_class` on every event, updated when the window changes tier. */
export function useLayoutAnalytics(tracker: Tracker, traits: () => DeviceTraits = currentTraits) {
  const { tier } = useLayoutTier();
  useEffect(() => {
    tracker.register({ layout_tier: tier, device_class: deviceClass(traits()) });
  }, [tracker, tier, traits]);
}
