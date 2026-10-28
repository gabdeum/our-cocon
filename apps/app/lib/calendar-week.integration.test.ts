// @vitest-environment node
// Spec 038 against local Supabase, User Story 1: the week grid built from what Gabriel's app
// loads. Two overlapping custom events share Sunday's column at their exact times; a slot event
// covers its slot; Eva's private event reads "Busy"; a trip spans the All day row.
// Skipped with a notice when local Supabase isn't running (CI starts it).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import { loadEvents, saveEvent } from '@cocon/data';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';
import { eventWindow, memberLook, monthOccurrences } from './calendar-month';
import { layoutWeekGrid } from './calendar-week';
import type { Member } from './session';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the week integration test');
if (!local) console.warn('calendar-week.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('week view against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let gabriel: Client;
  let eva: Client;
  let members: Member[];

  const person = (name: string) => signInPerson(admin, url, anonKey, `week-${name}-${run}@example.com`, userIds);
  const idOf = (name: string) => members.find((m) => m.display_name === name)?.id ?? '';

  beforeAll(async () => {
    [gabriel, eva] = await Promise.all([person('gabriel'), person('eva')]);
    const fam = await gabriel.rpc('create_family', { family_name: 'Week test', display_name: 'Gabriel' });
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

  it('US1: Baby swim and Coffee side by side at their times; Eva’s private event reads Busy', async () => {
    const g = idOf('Gabriel');
    const e = idOf('Eva');
    await saveEvent(eva, { title: 'Baby swim', starts_on: '2026-10-25', ends_on: '2026-10-25', time_type: 'custom', slots: [], start_time: '14:30', end_time: '16:30', members: [e] });
    await saveEvent(gabriel, { title: 'Coffee', starts_on: '2026-10-25', ends_on: '2026-10-25', time_type: 'custom', slots: [], start_time: '16:00', end_time: '17:00', members: [g] });
    await saveEvent(gabriel, { title: 'Movie night', starts_on: '2026-10-25', ends_on: '2026-10-25', time_type: 'slot', slots: ['evening'], members: ['everyone'] });
    await saveEvent(eva, { title: 'Therapist', starts_on: '2026-10-27', ends_on: '2026-10-27', time_type: 'custom', slots: [], start_time: '10:00', end_time: '11:00', members: [e], visibility: 'private' });
    await saveEvent(gabriel, { title: 'Lyon trip', starts_on: '2026-10-29', ends_on: '2026-11-02', time_type: 'all_day', slots: [], members: [e] });

    const { from, to } = eventWindow('2026-10-01');
    const occurrences = monthOccurrences(await loadEvents(gabriel, from, to), from, to, g, new Set());
    const week = layoutWeekGrid('2026-10-25', occurrences, { weekStartsOn: 0, today: '2026-10-25', look: memberLook(members), slotTimes: DEFAULT_SLOT_TIMES, now: '13:20' });
    const sunday = week.columns[0]?.blocks.map((b) => [b.title, b.top, b.y, b.height, b.lane, b.lanes]);
    expect(sunday).toEqual(
      expect.arrayContaining([
        ['Baby swim', 'E', 307, 70, 0, 2],
        ['Coffee', 'G', 361, 34, 1, 2],
        ['Movie night', 'All Evening', 433, 142, 0, 1],
      ]),
    );
    expect(week.columns[2]?.blocks.map((b) => [b.title, b.top])).toEqual([['Busy', 'E 10:00']]);
    expect(week.bars.map((b) => [b.text, b.column, b.days])).toEqual([['E Lyon trip', 4, 3]]);
    expect(week.nowY).toBe(264);
  });
});
