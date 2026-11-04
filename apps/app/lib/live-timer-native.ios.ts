import { requireOptionalNativeModule, type EventSubscription } from 'expo';
import type { LiveTimerNative } from './live-activity';

/**
 * Spec 048 on the iPhone: the app's own module (modules/live-timer) over ActivityKit. Missing in a
 * build made before 048 (a JS update reaching an older build): then there's no card, and nothing fails.
 */
interface LiveTimerModule {
  areEnabled(): boolean;
  current(): Promise<string | null>;
  start(owner: string, state: string, staleAt: number | null): Promise<boolean>;
  update(owner: string, state: string, staleAt: number | null): Promise<boolean>;
  end(): Promise<void>;
  takeActions(): Promise<string>;
  addListener(event: 'onAction', listener: () => void): EventSubscription;
}

const native = requireOptionalNativeModule<LiveTimerModule>('CoconLiveTimer');

const parse = (text: string | null): unknown => {
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

export const liveTimerNative: LiveTimerNative | null = native
  ? {
      enabled: () => native.areEnabled(),
      async current() {
        const owner = await native.current();
        return owner === null ? null : { owner };
      },
      start: (owner, state, staleAt) => native.start(owner, JSON.stringify(state), staleAt),
      update: (owner, state, staleAt) => native.update(owner, JSON.stringify(state), staleAt),
      end: () => native.end(),
      async takeActions() {
        const list = parse(await native.takeActions());
        return Array.isArray(list) ? list : [];
      },
      onAction(listener) {
        const sub = native.addListener('onAction', listener);
        return () => sub.remove();
      },
    }
  : null;
