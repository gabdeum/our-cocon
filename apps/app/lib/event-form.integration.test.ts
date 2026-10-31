// @vitest-environment node
// Spec 041 against local Supabase, through the sheet's own rules and the shared data layer.
// US2: Gabriel + James every Saturday, Gabriel takes James. FR-009: Undo after adding leaves no
// trace in Recently deleted. FR-008: "This event only" and "All future events" on a repeating event.
// Skipped with a notice when local Supabase isn't running (CI starts it).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';
import { loadEvent, loadEvents, saveEvent, saveException, splitEvent, undoCreateEvent } from '@cocon/data';
import { monthOccurrences } from './calendar-month';
import { draftFromEvent, futureSplit, newDraft, overrideFor, toInput } from './event-form';
import type { Member } from './session';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the add event integration test');
if (!local) console.warn('event-form.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('add and edit an event against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let gabriel: Client;
  let familyId: string;
  let members: Member[];
  let me: string;
  let james: string;

  beforeAll(async () => {
    gabriel = await signInPerson(admin, url, anonKey, `addevent-gabriel-${run}@example.com`, userIds);
    const fam = await gabriel.rpc('create_family', { family_name: 'Add event test', display_name: 'Gabriel' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
    const added = await gabriel.rpc('add_managed_member', { name: 'James' });
    if (added.error) throw added.error;
    james = added.data;
    const rows = await gabriel.from('members').select('*').order('joined_at');
    if (rows.error) throw rows.error;
    members = rows.data;
    me = members.find((m) => m.user_id !== null)?.id ?? '';
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('US2: every Saturday shows the class for Gabriel and James, with Gabriel taking James', async () => {
    const draft = { ...newDraft({ slot: 'morning' }, '2026-10-28'), title: 'Baby music class', who: [me, james], repeat: 'weekly' as const, weekdays: [6], location: 'Little Notes studio', responsible: me };
    await saveEvent(gabriel, toInput(draft, members));
    const days = monthOccurrences(await loadEvents(gabriel, '2026-10-25', '2026-11-21'), '2026-10-25', '2026-11-21', me, new Set());
    expect(days.map((o) => o.starts_on)).toEqual(['2026-10-31', '2026-11-07', '2026-11-14', '2026-11-21']);
    expect(days.every((o) => [...o.members].sort().join() === [me, james].sort().join() && o.view === 'full' && o.responsible_member_id === me && o.location === 'Little Notes studio')).toBe(true);
  });

  it('FR-009: Undo removes the new event for good, not to Recently deleted', async () => {
    const id = await saveEvent(gabriel, toInput({ ...newDraft({ slot: 'evening' }, '2026-10-28'), title: 'Poker night' }, members));
    await undoCreateEvent(gabriel, id);
    expect(await loadEvent(gabriel, id)).toBeNull();
    const left = await admin.from('events').select('id').eq('id', id);
    expect(left.data).toEqual([]);
  });

  it('FR-008: "This event only" changes one Wednesday; "All future events" moves the rest', async () => {
    const id = await saveEvent(gabriel, toInput({ ...newDraft({ slot: 'evening' }, '2026-11-04'), title: 'Choir', repeat: 'weekly' }, members));
    const series = await loadEvent(gabriel, id);
    if (!series) throw new Error('Choir not saved');

    // This event only: Nov 11 moves to Thursday afternoon.
    const one = draftFromEvent(series, '2026-11-11');
    const before = toInput(one, members, { occurrence: true });
    const after = toInput({ ...one, date: '2026-11-12', time: { kind: 'slot', slots: ['afternoon'] } }, members, { occurrence: true });
    await saveException(gabriel, familyId, id, { occurrence_date: '2026-11-11', override: overrideFor(before, after) });

    // All future events from Nov 25: lunch instead of the evening.
    const fresh = await loadEvent(gabriel, id);
    if (!fresh) throw new Error('Choir gone');
    const future = draftFromEvent(fresh, '2026-11-25');
    const split = futureSplit(fresh, '2026-11-25', toInput({ ...future, time: { kind: 'slot', slots: ['lunch'] } }, members));
    if (!split) throw new Error('Nov 25 is not the first Choir');
    const newId = await splitEvent(gabriel, id, '2026-11-25', split.before, split.input);

    const days = monthOccurrences(await loadEvents(gabriel, '2026-11-01', '2026-12-09'), '2026-11-01', '2026-12-09', me, new Set()).filter((o) => o.title === 'Choir');
    expect(days.map((o) => `${o.starts_on} ${o.slots.join()}`)).toEqual([
      '2026-11-04 evening',
      '2026-11-12 afternoon',
      '2026-11-18 evening',
      '2026-11-25 lunch',
      '2026-12-02 lunch',
      '2026-12-09 lunch',
    ]);
    expect(days.slice(3).every((o) => o.id === newId)).toBe(true);
  });
});
