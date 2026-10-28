// @vitest-environment node
// Spec 037 against local Supabase, User Story 1: the month grid built from what Gabriel's app
// loads. A one-off event, a weekly one and a multi-day visit land on their days; Eva's private
// event reads "Busy" in her color.
// Skipped with a notice when local Supabase isn't running (CI starts it).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import { loadEvents, saveEvent } from '@cocon/data';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';
import { eventWindow, layoutWeek, memberLook, monthOccurrences, monthRange, weekIndexOf } from './calendar-month';
import type { Member } from './session';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the month integration test');
if (!local) console.warn('calendar-month.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('month view against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let gabriel: Client;
  let eva: Client;
  let members: Member[];

  const person = (name: string) => signInPerson(admin, url, anonKey, `month-${name}-${run}@example.com`, userIds);
  const idOf = (name: string) => members.find((m) => m.display_name === name)?.id ?? '';

  beforeAll(async () => {
    [gabriel, eva] = await Promise.all([person('gabriel'), person('eva')]);
    const fam = await gabriel.rpc('create_family', { family_name: 'Month test', display_name: 'Gabriel' });
    if (fam.error) throw fam.error;
    const invite = await gabriel.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await eva.rpc('accept_invite', { token: invite.data, display_name: 'Eva' });
    if (joined.error) throw joined.error;
    const all = await gabriel.from('members').select('*').order('joined_at');
    if (all.error) throw all.error;
    members = all.data;
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('US1: chips, repeats, a multi-day bar and Busy, as Gabriel sees them', async () => {
    const g = idOf('Gabriel');
    const e = idOf('Eva');
    await saveEvent(gabriel, { title: 'Dentist', starts_on: '2026-10-29', ends_on: '2026-10-29', time_type: 'slot', slots: ['morning'], members: [g] });
    await saveEvent(eva, { title: 'Yoga', starts_on: '2026-10-06', ends_on: '2026-10-06', time_type: 'slot', slots: ['evening'], members: [e], recurrence: { freq: 'weekly', ends: { type: 'never' } } });
    await saveEvent(gabriel, { title: 'Grandma visits', starts_on: '2026-10-16', ends_on: '2026-10-19', time_type: 'all_day', slots: [], members: ['everyone'] });
    await saveEvent(eva, { title: 'Therapist', starts_on: '2026-10-22', ends_on: '2026-10-22', time_type: 'slot', slots: ['afternoon'], members: [e], visibility: 'private' });

    const { from, to } = eventWindow('2026-10-01');
    const occurrences = monthOccurrences(await loadEvents(gabriel, from, to), from, to, g, new Set());
    const range = monthRange('2026-10-25', 0);
    const ctx = { range, today: '2026-10-25', look: memberLook(members), slotTimes: DEFAULT_SLOT_TIMES };
    const chipsOn = (date: string) =>
      layoutWeek(weekIndexOf(range, date), occurrences, ctx)
        .cells.find((c) => c.date === date)
        ?.items.map((i) => (i.kind === 'chip' ? i.text : '·'));

    expect(chipsOn('2026-10-29')).toEqual(['G Dentist']);
    expect(chipsOn('2026-10-27')).toEqual(['E Yoga']);
    expect(chipsOn('2026-11-24')).toEqual(['E Yoga']);
    expect(chipsOn('2026-10-22')).toEqual(['E Busy']);
    expect(layoutWeek(weekIndexOf(range, '2026-10-16'), occurrences, ctx).bars.map((b) => b.text)).toEqual(['All Grandma visits']);
    expect(layoutWeek(weekIndexOf(range, '2026-10-18'), occurrences, ctx).bars.map((b) => b.text)).toEqual(['All Grandma visits (cont.)']);
  });
});
