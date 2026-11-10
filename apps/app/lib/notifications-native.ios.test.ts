// Spec 046 FR-004 on the iPhone: asking for the push token makes iOS report it again, which
// expo-notifications sends as a token event. Re-registering on that event looped (thousands of
// requests a second); only a token unlike the last one may count as a change.
import { describe, expect, it, vi } from 'vitest';

const phone = vi.hoisted(() => ({
  token: 'apns-1',
  /** Runs while the Expo token is being fetched: Apple can hand out a new token right then. */
  duringExpo: null as (() => void) | null,
  listeners: new Set<(t: { data: string }) => void>(),
  // As iOS does: every request registers with Apple again, and the token comes back as an event too.
  report() {
    for (const l of phone.listeners) l({ data: phone.token });
  },
}));

vi.mock('expo-device', () => ({ isDevice: true }));
vi.mock('expo-constants', () => ({ default: { expoConfig: { version: '1.0.0', extra: { eas: { projectId: 'p1' } } } } }));
vi.mock('expo-notifications', () => ({
  setNotificationHandler: () => undefined,
  IosAuthorizationStatus: { PROVISIONAL: 3 },
  getDevicePushTokenAsync: async () => {
    queueMicrotask(phone.report);
    return { type: 'ios', data: phone.token };
  },
  getExpoPushTokenAsync: async ({ devicePushToken }: { devicePushToken: { data: string } }) => {
    phone.duringExpo?.();
    await Promise.resolve();
    return { data: `ExponentPushToken[${devicePushToken.data}]` };
  },
  addPushTokenListener: (l: (t: { data: string }) => void) => {
    phone.listeners.add(l);
    return { remove: () => phone.listeners.delete(l) };
  },
}));

const { nativeNotifications } = await import('./notifications-native.ios');
const native = nativeNotifications as NonNullable<typeof nativeNotifications>;
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('push token changes (FR-004)', () => {
  it('asking for the token never counts as a change: registering on start stays one request', async () => {
    let registered = 0;
    const register = async () => {
      registered += 1;
      await native.pushToken();
    };
    const stop = native.onTokenChange(() => void register());
    await register();
    await settle();
    expect(registered).toBe(1);

    phone.token = 'apns-2';
    phone.report();
    await settle();
    expect(registered).toBe(2);
    stop();
  });

  it('a new token reported while asking still re-registers, once (security review)', async () => {
    const tokens: (string | null)[] = [];
    const register = async () => void tokens.push(await native.pushToken());
    const stop = native.onTokenChange(() => void register());
    phone.duringExpo = () => {
      phone.duringExpo = null;
      phone.token = 'apns-3';
      phone.report();
    };
    await register();
    await settle();
    expect(tokens).toEqual(['ExponentPushToken[apns-2]', 'ExponentPushToken[apns-3]']);
    stop();
  });
});
