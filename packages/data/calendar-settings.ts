import { DEFAULT_MEMBER_CALENDAR_SETTINGS, MemberCalendarSettings, MemberCalendarSettingsUpdate, SlotTimes, TimeZone } from '@cocon/schemas';
import type { Db } from './client';

/** Spec 029 FR-007: the signed-in member's own calendar settings (RLS returns only theirs), or the defaults. */
export async function loadMemberCalendarSettings(client: Pick<Db, 'from'>): Promise<MemberCalendarSettings> {
  const { data, error } = await client
    .from('member_calendar_settings')
    .select('opens_on, week_start, time_format, show_birthdays, fade_past, month_hint_seen, default_reminder')
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
