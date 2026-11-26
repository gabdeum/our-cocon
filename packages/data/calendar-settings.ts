import { DEFAULT_MEMBER_CALENDAR_SETTINGS, MemberCalendarSettings, MemberCalendarSettingsUpdate, SlotTimes, TimeZone } from '@cocon/schemas';
import type { Db } from './client';

/** Spec 029 FR-007: the signed-in member's own calendar settings (RLS returns only theirs), or the defaults. */
export async function loadMemberCalendarSettings(client: Pick<Db, 'from'>): Promise<MemberCalendarSettings> {
  const { data, error } = await client
    .from('member_calendar_settings')
    .select('opens_on, week_start, time_format, show_birthdays, fade_past, month_hint_seen, default_reminder, quiet_from, quiet_to')
    .maybeSingle();
  if (error) throw error;
  return data ? MemberCalendarSettings.parse(data) : DEFAULT_MEMBER_CALENDAR_SETTINGS;
}

/** Saves a change to the member's own settings (upsert: the first change makes the row). */
export async function saveMemberCalendarSettings(client: Pick<Db, 'from'>, familyId: string, change: MemberCalendarSettingsUpdate): Promise<{ error: unknown }> {
  const valid = MemberCalendarSettingsUpdate.safeParse(change);
  if (!valid.success) return { error: valid.error };
  const { error } = await client.from('member_calendar_settings').upsert({ ...valid.data, family_id: familyId }, { onConflict: 'family_id,user_id' });
  return { error };
}

/**
 * FR-009, owner only: the family's times of day. Events on a slot whose hours change keep them
 * (they become custom times); returns how many were pinned.
 */
export async function setSlotTimes(client: Pick<Db, 'rpc'>, slotTimes: SlotTimes): Promise<number> {
  const { data, error } = await client.rpc('set_slot_times', { p_times: SlotTimes.parse(slotTimes) });
  if (error) throw error;
  return data;
}

/** FR-010, owner only: the family's home time zone. */
export async function setHomeTimeZone(client: Pick<Db, 'rpc'>, timeZone: string): Promise<void> {
  const { error } = await client.rpc('set_home_time_zone', { tz: TimeZone.parse(timeZone) });
  if (error) throw error;
}

/** Spec 071: the time zone the member keeps their times on while away (null: home time), and the last one the app asked about. */
export interface MemberTravel {
  awayTimeZone: string | null;
  askedTimeZone: string | null;
}

/** The signed-in member's own travel settings (RLS returns only theirs). */
export async function loadMemberTravel(client: Pick<Db, 'from'>): Promise<MemberTravel> {
  const { data, error } = await client.from('member_calendar_settings').select('away_time_zone, asked_time_zone').maybeSingle();
  if (error) throw error;
  return { awayTimeZone: data?.away_time_zone ?? null, askedTimeZone: data?.asked_time_zone ?? null };
}

/** Spec 071: whose times move: the member's own ("my time zone"), or the whole family's (the family's time zone). */
export type TravelScope = 'me' | 'family';

/**
 * Spec 071 FR-003, FR-005, FR-007: keep times on `away` (null: the family's again), having asked
 * about `asked`, for the member or the whole family (its time zone moves). Reminders with a time
 * keep their clock time; returns how many moved.
 */
export async function setAwayTimeZone(client: Pick<Db, 'rpc'>, away: string | null, asked: string | null, scope: TravelScope = 'me'): Promise<number> {
  const args = { p_away: away === null ? null : TimeZone.parse(away), p_asked: asked === null ? null : TimeZone.parse(asked), p_scope: scope };
  // Both zones may be null; the generated types don't say so.
  const { data, error } = await client.rpc('set_away_time_zone', args as { p_away: string; p_asked: string; p_scope: TravelScope });
  if (error) throw error;
  return data;
}
