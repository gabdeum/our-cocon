// Spec 046 US2 (one place to control it) and US3 (off in iPhone Settings), design/ui/OC-SettingsNotif.md.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { render } from '../../test/render';
import { DEFAULT_NOTIFICATION_PREFS } from '@cocon/schemas';
import { fakeTracker } from '../../test/fakes';
import { NotificationSettings, type NotificationSettingsProps } from './NotificationSettings';
import { expectAccessible } from '../../test/axe';

afterEach(cleanup);

function setup(over: Partial<NotificationSettingsProps> = {}) {
  const props: NotificationSettingsProps = {
    supported: true,
    status: 'granted',
    prefs: DEFAULT_NOTIFICATION_PREFS,
    onPref: vi.fn(),
    defaultReminder: 'hour_before',
    onDefaultReminder: vi.fn().mockResolvedValue('saved'),
    managedNames: ['James'],
    onTurnOn: vi.fn(),
    onOpenSettings: vi.fn(),
    onBack: vi.fn(),
    tracker: fakeTracker(),
    ...over,
  };
  const view = render(<NotificationSettings {...props} />);
  return { ...props, rerender: (next: Partial<NotificationSettingsProps>) => view.rerender(<NotificationSettings {...props} {...next} />) };
}

const flush = () => act(async () => undefined);

describe('Notifications (OC-SettingsNotif)', () => {
  it('US2: back to the Menu, then Timers and Event reminders, as drawn', async () => {
    const { onBack } = setup();
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Notifications', 'Timers', 'Event reminders']);
    expect(screen.getByText('Just for you, on this iPhone.')).toBeTruthy();
    expect(screen.getAllByRole('switch').map((s) => s.getAttribute('aria-label'))).toEqual(['Timer on Lock Screen', 'Alert when a timer ends', 'Event reminders']);
    for (const hint of ['Countdown on the Lock Screen and in the Dynamic Island', 'Chime and notification, even when the app is closed', 'Before events that have a reminder', 'When you add an event'])
      expect(screen.getByText(hint)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Events I’m on' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('link', { name: /Default for new events/ }).textContent).toContain('1 hour before');
    expect(screen.getByText('Events for James remind the person who takes them, or everyone with the app if nobody’s chosen yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Back to Menu' }));
    expect(onBack).toHaveBeenCalledOnce();
    // Spec 030 SC-001.
    await expectAccessible();
  });

  it('US2: every switch and choice saves at once', () => {
    const { onPref } = setup();
    fireEvent.click(screen.getByRole('switch', { name: 'Timer on Lock Screen' }));
    expect(onPref).toHaveBeenLastCalledWith('timers_live', false);
    fireEvent.click(screen.getByRole('switch', { name: 'Alert when a timer ends' }));
    expect(onPref).toHaveBeenLastCalledWith('timers_alert', false);
    fireEvent.click(screen.getByRole('button', { name: 'All family events' }));
    expect(onPref).toHaveBeenLastCalledWith('reminders_scope', 'all');
    fireEvent.click(screen.getByRole('switch', { name: 'Event reminders' }));
    expect(onPref).toHaveBeenLastCalledWith('reminders_on', false);
  });

  it('US2: the default for new events, from five choices', async () => {
    const { onDefaultReminder } = setup();
    fireEvent.click(screen.getByRole('link', { name: /Default for new events/ }));
    const choices = screen.getAllByRole('radio');
    expect(choices.map((c) => c.textContent)).toEqual(['None', '15 minutes before', '1 hour before', 'Morning of', '1 day before']);
    expect(screen.getByRole('radio', { name: '1 hour before' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: '15 minutes before' }));
    await flush();
    expect(onDefaultReminder).toHaveBeenCalledWith('minutes_15');
  });

  it('a failed save says so', async () => {
    setup({ onDefaultReminder: vi.fn().mockResolvedValue('failed') });
    fireEvent.click(screen.getByRole('link', { name: /Default for new events/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'None' }));
    await flush();
    expect(screen.getByText("Couldn't save. Try again.")).toBeTruthy();
  });

  it('reminders off: the two rows below the switch are hidden', () => {
    setup({ prefs: { ...DEFAULT_NOTIFICATION_PREFS, reminders_on: false } });
    expect(screen.queryByText('Remind me about')).toBeNull();
    expect(screen.queryByText('Default for new events')).toBeNull();
  });

  it('no members without the app: no hint under Event reminders', () => {
    setup({ managedNames: [] });
    expect(screen.queryByText(/remind the person who takes/)).toBeNull();
  });

  it('US3: off in iPhone Settings, the warning and a way there, everything else dimmed', () => {
    const { onOpenSettings, onPref } = setup({ status: 'denied' });
    expect(screen.getByRole('status').textContent).toBe(
      'Notifications are off for Our CoconTimers can’t chime and reminders won’t arrive while the app is closed.Open iPhone Settings',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Open iPhone Settings' }));
    expect(onOpenSettings).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('switch', { name: 'Timer on Lock Screen' }));
    expect(onPref).not.toHaveBeenCalled();
  });

  it('not asked yet: "Turn on notifications" at the top', () => {
    const { onTurnOn, tracker } = setup({ status: 'undetermined' });
    expect(tracker.track).toHaveBeenCalledWith('notifications_ask_shown', { trigger: 'settings' });
    fireEvent.click(screen.getByRole('button', { name: 'Turn on notifications' }));
    expect(onTurnOn).toHaveBeenCalledOnce();
  });

  it('web: only "Notifications work in the iPhone app."', () => {
    setup({ supported: false, status: null });
    expect(screen.getByText('Notifications work in the iPhone app.')).toBeTruthy();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Notifications']);
  });
});
