// Spec 018 FR-002 against local Supabase: the nightly job removes a recipe deleted 31 days ago with
// its photos, and leaves one deleted 2 days ago and a live one alone. Skipped when Supabase isn't
// running locally.
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { purgeDeleted } from './purge-deleted';

function localStatus(): { url: string; serviceKey: string } | null {
  try {
    const out = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const s = JSON.parse(out.slice(out.indexOf('{'))) as Record<string, string | undefined>;
    return s.API_URL && s.SERVICE_ROLE_KEY ? { url: s.API_URL, serviceKey: s.SERVICE_ROLE_KEY } : null;
  } catch {
    return null;
  }
}

const local = localStatus();
if (!local && process.env.CI) throw new Error('Local Supabase must be running in CI for the purge test');
if (!local) console.warn('purge-deleted.test.ts skipped: local Supabase is not running (pnpm dev starts it).');

const databaseUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9]);

describe.skipIf(!local)('the nightly purge against local Supabase', () => {
  const { url, serviceKey } = local ?? { url: '', serviceKey: '' };
  const db = new pg.Client({ connectionString: databaseUrl });
  const userId = randomUUID();
  const familyId = randomUUID();
  const old = randomUUID();
  const recent = randomUUID();
  const live = randomUUID();
  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const photo = (recipe: string) => `${familyId}/${recipe}/${randomUUID()}.jpg`;
  const photos = { old: [photo(old), photo(old)], recent: photo(recent) };

  const upload = async (path: string) => {
    const res = await fetch(`${url}/storage/v1/object/recipe-photos/${path}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'image/jpeg' }, body: jpeg });
    if (!res.ok) throw new Error(`upload failed: ${res.status}`);
  };
  const listed = async (recipe: string) => {
    const res = await fetch(`${url}/storage/v1/object/list/recipe-photos`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: `${familyId}/${recipe}`, limit: 100, offset: 0 }),
    });
    return ((await res.json()) as unknown[]).length;
  };

  beforeAll(async () => {
    await db.connect();
    await db.query('insert into auth.users (id, email) values ($1, $2)', [userId, `purge-${userId}@example.com`]);
    await db.query("insert into public.families (id, name, owner_id) values ($1, 'Purge test', $2)", [familyId, userId]);
    // No one signed in, so the times are kept as given.
    await db.query(
      `insert into public.recipes (id, family_id, name, deleted_at, deleted_by) values
         ($1, $4, 'Old soup', now() - interval '31 days', $5),
         ($2, $4, 'Recent stew', now() - interval '2 days', $5),
         ($3, $4, 'Live quiche', null, null)`,
      [old, recent, live, familyId, userId],
    );
    await db.query("insert into public.recipe_steps (family_id, recipe_id, position, body, photo_path) values ($1, $2, 0, 'Simmer.', $3)", [familyId, old, photos.old[1]]);
    await db.query("insert into public.grocery_items (family_id, name, recipe_id) values ($1, 'Leeks', $2)", [familyId, old]);
    // Spec 020: cleared two days ago, and an hour ago (still undoable).
    await db.query(
      `insert into public.grocery_items (family_id, name, deleted_at) values
         ($1, 'Old milk', now() - interval '2 days'), ($1, 'Fresh bread', now() - interval '1 hour')`,
      [familyId],
    );
    // Spec 035: an event deleted 31 days ago, with an exception, and one deleted yesterday.
    await db.query(
      `insert into public.events (family_id, title, starts_on, ends_on, time_type, deleted_at) values
         ($1, 'Old party', '2026-01-01', '2026-01-01', 'all_day', now() - interval '31 days'),
         ($1, 'Recent swim', '2026-01-02', '2026-01-02', 'all_day', now() - interval '1 day')`,
      [familyId],
    );
    await db.query("insert into public.event_exceptions (family_id, event_id, occurrence_date, cancelled) select family_id, id, starts_on, true from public.events where family_id = $1", [familyId]);
    for (const path of [...photos.old, photos.recent]) await upload(path);
  }, 30_000);

  afterAll(async () => {
    await fetch(`${url}/storage/v1/object/recipe-photos`, {
      method: 'DELETE',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [photos.recent] }),
    });
    await db.query('delete from auth.users where id = $1', [userId]);
    await db.end();
  });

  it('removes only the recipe deleted more than 30 days ago, with its photos', async () => {
    const result = await purgeDeleted({ url, serviceKey });
    expect(result.failed).toEqual([]);
    const { rows } = await db.query<{ id: string }>('select id from public.recipes where family_id = $1 order by name', [familyId]);
    expect(rows.map((r) => r.id).sort()).toEqual([recent, live].sort());
    expect(await listed(old)).toBe(0);
    expect(await listed(recent)).toBe(1);
    const steps = await db.query('select 1 from public.recipe_steps where recipe_id = $1', [old]);
    expect(steps.rowCount).toBe(0);
    // Its grocery items stay on the list.
    const items = await db.query<{ recipe_id: string | null }>("select recipe_id from public.grocery_items where family_id = $1 and name = 'Leeks'", [familyId]);
    expect(items.rows).toEqual([{ recipe_id: null }]);
  });

  it('removes grocery items cleared more than a day ago (spec 020)', async () => {
    const { rows } = await db.query<{ name: string }>('select name from public.grocery_items where family_id = $1 and deleted_at is not null', [familyId]);
    expect(rows).toEqual([{ name: 'Fresh bread' }]);
  });

  it('removes events deleted more than 30 days ago, with their exceptions (spec 035)', async () => {
    const { rows } = await db.query<{ title: string }>('select title from public.events where family_id = $1', [familyId]);
    expect(rows).toEqual([{ title: 'Recent swim' }]);
    const exceptions = await db.query('select 1 from public.event_exceptions where family_id = $1', [familyId]);
    expect(exceptions.rowCount).toBe(1);
  });

  it('refuses a caller without the service key', async () => {
    await expect(purgeDeleted({ url, serviceKey: 'not-a-key' })).rejects.toThrow();
  });
});
