// Spec 029 US4–US6 (design/ui/OC-CalSettings.md): the member's calendar, and the family's times of day.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { DEFAULT_MEMBER_CALENDAR_SETTINGS } from '@cocon/schemas';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import { calendarPrefs } from '../../lib/calendar-prefs';
import { fakeTracker } from '../../test/fakes';
import { CalendarSettings, type CalendarSettingsProps } from './CalendarSettings';

afterEach(cleanup);

function setup(over: Partial<CalendarSettingsProps> = {}) {
  const props: CalendarSettingsProps = {
    prefs: calendarPrefs(DEFAULT_MEMBER_CALENDAR_SETTINGS, 'US', true),
    onChange: vi.fn().mockResolvedValue('saved'),
    slotTimes: DEFAULT_SLOT_TIMES,
    homeTimeZone: 'America/New_York',
    isOwner: true,
    ownerName: 'Gabriel',
    onSaveSlots: vi.fn().mockResolvedValue(undefined),
    onSetTimeZone: vi.fn().mockResolvedValue(undefined),
    phoneTimeZone: 'Europe/Paris',
    onOpenAi: vi.fn(),
    onBack: vi.fn(),
    tracker: fakeTracker(),
    ...over,
  };
  render(<CalendarSettings {...props} />);
  return props;
}

const flush = () => act(async () => undefined);

describe('Calendar settings (OC-CalSettings)', () => {
  it('reads like the screen: back to the Menu, For you, Times of day, Family', () => {
    const { onBack } = setup();
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['Calendar', 'For you', 'Times of day', 'Family']);
    expect(screen.getByText("How the family calendar looks for you, and the family's times of day.")).toBeTruthy();
    fireEvent.click(screen.getByRole('link', { name: 'Menu' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('US4: every option says what it does', () => {
    setup();
    for (const hint of [
      "Automatic follows this phone's region",
      "Automatic follows this phone's settings",
      'Also on Home, 3 days ahead',
      "So today and what's next stand out",
      'Used by the whole family when you pick a time of day. Only Gabriel, the family owner, can change them.',
      'Let Claude, ChatGPT or Gemini add events',
    ])
      expect(screen.getByText(hint)).toBeTruthy();
    expect(screen.getByText('New York (Eastern Time)')).toBeTruthy();
  });

  it('US5: "Opens on: Agenda" saves for this member', async () => {
    const { onChange } = setup();
    const opensOn = screen.getByRole('group', { name: 'Opens on' });
    fireEvent.click(within(opensOn).getByRole('button', { name: 'Agenda' }));
    await flush();
    expect(onChange).toHaveBeenCalledWith({ opens_on: 'agenda' });
    fireEvent.click(screen.getByRole('switch', { name: /Show birthdays/ }));
    await flush();
    expect(onChange).toHaveBeenLastCalledWith({ show_birthdays: false });
  });

  it('US6: the owner moves Evening to 18:30; Afternoon ends there too', async () => {
    const { onSaveSlots, tracker } = setup();
    fireEvent.click(screen.getByRole('link', { name: 'Evening, 18:00–22:00' }));
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '18:30' } });
    expect(screen.getByText('Afternoon will end at 18:30.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await flush();
    expect(onSaveSlots).toHaveBeenCalledWith({
      ...DEFAULT_SLOT_TIMES,
      afternoon: { start: '14:00', end: '18:30' },
      evening: { start: '18:30', end: '22:00' },
    });
    expect(tracker.track).toHaveBeenCalledWith('calendar_settings_changed', { setting: 'times_of_day', value: 'evening' });
  });

  it("refuses times that would squeeze out the slot before: Evening has to start when Afternoon ends", async () => {
    const { onSaveSlots } = setup();
    fireEvent.click(screen.getByRole('link', { name: 'Evening, 18:00–22:00' }));
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '13:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await flush();
    expect(screen.getByText("Times can't overlap. Evening has to start when Afternoon ends.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Starts'), { target: { value: '7pm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await flush();
    expect(screen.getByText('Use a time like 18:30.')).toBeTruthy();
    expect(onSaveSlots).not.toHaveBeenCalled();
  });

  it('others see the times of day without chevrons, and no time zone sheet', () => {
    setup({ isOwner: false });
    expect(screen.queryByRole('link', { name: /Evening/ })).toBeNull();
    expect(screen.getByText('18:00–22:00')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /Home time zone/ })).toBeNull();
  });

  it('FR-010: the owner uses this phone’s time zone; AI assistants opens its page', async () => {
    const { onSetTimeZone, onOpenAi, tracker } = setup();
    fireEvent.click(screen.getByRole('link', { name: /Home time zone/ }));
    fireEvent.click(screen.getByRole('button', { name: "Use this phone's time zone (Paris (Central European Time))" }));
    await flush();
    expect(onSetTimeZone).toHaveBeenCalledWith('Europe/Paris');
    expect(tracker.track).toHaveBeenCalledWith('calendar_settings_changed', { setting: 'home_time_zone', value: 'phone' });
    fireEvent.click(screen.getByRole('link', { name: /AI assistants/ }));
    expect(onOpenAi).toHaveBeenCalledOnce();
  });

  it('shows times in 12-hour time when the member picks it', () => {
    setup({ prefs: calendarPrefs({ ...DEFAULT_MEMBER_CALENDAR_SETTINGS, time_format: '12h' }, 'US', true) });
    expect(screen.getByText('6:00 PM–10:00 PM')).toBeTruthy();
  });

  it('offline: shows the saved values, and nothing can change', () => {
    setup({ readOnly: true });
    expect(within(screen.getByRole('group', { name: 'Opens on' })).getByRole('button', { name: 'Month' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('group', { name: 'Opens on' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.queryByRole('link', { name: /Evening/ })).toBeNull();
  });
});
