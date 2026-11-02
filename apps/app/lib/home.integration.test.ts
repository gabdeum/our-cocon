// @vitest-environment node
// Spec 028 SC-001 against local Supabase: Home's numbers and events are the ones the Groceries,
// Recipes and Calendar screens show. The tiles count what those screens count, the hero skips a
// deleted recipe (032 L42), and Eva's private event reaches Gabriel's card only as "Busy".
// Skipped with a notice when local Supabase isn't running (CI starts it).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@cocon/schemas';
import { DEFAULT_SLOT_TIMES } from '@cocon/calendar';
import { loadEvents, loadHomeHero, saveEvent } from '@cocon/data';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';
import { memberLook } from './calendar-month';
import { addItem, combineRows, loadGroceryList, toBuyCount } from './groceries';
import { cardWindow, layoutCalendarCard, recipeToBuy } from './home';
import { loadRecipeList } from './recipes';
import type { Member } from './session';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the Home integration test');
if (!local) console.warn('home.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('Home against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let gabriel: Client;
  let eva: Client;
  let familyId: string;
  let members: Member[];

  const person = (name: string) => signInPerson(admin, url, anonKey, `home-${name}-${run}@example.com`, userIds);
  const member = (name: string) => members.find((m) => m.display_name === name) as Member;

  beforeAll(async () => {
    [gabriel, eva] = await Promise.all([person('gabriel'), person('eva')]);
    const fam = await gabriel.rpc('create_family', { family_name: 'Home test', display_name: 'Gabriel' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
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

  it('SC-001: the tiles and the hero match the Recipes and Groceries screens', async () => {
    const g = member('Gabriel');
    const insert = async (name: string, created_at: string) => {
      const r = await gabriel.from('recipes').insert({ family_id: familyId, name, serves: 6, total_minutes: 70, created_at }).select('id').single();
      if (r.error) throw r.error;
      return r.data.id;
    };
    const quiche = await insert('Leek quiche', '2026-10-20T10:00:00Z');
    const ing = await gabriel.from('recipe_ingredients').insert([
      { family_id: familyId, recipe_id: quiche, position: 0, name: 'Leeks', catalog_key: 'leek' },
      { family_id: familyId, recipe_id: quiche, position: 1, name: 'Onion', catalog_key: 'onion' },
    ]);
    expect(ing.error).toBeNull();
    const newest = await insert('Old soup', '2026-10-24T10:00:00Z');
    // As Delete does (spec 018): into Recently deleted.
    const gone = await gabriel.from('recipes').update({ deleted_at: new Date().toISOString() }).eq('id', newest);
    expect(gone.error).toBeNull();

    expect(await addItem(gabriel, familyId, g.user_id ?? '', [], '2 leeks')).toMatchObject({ status: 'added' });
    expect(await addItem(gabriel, familyId, g.user_id ?? '', await loadGroceryList(gabriel), 'milk')).toMatchObject({ status: 'added' });

    const hero = await loadHomeHero(eva);
    const recipes = await loadRecipeList(eva);
    const list = await loadGroceryList(eva);
    // The deleted soup is newer, but neither the hero nor the count sees it.
    expect(hero).toMatchObject({ id: quiche, name: 'Leek quiche', serves: 6, total_minutes: 70 });
    expect(recipes.map((r) => r.id)).toEqual([quiche]);
    expect(recipeToBuy(hero?.ingredients ?? [], list)).toBe(1);
    expect(toBuyCount(combineRows(list))).toBe(2);
  });

  it('SC-001: Eva’s private event reaches Gabriel’s card as "Busy" in her color', async () => {
    const e = member('Eva');
    const today = '2026-10-25';
    await saveEvent(eva, { starts_on: today, ends_on: today, title: 'Therapist', time_type: 'slot', slots: ['morning'], location: 'Dr. Kay', members: [e.id], visibility: 'private' });
    await saveEvent(gabriel, { starts_on: '2026-10-27', ends_on: '2026-10-27', title: 'Yoga', time_type: 'slot', slots: ['evening'], members: [e.id] });
    const { from, to } = cardWindow(today);
    const card = layoutCalendarCard(await loadEvents(gabriel, from, to), { today, now: '08:00', look: memberLook(members), slotTimes: DEFAULT_SLOT_TIMES, members, me: member('Gabriel') });
    expect(card.state).toBe('today');
    expect(card.today.map((r) => [r.title, r.sub, r.colors[0]])).toEqual([['Busy', 'Morning', e.color]]);
    expect(card.week.flatMap((g) => g.events.map((r) => r.title))).toEqual(['Busy', 'Yoga']);
    expect(JSON.stringify(card)).not.toContain('Dr. Kay');
  });
});
