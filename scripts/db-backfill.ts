// `pnpm db:backfill`: spec 052 FR-003's backfill (scripts/backfill-catalog-matches.ts) against
// DATABASE_URL or local Supabase, in one transaction. Deploys run it from scripts/migrate.ts instead.
// Its own file, so bundling migrate.ts never runs it.
import pg from 'pg';
import { backfillCatalogMatches, countsText } from './backfill-catalog-matches';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' });
await client.connect();
try {
  await client.query('begin');
  const counts = await backfillCatalogMatches(client);
  await client.query('commit');
  console.log(countsText(counts));
} catch (error) {
  await client.query('rollback');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}
