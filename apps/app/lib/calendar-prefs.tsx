import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DEFAULT_MEMBER_CALENDAR_SETTINGS, type MemberCalendarSettings, type MemberCalendarSettingsUpdate, type Tracker } from '@cocon/schemas';
import { loadMemberCalendarSettings, saveMemberCalendarSettings } from '@cocon/data';
import { uses24h, weekStartFor, type WeekStartsOn } from '@cocon/calendar';
import { deviceRegion } from './calendar-header';
import { useSession } from './session';
import type { Client } from './supabase';
import { optimisticWrite } from './write';

/** Spec 029 FR-007: the member's own calendar settings, by person (never the family's). */
export const memberCalendarSettingsKey = (userId: string) => ['member_calendar_settings', userId] as const;

/** Whether this device shows a 24-hour clock ("Automatic follows this phone's settings"). 24-hour when it can't say. */
export function device24h(): boolean {
  try {
    const cycle = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).resolvedOptions().hourCycle;
    return cycle === undefined || cycle === 'h23' || cycle === 'h24';
  } catch {
    return true;
  }
}

/** What the calendar screens need from the settings: the view it opens on, the week start and the clock. */
export interface CalendarPrefs extends MemberCalendarSettings {
  weekStartsOn: WeekStartsOn;
  use24h: boolean;
}

export function calendarPrefs(settings: MemberCalendarSettings, region: string | null = deviceRegion(), device = device24h()): CalendarPrefs {
  return { ...settings, weekStartsOn: weekStartFor(settings.week_start, region), use24h: uses24h(settings.time_format, device) };
}

// The default reminder is Menu › Notifications' (spec 046): it sends `notification_settings_changed`.
type Tracked = Exclude<keyof MemberCalendarSettings, 'month_hint_seen' | 'default_reminder'>;

/** Shown at once and saved; reverts on failure. Each "For you" change is tracked with its new value. */
export async function changeCalendarPrefs(
  deps: { queryClient: ReturnType<typeof useQueryClient>; client: Pick<Client, 'from'>; tracker: Tracker; familyId: string; userId: string },
  change: MemberCalendarSettingsUpdate,
): Promise<'saved' | 'failed'> {
  const { queryClient, client, tracker, familyId, userId } = deps;
  const result = await optimisticWrite<MemberCalendarSettings>(
    queryClient,
    memberCalendarSettingsKey(userId),
    (s) => ({ ...(s ?? DEFAULT_MEMBER_CALENDAR_SETTINGS), ...change }),
    () => saveMemberCalendarSettings(client, familyId, change),
  );
  if (result === 'saved')
    for (const [setting, value] of Object.entries(change) as [keyof MemberCalendarSettings, MemberCalendarSettings[keyof MemberCalendarSettings]][]) {
      if (setting === 'month_hint_seen') continue;
      if (setting === 'default_reminder') {
        tracker.track('notification_settings_changed', { setting, value: value as MemberCalendarSettings['default_reminder'] });
        continue;
      }
      tracker.track('calendar_settings_changed', { setting: setting satisfies Tracked, value: typeof value === 'boolean' ? (value ? 'on' : 'off') : (value as MemberCalendarSettings['opens_on' | 'week_start' | 'time_format']) });
    }
  return result;
}

/** The member's calendar settings for a screen, and a way to change them. Defaults until loaded. */
export function useCalendarPrefs() {
  const { state, client, tracker } = useSession();
  const queryClient = useQueryClient();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const userId = state.status === 'ready' ? state.userId : '';
  const query = useQuery({ queryKey: memberCalendarSettingsKey(userId), queryFn: () => loadMemberCalendarSettings(client), enabled: familyId !== null && userId !== '' });
  const prefs = useMemo(() => calendarPrefs(query.data ?? DEFAULT_MEMBER_CALENDAR_SETTINGS), [query.data]);
  const change = (update: MemberCalendarSettingsUpdate) =>
    familyId ? changeCalendarPrefs({ queryClient, client, tracker, familyId, userId }, update) : Promise.resolve('failed' as const);
  return { prefs, loaded: query.data !== undefined, change };
}

// Outside the provider (component tests): the screens as drawn, 24-hour.
const CalendarPrefsContext = createContext<{ prefs: CalendarPrefs; loaded: boolean }>({ prefs: calendarPrefs(DEFAULT_MEMBER_CALENDAR_SETTINGS, deviceRegion(), true), loaded: false });

/** The signed-in member's calendar settings for every screen that shows dates and times (root layout). */
export function CalendarPrefsProvider({ children }: { children: ReactNode }) {
  const { prefs, loaded } = useCalendarPrefs();
  const value = useMemo(() => ({ prefs, loaded }), [prefs, loaded]);
  return <CalendarPrefsContext.Provider value={value}>{children}</CalendarPrefsContext.Provider>;
}

/** What the member chose (week start, clock, birthdays, fade); 24-hour defaults outside the provider. */
export function useCalendarDisplay() {
  return useContext(CalendarPrefsContext);
}
