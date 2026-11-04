// Spec 046 US1 / SC-001 (asked on the first timer, never at launch) and US4 (a tap opens its
// screen, cold start included), with a fake iPhone.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { fakeTracker } from '../test/fakes';
import type { NativeNotifications, PermissionStatus, ShownNotification } from './notifications';
import { NotificationsProvider, useNotifications } from './notifications-context';
import { TimersProvider, useTimerStore } from './timer-store';

vi.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-00000000ffff' }));

afterEach(cleanup);

const DAY = 24 * 60 * 60 * 1000;

function fakePhone(status: PermissionStatus = 'undetermined', answer: PermissionStatus = 'granted') {
  let open: ((data: unknown, cold: boolean) => void) | null = null;
  let foreground: ((n: ShownNotification) => void) | null = null;
  const native: NativeNotifications & { status: PermissionStatus } = {
    status,
    permission: vi.fn(async () => native.status),
    request: vi.fn(async () => (native.status = answer)),
    pushToken: vi.fn(async () => 'ExponentPushToken[abcdefgh1234]'),
    onTokenChange: () => () => undefined,
    onForeground: (l) => ((foreground = l), () => (foreground = null)),
    onOpen: (l) => ((open = l), () => (open = null)),
    unregister: vi.fn(async () => undefined),
    openSettings: vi.fn(),
    appVersion: '1.0.0',
  };
  return { native, tap: (data: unknown, cold = false) => open?.(data, cold), arrive: (n: ShownNotification) => foreground?.(n) };
}

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: async (k: string) => items.get(k) ?? null,
    setItem: async (k: string, v: string) => void items.set(k, v),
    removeItem: async (k: string) => void items.delete(k),
  };
}

function StartTimer() {
  const store = useTimerStore();
  return <button type="button" onClick={() => store.quick()}>Start</button>;
}

function SaveReminder() {
  const { maybeAsk, setPref, turnOn } = useNotifications();
  return (
    <>
      <button type="button" onClick={() => maybeAsk('reminder')}>Save event</button>
      <button type="button" onClick={() => setPref('timers_live', false)}>Lock Screen off</button>
      <button type="button" onClick={() => void turnOn('settings')}>Page turn on</button>
    </>
  );
}

function setup(phone = fakePhone(), opts: { userId?: string; now?: () => number; storage?: ReturnType<typeof memoryStorage> } = {}) {
  const tracker = fakeTracker();
  const rpc = vi.fn(async () => ({ data: null, error: null }));
  const navigate = vi.fn();
  const showBanner = vi.fn();
  const storage = opts.storage ?? memoryStorage();
  const tree = (userId: string) => (
    <NotificationsProvider native={phone.native} storage={storage} client={{ rpc } as never} tracker={tracker} userId={userId} navigate={navigate} showBanner={showBanner} now={opts.now}>
      <Timers />
    </NotificationsProvider>
  );
  function Timers() {
    const { maybeAsk } = useNotifications();
    return (
      <TimersProvider userId="u1" storage={storage} tracker={tracker} onStart={() => maybeAsk('timer')}>
        <StartTimer />
        <SaveReminder />
      </TimersProvider>
    );
  }
  const view = render(tree(opts.userId ?? 'u1'));
  return { tracker, rpc, navigate, showBanner, storage, rerender: (userId: string) => view.rerender(tree(userId)) };
}

const flush = () => act(async () => undefined);
// A sheet fading out can still be in the page while the next one opens.
const sheet = () => screen.queryAllByRole('dialog')[0] ?? null;

describe('the ask (US1, FR-002)', () => {
  it('SC-001: never at launch; the first timer shows "Know when it’s done"', async () => {
    const { tracker } = setup();
    await flush();
    expect(sheet()).toBeNull();
    fireEvent.click(screen.getByText('Start'));
    await flush();
    expect(screen.getByRole('heading', { name: 'Know when it’s done' })).toBeTruthy();
    expect(screen.getByText('You can change this anytime in Menu › Notifications.')).toBeTruthy();
    expect(tracker.track).toHaveBeenCalledWith('notifications_ask_shown', { trigger: 'timer' });
  });

  it('"Turn on notifications" shows the iPhone prompt, then registers this phone', async () => {
    const phone = fakePhone();
    const { tracker, rpc } = setup(phone);
    await flush();
    fireEvent.click(screen.getByText('Start'));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Turn on notifications' }));
    await flush();
    await flush();
    expect(phone.native.request).toHaveBeenCalledOnce();
    expect(tracker.track).toHaveBeenCalledWith('notifications_permission_result', { granted: true, trigger: 'timer' });
    expect(sheet()).toBeNull();
    expect(rpc).toHaveBeenCalledWith('register_push_device', expect.objectContaining({ p_platform: 'ios', p_token: 'ExponentPushToken[abcdefgh1234]', p_app_version: '1.0.0' }));
  });

  it('"Not now": not again on the next timer, once more after 14 days, then never', async () => {
    let now = 0;
    const storage = memoryStorage();
    setup(fakePhone(), { now: () => now, storage });
    await flush();
    fireEvent.click(screen.getByText('Start'));
    await flush();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await flush();
    fireEvent.click(screen.getByText('Start'));
    await flush();
    expect(sheet()).toBeNull();
    now = 14 * DAY;
    fireEvent.click(screen.getByText('Start'));
    await flush();
    expect(sheet()).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await flush();
    now = 60 * DAY;
    fireEvent.click(screen.getByText('Start'));
    await flush();
    expect(sheet()).toBeNull();
  });

  it('a reminder asks with its own words', async () => {
    const { tracker } = setup();
    await flush();
    fireEvent.click(screen.getByText('Save event'));
    await flush();
    expect(screen.getByRole('heading', { name: 'Get a heads-up before events' })).toBeTruthy();
    expect(screen.getByText('Turn on notifications so reminders reach your phone, even when Our Cocon is closed.')).toBeTruthy();
    expect(tracker.track).toHaveBeenCalledWith('notifications_ask_shown', { trigger: 'reminder' });
  });

  it('never once the iPhone said no, or yes', async () => {
    for (const status of ['denied', 'granted'] as const) {
      setup(fakePhone(status));
      await flush();
      fireEvent.click(screen.getByText('Start'));
      await flush();
      expect(sheet()).toBeNull();
      cleanup();
    }
  });
});

describe('the switches and the page (US2, FR-003)', () => {
  it('a switch is kept on this phone, sent to its registration, and tracked', async () => {
    const { tracker, rpc } = setup(fakePhone('granted'));
    await flush();
    fireEvent.click(screen.getByText('Lock Screen off'));
    await flush();
    expect(tracker.track).toHaveBeenCalledWith('notification_settings_changed', { setting: 'timers_live', value: 'off' });
    expect(rpc).toHaveBeenCalledWith('set_push_prefs', expect.objectContaining({ p_prefs: expect.objectContaining({ timers_live: false }) }));
  });

  it('the page’s "Turn on notifications" goes straight to the iPhone prompt', async () => {
    const phone = fakePhone();
    const { tracker } = setup(phone);
    await flush();
    fireEvent.click(screen.getByText('Page turn on'));
    await flush();
    expect(phone.native.request).toHaveBeenCalledOnce();
    expect(tracker.track).toHaveBeenCalledWith('notifications_permission_result', { granted: true, trigger: 'settings' });
  });
});

describe('taps (US4, FR-006)', () => {
  it('a timer opens Timers; a reminder opens that occurrence', async () => {
    const phone = fakePhone('granted');
    const { navigate, tracker } = setup(phone);
    await flush();
    act(() => phone.tap({ kind: 'timer_done', route: '/timers' }, true));
    expect(navigate).toHaveBeenLastCalledWith('/timers');
    expect(tracker.track).toHaveBeenCalledWith('notification_opened', { kind: 'timer_done', cold_start: true });
    // Spec 047: a tapped timer alert.
    expect(tracker.track).toHaveBeenCalledWith('timer_alert_action', { action: 'open' });
    const event = '/calendar/0f8fad5b-d9cb-469f-a165-70867728950e?date=2026-11-03';
    act(() => phone.tap({ kind: 'reminder', route: event }));
    expect(navigate).toHaveBeenLastCalledWith(event);
  });

  it('ignores a payload that isn’t ours', async () => {
    const phone = fakePhone('granted');
    const { navigate } = setup(phone);
    await flush();
    act(() => phone.tap({ kind: 'reminder', route: '/settings/family' }));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('cold start before the session is back: opens once someone is signed in', async () => {
    const phone = fakePhone('granted');
    const { navigate, rerender } = setup(phone, { userId: '' });
    await flush();
    act(() => phone.tap({ kind: 'timer_done', route: '/timers' }, true));
    expect(navigate).not.toHaveBeenCalled();
    rerender('u1');
    await flush();
    expect(navigate).toHaveBeenCalledWith('/timers');
  });

  it('app open: a reminder shows as a banner that opens the event; a timer shows nothing', async () => {
    const phone = fakePhone('granted');
    const { showBanner, navigate } = setup(phone);
    await flush();
    const event = '/calendar/0f8fad5b-d9cb-469f-a165-70867728950e?date=2026-11-03';
    act(() => phone.arrive({ title: 'Baby swim class in 1 hour', body: '14:30 · Aquatic Center', data: { kind: 'reminder', route: event } }));
    expect(showBanner).toHaveBeenCalledWith('Baby swim class in 1 hour · 14:30 · Aquatic Center', expect.any(Function));
    (showBanner.mock.lastCall?.[1] as () => void)();
    expect(navigate).toHaveBeenCalledWith(event);
    act(() => phone.arrive({ title: 'Blind bake is done', body: '', data: { kind: 'timer_done', route: '/timers' } }));
    expect(showBanner).toHaveBeenCalledOnce();
  });
});
