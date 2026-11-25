// @vitest-environment node
// The edit sheet's "Edit event · Edit reminder" switch (2026-11-25) against local Supabase: an event
// moves to the reminders and a reminder to the calendar, the old one deleted, and Undo puts both
// back as they were, leaving nothing in Recently deleted. Needs local Supabase (`pnpm dev`).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { convertEventToReminder, convertReminderToEvent, createReminder, loadEvent, saveEvent } from '@cocon/data';
import type { Database } from '@cocon/schemas';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the convert integration test');
if (!local) console.warn('convert.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

const tz = 'Europe/Paris';

describe.skipIf(!local)('moving events and reminders against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let alex: Client;
  let familyId: string;

  beforeAll(async () => {
    alex = await signInPerson(admin, url, anonKey, `convert-alex-${run}@example.com`, userIds);
    const fam = await alex.rpc('create_family', { family_name: 'Convert test', display_name: 'Alex' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
  }, 30_000);

  afterAll(async () => {
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  const reminderRow = async (id: string) => (await alex.from('reminders').select('title, notes, repeat_rule, deleted_at').eq('id', id).maybeSingle()).data;
  const eventRow = async (id: string) => (await alex.from('events').select('title, deleted_at').eq('id', id).maybeSingle()).data;

  it('an event becomes a reminder with its repeat and notes; Undo brings the event back and removes the reminder', async () => {
    const eventId = await saveEvent(alex, { title: 'Bins', starts_on: '2026-12-01', ends_on: '2026-12-01', time_type: 'all_day', slots: [], members: ['everyone'], notes: 'Blue one' });
    const event = await loadEvent(alex, eventId);
    if (!event) throw new Error('no event');
    const draft = { title: 'Bins', notes: 'Blue one', due_date: '2026-12-01', time: null, repeat: { freq: 'weekly', weekdays: [2], ends: { type: 'never' } }, rollover: 'day', assignee: 'everyone' };
    const moved = await convertEventToReminder(alex, { event, date: '2026-12-01', scope: 'all', familyId, draft, tz });
    expect(await reminderRow(moved.id)).toMatchObject({ title: 'Bins', notes: 'Blue one', repeat_rule: { freq: 'weekly' }, deleted_at: null });
    expect((await eventRow(eventId))?.deleted_at).not.toBeNull();

    await moved.undo();
    expect((await eventRow(eventId))?.deleted_at).toBeNull();
    expect(await reminderRow(moved.id)).toBeNull();
  });

  it('a reminder becomes an event; Undo brings the reminder back and removes the event', async () => {
    const reminderId = await createReminder(alex, familyId, { title: 'Call the vet', due_date: '2026-12-02', notes: 'About Rex' }, tz);
    const moved = await convertReminderToEvent(alex, { reminderId, input: { title: 'Call the vet', starts_on: '2026-12-02', ends_on: '2026-12-02', time_type: 'all_day', slots: [], members: ['everyone'], notes: 'About Rex' } });
    expect(await eventRow(moved.id)).toMatchObject({ title: 'Call the vet', deleted_at: null });
    expect((await reminderRow(reminderId))?.deleted_at).not.toBeNull();

    await moved.undo();
    expect((await reminderRow(reminderId))?.deleted_at).toBeNull();
    expect(await eventRow(moved.id)).toBeNull();
  });
});
