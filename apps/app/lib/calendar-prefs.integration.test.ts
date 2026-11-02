// @vitest-environment node
// Spec 029 against local Supabase: SC-002 (Eva's calendar settings never change Gabriel's) and US6
// (Gabriel moves Evening to 18:30; new Evening events use it, existing ones keep 18:00–22:00).
// Skipped with a notice when Supabase isn't running locally.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SLOT_TIMES, timeRange } from '@cocon/calendar';
import { loadCalendarSettings, loadEvents, loadMemberCalendarSettings, saveEvent, saveMemberCalendarSettings, setHomeTimeZone, setSlotTimes } from '@cocon/data';
import type { Database } from '@cocon/schemas';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the calendar settings integration test');
if (!local) console.warn('calendar-prefs.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('calendar settings against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let gabriel: Client;
  let eva: Client;
  let familyId: string;
  const person = (name: string) => signInPerson(admin, url, anonKey, `calprefs-${name}-${run}@example.com`, userIds);

  beforeAll(async () => {
    [gabriel, eva] = await Promise.all([person('gabriel'), person('eva')]);
    const fam = await gabriel.rpc('create_family', { family_name: 'Calendar settings test', display_name: 'Gabriel' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
    const invite = await gabriel.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await eva.rpc('accept_invite', { token: invite.data, display_name: 'Eva' });
    if (joined.error) throw joined.error;
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('SC-002 / US5: Gabriel opens on Agenda; Eva’s Week never changes his view', async () => {
    expect((await loadMemberCalendarSettings(gabriel)).opens_on).toBe('month');
    expect((await saveMemberCalendarSettings(gabriel, familyId, { opens_on: 'agenda' })).error).toBeNull();
    expect((await saveMemberCalendarSettings(eva, familyId, { opens_on: 'week', time_format: '12h' })).error).toBeNull();
    expect((await saveMemberCalendarSettings(gabriel, familyId, { fade_past: false })).error).toBeNull();
    expect(await loadMemberCalendarSettings(gabriel)).toMatchObject({ opens_on: 'agenda', time_format: 'automatic', fade_past: false });
    expect(await loadMemberCalendarSettings(eva)).toMatchObject({ opens_on: 'week', time_format: '12h', fade_past: true });
  });

  it('US6: only the owner changes the times of day; existing Evening events keep their hours', async () => {
    const dinner = await saveEvent(eva, { title: 'Dinner', starts_on: '2026-11-10', ends_on: '2026-11-10', time_type: 'slot', slots: ['evening'], members: ['everyone'] });
    const evening = { ...DEFAULT_SLOT_TIMES, afternoon: { start: '14:00', end: '18:30' }, evening: { start: '18:30', end: '22:00' } };

    await expect(setSlotTimes(eva, evening)).rejects.toMatchObject({ message: 'not_owner' });
    expect(await setSlotTimes(gabriel, evening)).toBe(1);
    expect((await loadCalendarSettings(eva)).slotTimes.evening).toEqual({ start: '18:30', end: '22:00' });

    const after = await saveEvent(eva, { title: 'Poker', starts_on: '2026-11-11', ends_on: '2026-11-11', time_type: 'slot', slots: ['evening'], members: ['everyone'] });
    const events = await loadEvents(eva, '2026-11-01', '2026-11-30');
    const slotTimes = (await loadCalendarSettings(eva)).slotTimes;
    const hours = (id: string) => {
      const e = events.find((x) => x.id === id);
      return e && timeRange(e, slotTimes);
    };
    expect(hours(dinner)).toEqual({ start: '18:00', end: '22:00' });
    expect(hours(after)).toEqual({ start: '18:30', end: '22:00' });
  });

  it('FR-010: the owner sets the home time zone; others can’t', async () => {
    await expect(setHomeTimeZone(eva, 'Europe/Paris')).rejects.toMatchObject({ message: 'not_owner' });
    await setHomeTimeZone(gabriel, 'Europe/Paris');
    expect((await loadCalendarSettings(eva)).homeTimeZone).toBe('Europe/Paris');
  });
});
