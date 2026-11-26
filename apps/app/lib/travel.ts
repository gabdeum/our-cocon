import { useQuery } from '@tanstack/react-query';
import { parts, timeIn, todayIn, zonedInstant } from '@cocon/calendar';
import { loadMemberTravel, type CalendarSettings, type MemberTravel } from '@cocon/data';
import { deviceTimeZone } from './clock';
import { useSession } from './session';

/** Spec 071: the member's own travel settings, by person. */
export const memberTravelKey = (userId: string) => ['member_calendar_settings', userId, 'travel'] as const;

export function useMemberTravel() {
  const { state, client } = useSession();
  const userId = state.status === 'ready' ? state.userId : '';
  return useQuery({ queryKey: memberTravelKey(userId), queryFn: () => loadMemberTravel(client), enabled: userId !== '' });
}

/**
 * FR-004: the time zone the member's "today", "now" and reminders follow: their own while they keep
 * their times elsewhere, else the family's, else this phone's until one is set.
 */
export function useTimeZone(family: Pick<CalendarSettings, 'homeTimeZone'> | null | undefined): string {
  const travel = useMemberTravel();
  return travel.data?.awayTimeZone ?? family?.homeTimeZone ?? deviceTimeZone();
}

/** Minutes `a` is ahead of `b` at `now` (New York is -360 from Paris in winter). */
export function zoneDifference(a: string, b: string, now: Date = new Date()): number {
  const wall = (tz: string) => {
    const { year, month, day } = parts(todayIn(tz, now));
    const [h, m] = timeIn(tz, now).split(':').map(Number) as [number, number];
    return Date.UTC(year, month - 1, day, h, m) / 60_000;
  };
  return wall(a) - wall(b);
}

/** Two zones that show the same time now (Paris and Berlin) count as one. */
export const sameClock = (a: string, b: string, now?: Date) => a === b || zoneDifference(a, b, now) === 0;

export type TravelStep =
  /** Nothing to do. */
  | { kind: 'none' }
  /** FR-001: the phone is on another clock than the member's times: ask (the drawer). */
  | { kind: 'ask'; zone: string }
  /** FR-005: the phone is back on the family's clock: the member's own times go back, without asking. */
  | { kind: 'back' };

/**
 * FR-001, FR-005: what to do when the app opens or comes back, from the family's time zone, the
 * member's own settings and this phone's zone. Not asked again about a zone they said no to, nor
 * about the one their times already follow.
 */
export function travelStep(family: string | null, travel: MemberTravel, device: string, now?: Date): TravelStep {
  if (!family) return { kind: 'none' };
  if (sameClock(device, family, now)) return travel.awayTimeZone || travel.askedTimeZone ? { kind: 'back' } : { kind: 'none' };
  if (travel.awayTimeZone && sameClock(device, travel.awayTimeZone, now)) return { kind: 'none' };
  if (!travel.awayTimeZone && travel.askedTimeZone && sameClock(device, travel.askedTimeZone, now)) return { kind: 'none' };
  return { kind: 'ask', zone: device };
}

/** FR-002's example: what 16:00 on the family's clock is on the phone's, today ("10:00" in New York from Paris). */
export function familyTimeHere(home: string, here: string, time = '16:00', now: Date = new Date()): string {
  return timeIn(here, zonedInstant(todayIn(home, now), time, home));
}

/** "America/New_York" → "New York". */
export const cityOf = (timeZone: string) => (timeZone.split('/').pop() ?? timeZone).replace(/_/g, ' ');
