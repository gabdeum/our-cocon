// @vitest-environment node
// Spec 039 against local Supabase, User Story 1: the day built from what Gabriel's app loads.
// Who's busy with counts, Brunch in Lunch for Everyone, Baby swim in the Afternoon with "Gabriel
// takes James", Eva's private event as "Busy" with no driver, a trip's "Day 2 of 3", empty bands.
// Skipped with a notice when local Supabase isn't running (CI starts it).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import { loadEvents, saveEvent } from '@cocon/data';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';
import { layoutDayView } from './calendar-day';
import { eventWindow, memberLook, monthOccurrences } from './calendar-month';
import { familyApi } from './family';
import type { Member } from './session';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the day integration test');
if (!local) console.warn('calendar-day.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('day view against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let gabriel: Client;
  let eva: Client;
  let members: Member[];

  const person = (name: string) => signInPerson(admin, url, anonKey, `day-${name}-${run}@example.com`, userIds);
  const idOf = (name: string) => members.find((m) => m.display_name === name)?.id ?? '';

  beforeAll(async () => {
    [gabriel, eva] = await Promise.all([person('gabriel'), person('eva')]);
    const fam = await gabriel.rpc('create_family', { family_name: 'Day test', display_name: 'Gabriel' });
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

  it('US1: who’s busy, All day, and the bands of Wednesday as Gabriel sees them', async () => {
    const [g, e, j] = [idOf('Gabriel'), idOf('Eva'), idOf('James')];
    const day = '2026-10-28';
    const one = { starts_on: day, ends_on: day };
    await saveEvent(gabriel, { ...one, title: 'Brunch', time_type: 'slot', slots: ['lunch'], location: 'Grandma’s house', members: ['everyone'] });
    await saveEvent(eva, { ...one, title: 'Baby swim class', time_type: 'custom', slots: [], start_time: '14:30', end_time: '16:30', location: 'Aquatic Center', members: [j], responsible_member_id: g });
    await saveEvent(eva, { ...one, title: 'Therapist', time_type: 'custom', slots: [], start_time: '10:00', end_time: '11:00', location: 'Dr. Kay', members: [e], visibility: 'private' });
    await saveEvent(gabriel, { title: 'Lyon trip', starts_on: '2026-10-27', ends_on: '2026-10-29', time_type: 'all_day', slots: [], members: [e] });

    const { from, to } = eventWindow('2026-10-01');
    const occurrences = monthOccurrences(await loadEvents(gabriel, from, to), from, to, g, new Set());
    const view = layoutDayView(day, occurrences, { today: day, now: '15:00', look: memberLook(members), slotTimes: DEFAULT_SLOT_TIMES, members });

    expect(view.busy.map((c) => c.text)).toEqual(['Eva 2', 'James 1', 'Everyone 1']);
    expect(view.allDay.map((a) => [a.title, a.tag])).toEqual([['Lyon trip', 'Day 2 of 3']]);
    expect(view.bands.map((b) => b.events.map((r) => [r.title, r.time, r.driver, r.nowText]))).toEqual([
      [],
      [['Busy', '10:00', null, null]],
      [['Brunch', 'Lunch · Grandma’s house', null, null]],
      [['Baby swim class', '14:30 · Aquatic Center', 'Gabriel takes James', 'Now']],
      [],
    ]);
    expect(view.bands[0]?.addText).toBe('+ Add in the early morning');
  });
});
