import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake, isAvailableAsync } from 'expo-keep-awake';

/** `on`: the screen won't lock. `unsupported`: this browser has no Wake Lock (or refused it). `off`: not asked for. */
export type AwakeStatus = 'on' | 'unsupported' | 'off';

const TAG = 'cocon-cooking';

/**
 * Spec 012 US3, FR-005: keeps the screen on while cooking mode is open, and lets it lock again on
 * leaving. On the web it goes through the Wake Lock API, which the browser drops whenever the tab
 * is hidden, so it is asked for again when the tab comes back.
 */
export function useCookAwake(enabled: boolean): AwakeStatus {
  const [status, setStatus] = useState<AwakeStatus>('off');

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    let held = false;
    const acquire = async () => {
      try {
        if (!(await isAvailableAsync())) throw new Error('unavailable');
        await activateKeepAwakeAsync(TAG);
        held = true;
        if (live) setStatus('on');
        else void release();
      } catch {
        if (live) setStatus('unsupported');
      }
    };
    const release = async () => {
      if (!held) return;
      held = false;
      try {
        await deactivateKeepAwake(TAG);
      } catch {
        // Already released by the browser.
      }
    };
    void acquire();

    const web = Platform.OS === 'web' && typeof document !== 'undefined';
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };
    if (web) document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      if (web) document.removeEventListener('visibilitychange', onVisible);
      void release();
    };
  }, [enabled]);

  return enabled ? status : 'off';
}
