// @vitest-environment node
// Spec 040 against local Supabase, User Story 1: the agenda built from what Gabriel's app loads
// for its first 4 weeks. Today, Tomorrow, then the date; empty days skipped; Eva's private event
// as "Busy"; a trip on each of its days with "Day N of M"; "Gabriel takes James" when no place.
// Skipped with a notice when local Supabase isn't running (CI starts it).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import { loadEvents, saveEvent } from '@cocon/data';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';
import { agendaWindow, layoutAgenda } from './calendar-agenda';
import { memberLook, monthOccurrences } from './calendar-month';
import { familyApi } from './family';
import type { Member } from './session';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the agenda integration test');
if (!local) console.warn('calendar-agenda.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('agenda view against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let gabriel: Client;
  let eva: Client;
  let members: Member[];

  const person = (name: string) => signInPerson(admin, url, anonKey, `agenda-${name}-${run}@example.com`, userIds);
  const idOf = (name: string) => members.find((m) => m.display_name === name)?.id ?? '';

  beforeAll(async () => {
    [gabriel, eva] = await Promise.all([person('gabriel'), person('eva')]);
    const fam = await gabriel.rpc('create_family', { family_name: 'Agenda test', display_name: 'Gabriel' });
    if (fam.error) throw fam.error;
    const invite = await gabriel.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await eva.rpc('accept_invite', { token: invite.data, display_name: 'Eva' });
    if (joined.error) throw joined.error;
    const james = await familyApi(gabriel).addManagedMember('James');
    if (!james.ok) throw new Error(james.error);
    const all = await gabriel.from('members').select('*').order('joined_at');
    if (all.error) throw all.error;
    members = all.data;
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('US1: the days with events from today, as Gabriel sees them', async () => {
    const [g, e, j] = [idOf('Gabriel'), idOf('Eva'), idOf('James')];
    const today = '2026-10-25';
    const on = (date: string) => ({ starts_on: date, ends_on: date });
    await saveEvent(gabriel, { ...on(today), title: 'Brunch', time_type: 'slot', slots: ['lunch'], location: 'Grandma’s house', members: ['everyone'] });
    await saveEvent(eva, { ...on('2026-10-26'), title: 'Baby swim class', time_type: 'custom', slots: [], start_time: '14:30', end_time: '16:30', members: [j], responsible_member_id: g });
    await saveEvent(eva, { ...on('2026-10-26'), title: 'Therapist', time_type: 'custom', slots: [], start_time: '10:00', end_time: '11:00', location: 'Dr. Kay', members: [e], visibility: 'private' });
    await saveEvent(gabriel, { title: 'Lyon trip', starts_on: '2026-10-28', ends_on: '2026-10-29', time_type: 'all_day', slots: [], members: [e] });
    await saveEvent(gabriel, { ...on('2026-10-20'), title: 'Last week', time_type: 'slot', slots: ['morning'], members: [g] });

    const { from, to } = agendaWindow(today, 1);
    const occurrences = monthOccurrences(await loadEvents(gabriel, from, to), from, to, g, new Set());
    const groups = layoutAgenda(from, to, occurrences, { today, now: '12:30', look: memberLook(members), slotTimes: DEFAULT_SLOT_TIMES, members });

    expect(groups.map((d) => [d.heading, d.events.map((r) => [r.title, r.sub, r.tag?.label ?? null])])).toEqual([
      ['Today · Sun, Oct 25', [['Brunch', 'Lunch · Grandma’s house', 'Now']]],
      [
        'Tomorrow · Mon, Oct 26',
        [
          ['Busy', '10:00', null],
          ['Baby swim class', '14:30 · Gabriel takes James', null],
        ],
      ],
      ['Wed, Oct 28', [['Lyon trip', 'All day', 'Day 1 of 2']]],
      ['Thu, Oct 29', [['Lyon trip', 'All day', 'Day 2 of 2']]],
    ]);
  });
});
