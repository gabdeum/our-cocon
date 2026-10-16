import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import pg from 'pg';

/**
 * Applies pending migrations from supabase/migrations in ONE transaction: if any fails, none
 * are applied and the deploy stops (spec 001 edge case). Records them in the same table the
 * Supabase CLI uses, so `supabase db push` and Supabase Cloud see the same history.
 */
export async function migrate(databaseUrl: string, dir: string): Promise<string[]> {
  const files = (await readdir(dir)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query('begin');
    // One deploy at a time.
    await client.query("select pg_advisory_xact_lock(hashtext('cocon_migrate'))");
    await client.query(`
      create schema if not exists supabase_migrations;
      create table if not exists supabase_migrations.schema_migrations (
        version text not null primary key, statements text[], name text
      )`);
    const { rows } = await client.query<{ version: string }>('select version from supabase_migrations.schema_migrations');
    const done = new Set(rows.map((r) => r.version));
    const applied: string[] = [];

    for (const file of files) {
      const [version, ...rest] = file.replace(/\.sql$/, '').split('_');
      if (!version || done.has(version)) continue;
      const sql = await readFile(join(dir, file), 'utf8');
      try {
        await client.query(sql);
      } catch (error) {
        throw new Error(`Migration ${file} failed: ${error instanceof Error ? error.message : String(error)}`, {
          cause: error,
        });
      }
      await client.query(
        'insert into supabase_migrations.schema_migrations (version, statements, name) values ($1, $2, $3)',
        [version, [sql], rest.join('_')],
      );
      applied.push(file);
    }

    await client.query('commit');
    return applied;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    await client.end();
  }
}

// CLI: DATABASE_URL=... node migrate.mjs <dir>
if (import.meta.url === `file://${process.argv[1]}`) {
  const url = process.env.DATABASE_URL;
  const dir = process.argv[2] ?? 'supabase/migrations';
  if (!url) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  migrate(url, dir).then(
    (applied) => applied.length && console.log(`Applied ${applied.length} migration(s): ${applied.join(', ')}`),
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      console.error('No migration was applied.');
      process.exit(1);
    },
  );
}
