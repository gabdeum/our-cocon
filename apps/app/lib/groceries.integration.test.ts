// @vitest-environment node
// Spec 020 against local Supabase: US1 (Mia's tick reaches Alex within a second, and his list shows
// it), US2 ("2 lemons" lands in Produce, added by Mia), merging, "Move to…" remembered for the family,
// and Clear done items with Undo keeping who added each item. Skipped with a notice when Supabase
// isn't running locally (`pnpm dev` starts it; CI starts it first).
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import { ChangeEvent, familyChannel, type Database } from '@cocon/schemas';
import { clientOptions as options, localSupabase, signInPerson, type Client } from '../test/local-supabase';
import { addItem, clearItems, groupByAisle, loadGroceryList, moveToAisle, restoreItems, setChecked, sourceLine, toBuyCount } from './groceries';

const local = localSupabase();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the groceries integration test');
if (!local) console.warn('groceries.integration.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

describe.skipIf(!local)('the grocery list against local Supabase', () => {
  const { url, anonKey, serviceKey } = local ?? { url: '', anonKey: '', serviceKey: '' };
  const admin = createClient<Database>(url, serviceKey, options);
  const run = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  let alex: Client;
  let mia: Client;
  let channel: RealtimeChannel | null = null;
  let familyId: string;
  let alexId: string;
  let miaId: string;

  /** The row, or a failed test saying which. */
  const must = <T>(value: T | undefined, what: string): T => {
    if (value === undefined) throw new Error(`${what} is not on the list`);
    return value;
  };

  const person = (name: string) => signInPerson(admin, url, anonKey, `groceries-${name}-${run}@example.com`, userIds);
  const members = () => [
    { user_id: alexId, display_name: 'Alex' },
    { user_id: miaId, display_name: 'Mia' },
  ];

  beforeAll(async () => {
    [alex, mia] = await Promise.all([person('alex'), person('mia')]);
    const idOf = async (c: Client) => (await c.auth.getUser()).data.user?.id ?? '';
    [alexId, miaId] = await Promise.all([idOf(alex), idOf(mia)]);
    const fam = await alex.rpc('create_family', { family_name: 'Groceries test', display_name: 'Alex' });
    if (fam.error) throw fam.error;
    familyId = fam.data;
    const invite = await alex.rpc('create_invite');
    if (invite.error) throw invite.error;
    const joined = await mia.rpc('accept_invite', { token: invite.data, display_name: 'Mia' });
    if (joined.error) throw joined.error;
  }, 30_000);

  afterAll(async () => {
    if (channel) await alex.removeChannel(channel);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  it('US2: "2 lemons" goes to Produce as Lemons, 2, added by Mia', async () => {
    expect(await addItem(mia, familyId, [], '2 lemons')).toEqual({ status: 'added', unmatched: false });
    const list = await loadGroceryList(alex);
    const lemons = must(list.find((i) => i.name === 'Lemons'), 'Lemons');
    expect(lemons).toMatchObject({ quantity: 2, unit: 'piece', aisle: 'produce', catalog_key: 'lemon', created_by: miaId, checked: false });
    expect(sourceLine(lemons, members())).toBe('Added by Mia');
    expect(groupByAisle(list).map((g) => g.aisle)).toEqual(['produce']);
  });

  it('merges an item already on the list', async () => {
    const before = await loadGroceryList(mia);
    expect(await addItem(mia, familyId, before, '1 lemon')).toEqual({ status: 'merged', total: '3' });
    const after = await loadGroceryList(mia);
    expect(after.filter((i) => i.catalog_key === 'lemon').map((i) => i.quantity)).toEqual([3]);
  });

  it('US1: Mia ticks, Alex hears it within a second and his list shows it', async () => {
    await addItem(alex, familyId, await loadGroceryList(alex), '100 g gruyère');
    const list = await loadGroceryList(alex);
    const gruyere = must(list.find((i) => i.catalog_key === 'gruyere'), 'Gruyère');
    expect(gruyere.aisle).toBe('dairy_eggs');
    expect(toBuyCount(list)).toBe(2);

    // Alex has the list open before Mia ticks, as in the store. On a fresh Supabase (CI), messages
    // only start flowing a few seconds after the first member joins, and earlier ones are lost; so
    // join, then wait until a change reaches Alex (Mia touching another item), and only then time
    // the tick.
    let onTick: ((at: number) => void) | null = null;
    let warm = false;
    // What Alex's channel received, to say why if the tick never arrives.
    const received: string[] = [];
    await alex.realtime.setAuth();
    const live = alex.channel(familyChannel(familyId), { config: { private: true } });
    channel = live;
    live.on('broadcast', { event: 'change' }, ({ payload }) => {
      received.push(JSON.stringify(payload));
      const change = ChangeEvent.safeParse(payload);
      if (!change.success) return;
      if (change.data.id === gruyere.id && change.data.op === 'update') onTick?.(performance.now());
      else warm = true;
    });
    expect(
      await new Promise<string>((resolve) => {
        live.subscribe((status) => status !== 'CLOSED' && resolve(status));
        setTimeout(() => resolve('NEVER JOINED'), 20_000);
      }),
    ).toBe('SUBSCRIBED');
    const other = must(list.find((i) => i.catalog_key === 'lemon'), 'Lemons');
    for (let i = 0; i < 40 && !warm; i += 1) {
      await mia.from('grocery_items').update({ quantity: 3 }).eq('id', other.id);
      await new Promise((r) => setTimeout(r, 500));
    }
    expect(warm, `no live change reached Alex. Received: ${received.join(' | ') || 'nothing'}`).toBe(true);

    const heard = new Promise<number>((resolve, reject) => {
      onTick = resolve;
      setTimeout(async () => {
        const row = await alex.from('grocery_items').select('checked, checked_by').eq('id', gruyere.id).maybeSingle();
        reject(new Error(`Alex never heard the tick. Row: ${JSON.stringify(row.data)}. Received: ${received.join(' | ') || 'nothing'}`));
      }, 5000);
    });
    const start = performance.now();
    const tick = await setChecked(mia, gruyere.id, true).select('id');
    expect(tick.error).toBeNull();
    expect(tick.data).toHaveLength(1);
    expect((await heard) - start).toBeLessThan(1000);

    const seen = await loadGroceryList(alex);
    expect(seen.find((i) => i.id === gruyere.id)).toMatchObject({ checked: true, checked_by: miaId });
    expect(toBuyCount(seen)).toBe(1);
  }, 60_000);

  it('unknown items go to Other; "Move to…" is remembered for the family', async () => {
    await addItem(alex, familyId, await loadGroceryList(alex), "Za'atar");
    let list = await loadGroceryList(alex);
    const zaatar = must(list.find((i) => i.name === "Za'atar"), "Za'atar");
    expect(zaatar).toMatchObject({ aisle: 'other', catalog_key: null });

    expect(await moveToAisle(alex, familyId, zaatar, list, 'spices_baking')).toBe(true);
    list = await loadGroceryList(alex);
    expect(list.find((i) => i.id === zaatar.id)?.aisle).toBe('spices_baking');

    // Bought and cleared, then added again by Mia: it lands in Spices & baking.
    await clearItems(alex, [zaatar.id]);
    expect(await addItem(mia, familyId, await loadGroceryList(mia), 'zaatar')).toMatchObject({ status: 'added' });
    list = await loadGroceryList(mia);
    expect(list.find((i) => i.name.toLowerCase() === 'zaatar')?.aisle).toBe('spices_baking');

    // A catalog item moved: the family's correction wins from now on.
    const lemons = must(list.find((i) => i.catalog_key === 'lemon'), 'Lemons');
    expect(await moveToAisle(mia, familyId, lemons, list, 'drinks')).toBe(true);
    await clearItems(mia, [lemons.id]);
    await addItem(alex, familyId, await loadGroceryList(alex), '2 lemons');
    expect((await loadGroceryList(alex)).find((i) => i.catalog_key === 'lemon')?.aisle).toBe('drinks');
  });

  it('Clear done items hides ticked items; Undo brings them back as they were', async () => {
    const list = await loadGroceryList(alex);
    const done = list.filter((i) => i.checked).map((i) => i.id);
    expect(done).toHaveLength(1);
    expect(await clearItems(alex, done)).toBe(true);
    expect((await loadGroceryList(mia)).some((i) => done.includes(i.id))).toBe(false);

    expect(await restoreItems(alex, done)).toBe(true);
    const back = (await loadGroceryList(mia)).find((i) => i.id === done[0]);
    // Added by Alex, ticked by Mia: Undo by Alex keeps both.
    expect(back).toMatchObject({ checked: true, checked_by: miaId, created_by: alexId });
  });
});
