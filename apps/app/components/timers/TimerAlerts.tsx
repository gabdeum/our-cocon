import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBanner } from '@cocon/ui';
import { strings } from '../../strings/en';
import { useTimerStore } from '../../lib/timer-store';

/** Banners stay 8 s (StatusBanner README › Rules). */
export const BANNER_MS = 8000;
/** The chime plays twice (FR-005), this far apart. */
export const CHIME_GAP_MS = 1400;

export interface TimerAlertsProps {
  /** Plays the kitchen-bell chime once (lib/chime.ts). */
  chime: () => void;
  vibrate: () => void;
  /** "Open timers" on the banner (spec 011): opens the Timers screen. */
  onOpenTimers: () => void;
}

/**
 * When a timer reaches zero, on any screen (spec 010 US3): the chime twice, a vibration, and a
 * StatusBanner "Blind bake is done" at the top. A newer banner replaces the old one.
 * "Open timers" joins the banner with the Timers screen (spec 011).
 */
export function TimerAlerts({ chime, vibrate, onOpenTimers }: TimerAlertsProps) {
  const store = useTimerStore();
  const insets = useSafeAreaInsets();
  const [banner, setBanner] = useState<{ message: string; key: number } | null>(null);

  useEffect(() => {
    const timeouts = new Set<ReturnType<typeof setTimeout>>();
    const later = (f: () => void, ms: number) => {
      const t = setTimeout(() => {
        timeouts.delete(t);
        f();
      }, ms);
      timeouts.add(t);
    };
    const off = store.onFinished((timer) => {
      chime();
      later(chime, CHIME_GAP_MS);
      vibrate();
      const key = Date.now();
      setBanner({ message: strings.timers.done(timer.label), key });
      later(() => setBanner((b) => (b?.key === key ? null : b)), BANNER_MS);
    });
    return () => {
      off();
      timeouts.forEach(clearTimeout);
    };
  }, [store, chime, vibrate]);

  if (!banner) return null;
  return (
    // Below the status bar on any screen, over the content.
    <View pointerEvents="box-none" className="absolute left-16 right-16 top-12 z-10" style={{ marginTop: insets.top }}>
      <StatusBanner
        message={banner.message}
        actionLabel={strings.timers.openTimers}
        onAction={() => {
          setBanner(null);
          onOpenTimers();
        }}
      />
    </View>
  );
}
