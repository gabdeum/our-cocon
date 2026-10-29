// @vitest-environment node
// Spec 043 against local Supabase, through the shared data layer and the app's helpers. US1: Eva's
// private afternoon reaches Gabriel as "Busy" and opens "Eva is busy". US2: Gabriel's surprise
// dinner reaches Eva only as its cover (OC-CalSurprise, never the edit sheet, 032-later L101),
// while Alex, in on it, gets the real event tagged and "hidden from Eva". Skipped with a notice
// when local Supabase isn't running (CI starts it).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SLOT_TIMES, viewFor } from '@cocon/calendar';
import { loadEvent, saveEvent } from '@cocon/data';
import type { Database } from '@cocon/schemas';
import { hiddenFromLine } from './calendar-day';
import { monthOccurrences } from './calendar-month';
import { busyLines, eventOccurrence, isCover, seesInFull } from './event-detail';
import type { Member } from './session';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the surprise integration test');
if (!local) console.warn('surprise.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('private and surprise events against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let gabriel: Client;
  let eva: Client;
  let alex: Client;
  let members: Member[];
  const id = (name: string) => members.find((m) => m.display_name === name)?.id ?? '';

  const person = (name: string) => signInPerson(admin, url, anonKey, `surprise-${name}-${run}@example.com`, userIds);

  beforeAll(async () => {
    [gabriel, eva, alex] = await Promise.all([person('gabriel'), person('eva'), person('alex')]);
    const fam = await gabriel.rpc('create_family', { family_name: 'Surprise test', display_name: 'Gabriel' });
    if (fam.error) throw fam.error;
    for (const [client, name] of [
      [eva, 'Eva'],
      [alex, 'Alex'],
    ] as const) {
      const invite = await gabriel.rpc('create_invite');
      if (invite.error) throw invite.error;
      const joined = await client.rpc('accept_invite', { token: invite.data, display_name: name });
      if (joined.error) throw joined.error;
    }
    const all = await gabriel.from('members').select('*').order('created_at');
    if (all.error) throw all.error;
    members = all.data as unknown as Member[];
  }, 30_000);

  afterAll(async () => {
    for (const userId of userIds) await admin.auth.admin.deleteUser(userId);
  });

  it('US1: Eva’s private afternoon is “Eva is busy” for Gabriel, and nothing else', async () => {
    const eventId = await saveEvent(eva, {
      title: 'Dentist',
      location: 'Dr. Kay',
      starts_on: '2026-10-22',
      ends_on: '2026-10-22',
      time_type: 'slot',
      slots: ['afternoon'],
      members: [id('Eva')],
      visibility: 'private',
    });
    const seen = await loadEvent(gabriel, eventId);
    if (!seen) throw new Error('Gabriel should get the Busy row');
    expect(viewFor(seen, id('Gabriel'))).toMatchObject({ view: 'busy', title: 'Busy', location: null });
    const lines = busyLines(eventOccurrence(seen, '2026-10-22') ?? seen, members, DEFAULT_SLOT_TIMES);
    expect([lines.creator?.name, lines.when]).toEqual(['Eva', 'Thursday, Oct 22 · Afternoon']);
  });

  it('US2: Eva gets only the cover; Alex, in on it, gets the real event', async () => {
    const eventId = await saveEvent(gabriel, {
      title: 'Eva’s surprise dinner',
      location: 'Café Lalo',
      notes: 'Book the window table',
      starts_on: '2026-10-31',
      ends_on: '2026-10-31',
      time_type: 'slot',
      slots: ['evening'],
      members: [id('Eva')],
      visibility: 'surprise',
      surprise: { hidden_from: [id('Eva')], cover_title: 'Dinner out', cover_note: 'Meet at Café Lalo at 19:30. Dress nice!' },
    });

    const forEva = await loadEvent(eva, eventId);
    if (!forEva) throw new Error('Eva should get the cover');
    expect(viewFor(forEva, id('Eva'))).toMatchObject({ view: 'cover', title: 'Dinner out', location: 'Café Lalo', notes: 'Meet at Café Lalo at 19:30. Dress nice!', is_surprise: false });
    expect(JSON.stringify(forEva)).not.toContain('surprise dinner');
    expect(JSON.stringify(forEva)).not.toContain('window table');
    // The event page shows OC-CalSurprise and the edit route says it couldn't open (L101).
    expect([isCover(forEva, id('Eva')), seesInFull(forEva, id('Eva'))]).toEqual([true, false]);
    await expect(saveEvent(eva, { title: 'Dinner out', starts_on: '2026-10-31', ends_on: '2026-10-31', time_type: 'all_day', members: ['everyone'] }, eventId)).rejects.toBeTruthy();

    const forAlex = await loadEvent(alex, eventId);
    if (!forAlex) throw new Error('Alex should get the event');
    const v = viewFor(forAlex, id('Alex'));
    expect(v).toMatchObject({ view: 'full', title: 'Eva’s surprise dinner', is_surprise: true });
    const [row] = monthOccurrences([forAlex], '2026-10-31', '2026-10-31', id('Alex'), new Set());
    expect(row && hiddenFromLine(row, members)).toBe('hidden from Eva');
  });
});
