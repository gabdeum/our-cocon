/// <reference types="node" />
// 032-later L5: the database's cuisine check and the shared Cuisine list are the same list.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { Cuisine } from './recipes';

const migrations = join(import.meta.dirname, '../../supabase/migrations');

it('checks recipes.cuisine against exactly the Cuisine list', () => {
  // The latest migration that sets the check is the one in force.
  const sql = readdirSync(migrations)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => readFileSync(join(migrations, f), 'utf8'))
    .filter((s) => s.includes('add constraint recipes_cuisine_known'))
    .at(-1);
  const list = /add constraint recipes_cuisine_known check \(cuisine in \(([^)]*)\)\)/.exec(sql ?? '')?.[1];
  const keys = [...(list ?? '').matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  expect(keys.sort()).toEqual([...Cuisine.options].sort());
});
