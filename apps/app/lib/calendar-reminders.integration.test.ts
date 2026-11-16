// @vitest-environment node
// Spec 058 against local Supabase. FR-001–FR-003: the calendar's reminders come from
// `reminders_in_range` and land on their days (a late one on today, a weekly one's next dates
// drawn). SC-001: a tick from the calendar is what Home and the Reminders screen read next. Needs
// local Supabase (`pnpm dev` starts it; CI starts it before the tests).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { addDays, todayIn } from '@cocon/calendar';
import { completeReminder, createReminder, loadReminderSection, loadRemindersHome, loadRemindersInRange } from '@cocon/data';
import type { Database } from '@cocon/schemas';
import { placeReminders } from './calendar-reminders';
import type { Member } from './session';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the calendar reminders integration test');
if (!local) console.warn('calendar-reminders.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

const tz = 'Europe/Paris';

describe.skipIf(!local)('reminders in the calendar against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let alex: Client;
  let familyId: string;
  let members: Member[];
  const today = todayIn(tz);
  const to = addDays(today, 20);

  beforeAll(async () => {
    alex = await signInPerson(admin, url, anonKey, `cal-reminders-alex-${run}@example.com`, userIds);
    const fam = await alex.rpc('create_family', { family_name: 'Calendar reminders test', display_name: 'Alex' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
    const m = await alex.from('members').select('*');
    if (m.error) throw m.error;
    members = m.data as unknown as Member[];
  }, 30_000);

  afterAll(async () => {
    // Deleting the person removes their family and everything in it.
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('FR-001–FR-003 and SC-001: placed on their days, and a tick from the calendar reaches Home and the Reminders screen', async () => {
    const late = await createReminder(alex, familyId, { title: 'Water the plants', due_date: addDays(today, -2), rollover: 'day' }, tz);
    await createReminder(alex, familyId, { title: 'Take the bins out', due_date: addDays(today, 1), time: '20:00', repeat: { freq: 'weekly', ends: { type: 'never' } } }, tz);
    const ctx = { from: today, to, today, tz, members, use24h: true, hidden: new Set<string>() };

    const placed = placeReminders(await loadRemindersInRange(alex, today, to, tz), ctx);
    expect(placed.map((x) => [x.date, x.item.title, x.item.future])).toEqual([
      [today, 'Water the plants', false],
      [addDays(today, 1), 'Take the bins out', false],
      [addDays(today, 8), 'Take the bins out', true],
      [addDays(today, 15), 'Take the bins out', true],
    ]);

    // Ticked in the agenda (the route's `onTick` saves it like this), then what the other screens load.
    expect(await completeReminder(alex, late, tz)).not.toBeNull();
    const home = await loadRemindersHome(alex, tz);
    expect(home.rows.map((x) => x.title)).not.toContain('Water the plants');
    const overdue = await loadReminderSection(alex, { section: 'overdue', mine: false, tz });
    expect(overdue.rows.map((x) => x.title)).not.toContain('Water the plants');
    const again = placeReminders(await loadRemindersInRange(alex, today, to, tz), ctx);
    expect(again.map((x) => x.item.title)).not.toContain('Water the plants');
  });
});
