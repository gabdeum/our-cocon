import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import pg from 'pg';
import { migrate } from './migrate';

// Local Supabase's database (`supabase start`), as in CI.
const adminUrl = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const dbName = `migrate_test_${process.pid}`;
const url = adminUrl.replace(/\/[^/]*$/, `/${dbName}`);

async function admin(sql: string) {
  const c = new pg.Client({ connectionString: adminUrl });
  await c.connect();
  try {
    await c.query(sql);
  } finally {
    await c.end();
  }
}

async function query<T extends pg.QueryResultRow>(sql: string) {
  const c = new pg.Client({ connectionString: url });
  await c.connect();
  try {
    return (await c.query<T>(sql)).rows;
  } finally {
    await c.end();
  }
}

async function migrationsDir(files: Record<string, string>) {
  const dir = await mkdtemp(join(tmpdir(), 'migrations-'));
  for (const [name, sql] of Object.entries(files)) await writeFile(join(dir, name), sql);
  return dir;
}

beforeAll(() => admin(`create database ${dbName}`));
afterAll(() => admin(`drop database if exists ${dbName} with (force)`));

it('applies pending migrations and records them like the Supabase CLI', async () => {
  const dir = await migrationsDir({ '20261015000000_first.sql': 'create table one (id int);' });
  expect(await migrate(url, dir)).toEqual(['20261015000000_first.sql']);
  expect(await query('select version, name from supabase_migrations.schema_migrations')).toEqual([
    { version: '20261015000000', name: 'first' },
  ]);
  // Already applied: nothing to do.
  expect(await migrate(url, dir)).toEqual([]);
});

it('rolls back every pending migration when one fails', async () => {
  const dir = await migrationsDir({
    '20261015000000_first.sql': 'create table one (id int);',
    '20261016000000_second.sql': 'create table two (id int);',
    '20261017000000_broken.sql': 'create table three (id int); select * from does_not_exist;',
  });
  await expect(migrate(url, dir)).rejects.toThrow(/20261017000000_broken.sql failed/);

  const tables = await query<{ name: string }>(
    "select table_name as name from information_schema.tables where table_schema = 'public' order by 1",
  );
  expect(tables.map((t) => t.name)).toEqual(['one']);
  const versions = await query<{ version: string }>('select version from supabase_migrations.schema_migrations');
  expect(versions.map((v) => v.version)).toEqual(['20261015000000']);
});
