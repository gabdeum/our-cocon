// @vitest-environment node
// Spec 042 against local Supabase: deleting one date, that date and after, or a whole event, each
// with its Undo (US2, FR-004), and what Recently deleted lists; Duplicate and its Undo (FR-003); a
// view-only link from the sheet to the share endpoint and back to nothing once stopped (FR-005).
// Skipped with a notice when local Supabase isn't running (CI starts it).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { addDays, expand, todayIn } from '@cocon/calendar';
import { loadEvent, loadEvents, saveEvent, saveException, type StoredEvent } from '@cocon/data';
import type { Database } from '@cocon/schemas';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';
import type { Member } from './session';

vi.mock('expo-image-picker', () => ({}));
vi.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: { JPEG: 'jpeg' } }));
vi.mock('expo-crypto', () => ({ randomUUID }));
vi.mock('expo-clipboard', () => ({ setStringAsync: vi.fn() }));
vi.mock('expo-linking', () => ({ createURL: (p: string) => `ourcocon://${p}` }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, Share: { share: vi.fn() } }));

const { deleteOccurrences, duplicateEvent, duplicateInput } = await import('./event-delete');
const { openEventShareLink, stopEventShareLink } = await import('./event-share');
const { loadDeletedEventItems } = await import('./recently-deleted');

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the event actions integration test');
if (!local) console.warn('event-actions.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('event page actions against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let gabriel: Client;
  let eva: Client;
  let familyId: string;
  let members: Member[];
  let gabrielMember: string;
  let evaMember: string;

  const person = (name: string) => signInPerson(admin, url, anonKey, `actions-${name}-${run}@example.com`, userIds);
  const load = async (id: string): Promise<StoredEvent> => {
    const e = await loadEvent(gabriel, id);
    if (!e) throw new Error('event not found');
    return e;
  };
  const days = (e: StoredEvent, from: string, to: string) => expand(e, from, to, e.exceptions).map((o) => o.starts_on);

  beforeAll(async () => {
    [gabriel, eva] = await Promise.all([person('gabriel'), person('eva')]);
    const fam = await gabriel.rpc('create_family', { family_name: 'Actions test', display_name: 'Gabriel' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
    const invite = await gabriel.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await eva.rpc('accept_invite', { token: invite.data, display_name: 'Eva' });
    if (joined.error) throw joined.error;
    const all = await gabriel.from('members').select('*');
    if (all.error) throw all.error;
    members = all.data;
    gabrielMember = members.find((m) => m.display_name === 'Gabriel')?.id ?? '';
    evaMember = members.find((m) => m.display_name === 'Eva')?.id ?? '';
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  /** Eva's weekly music class from Oct 3, Saturdays, with Oct 31 moved to the afternoon; each test its own. */
  async function music(title = 'Baby music class'): Promise<string> {
    const id = await saveEvent(eva, {
      title,
      starts_on: '2026-10-03',
      ends_on: '2026-10-03',
      time_type: 'slot',
      slots: ['morning'],
      recurrence: { freq: 'weekly', weekdays: [6], ends: { type: 'never' } },
      members: [evaMember],
      checklist: [{ label: 'Shaker' }],
    });
    await saveException(eva, familyId, id, { occurrence_date: '2026-10-31', override: { slots: ['afternoon'] } });
    return id;
  }

  it('US2 "Only this one": that date goes, and Undo brings it back as it was', async () => {
    const id = await music();
    const undo = await deleteOccurrences(gabriel, { event: await load(id), date: '2026-10-31', scope: 'this', familyId });
    expect(days(await load(id), '2026-10-24', '2026-11-07')).toEqual(['2026-10-24', '2026-11-07']);
    await undo();
    const back = await load(id);
    expect(days(back, '2026-10-24', '2026-11-07')).toEqual(['2026-10-24', '2026-10-31', '2026-11-07']);
    expect(back.exceptions).toEqual([{ occurrence_date: '2026-10-31', cancelled: false, override: { slots: ['afternoon'] } }]);
  });

  it('US2 "This and all future ones": the dates from then on sit in Recently deleted, and Undo brings them back', async () => {
    const id = await music('Music, future');
    const undo = await deleteOccurrences(gabriel, { event: await load(id), date: '2026-11-14', scope: 'future', familyId });
    const shown = await loadEvents(gabriel, '2026-11-01', '2026-11-30');
    expect(shown.filter((e) => e.title === 'Music, future').flatMap((e) => days(e, '2026-11-01', '2026-11-30'))).toEqual(['2026-11-07']);
    const deleted = await loadDeletedEventItems(gabriel, gabrielMember);
    expect(deleted[0]).toMatchObject({ kind: 'event', name: 'Music, future' });
    await undo();
    const again = await loadEvents(gabriel, '2026-11-01', '2026-11-30');
    expect(again.filter((e) => e.title === 'Music, future').flatMap((e) => days(e, '2026-11-01', '2026-11-30')).sort()).toEqual(['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28']);
  });

  it('"This and all future ones" on the first date deletes the whole event', async () => {
    const id = await music();
    await deleteOccurrences(gabriel, { event: await load(id), date: '2026-10-03', scope: 'future', familyId });
    expect((await load(id)).deleted_at).not.toBeNull();
  });

  it('a one-off event goes to Recently deleted with who deleted it; Undo restores it', async () => {
    const id = await saveEvent(eva, { title: 'Dentist', starts_on: '2026-11-03', ends_on: '2026-11-03', time_type: 'all_day', members: [evaMember] });
    const undo = await deleteOccurrences(gabriel, { event: await load(id), date: '2026-11-03', scope: 'all', familyId });
    const listed = (await loadDeletedEventItems(eva, evaMember)).find((d) => d.id === id);
    const { data: me } = await gabriel.auth.getUser();
    expect(listed).toMatchObject({ kind: 'event', name: 'Dentist', deleted_by: me.user?.id });
    await undo();
    expect((await load(id)).deleted_at).toBeNull();
  });

  it('FR-003 Duplicate copies one date as a one-off with its checklist unticked; Undo removes it for good', async () => {
    const id = await music();
    const series = await load(id);
    const item = series.checklist?.[0]?.id ?? '';
    await gabriel.from('event_checklist_items').update({ done: true }).eq('id', item);
    const oct31 = expand(await load(id), '2026-10-31', '2026-10-31', series.exceptions)[0];
    if (!oct31) throw new Error('no Oct 31');
    const copy = await duplicateEvent(gabriel, duplicateInput({ ...series, ...oct31, category: null }, '2026-11-05', members));
    const made = await load(copy.id);
    expect(made).toMatchObject({ title: 'Baby music class', starts_on: '2026-11-05', ends_on: '2026-11-05', slots: ['afternoon'], recurrence: null, members: [evaMember] });
    expect(made.checklist?.map((c) => [c.label, c.done])).toEqual([['Shaker', false]]);
    await copy.undo();
    expect(await loadEvent(gabriel, copy.id)).toBeNull();
  });

  it('FR-005: the sheet makes one link per date, the endpoint shows it, and stopping ends it', async () => {
    const day = addDays(todayIn('UTC'), 7);
    const id = await saveEvent(eva, { title: 'Picnic', notes: 'Bring the blue rug', location: 'Riverside park', starts_on: day, ends_on: day, time_type: 'all_day', members: [evaMember, 'others'] });
    const first = await openEventShareLink(gabriel, id, day);
    expect(first.created).toBe(true);
    expect((await openEventShareLink(eva, id, day)).token).toBe(first.token);
    const shown = await admin.rpc('shared_event', { p_token: first.token });
    expect(shown.data).toMatchObject({ occurrence_date: day, event: { title: 'Picnic', location: 'Riverside park' } });
    expect([...((shown.data as { who: string[] }).who ?? [])].sort()).toEqual(['Eva', 'others']);
    expect(JSON.stringify(shown.data)).not.toContain('blue rug');
    await stopEventShareLink(gabriel, first.token);
    expect((await admin.rpc('shared_event', { p_token: first.token })).data).toBeNull();
    expect((await openEventShareLink(gabriel, id, day)).created).toBe(true);
  });
});
