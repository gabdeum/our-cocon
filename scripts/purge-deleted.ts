/**
 * Spec 018 FR-002: removes for good the recipes deleted more than 30 days ago, with their photos.
 * Runs nightly on the server (systemd timer cocon-purge@<env>, infra/bin/cocon-purge); `pnpm purge`
 * runs it once against local Supabase.
 *
 * Only standard Supabase APIs (REST and Storage) with the service key, so it works the same on
 * Supabase Cloud. Each recipe's photo folder (`<family>/<recipe>/`: its photo, step photos and any
 * left behind) is emptied before the recipe goes, so no photo is ever left without its recipe; a
 * recipe whose photos couldn't be removed is kept for the next night.
 */

/** Same bucket as apps/app/lib/recipe-photo.ts. */
const BUCKET = 'recipe-photos';

export interface PurgeConfig {
  url: string;
  serviceKey: string;
  fetch?: typeof fetch;
}

export interface PurgeResult {
  recipes: number;
  photos: number;
  /** Recipes kept for the next night because their photos couldn't be removed. */
  failed: string[];
}

export async function purgeDeleted({ url, serviceKey, fetch: http = fetch }: PurgeConfig): Promise<PurgeResult> {
  const call = async <T>(method: string, path: string, body: unknown): Promise<T> => {
    const res = await http(`${url}${path}`, {
      method,
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${method} ${path} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  };

  const due = await call<{ id: string; family_id: string }[]>('POST', '/rest/v1/rpc/recipes_due_for_purge', {});
  const cleared: string[] = [];
  const failed: string[] = [];
  let photos = 0;
  for (const recipe of due) {
    const folder = `${recipe.family_id}/${recipe.id}`;
    try {
      const listed = await call<{ name: string; id: string | null }[]>('POST', `/storage/v1/object/list/${BUCKET}`, { prefix: folder, limit: 1000, offset: 0 });
      const files = listed.filter((f) => f.id !== null).map((f) => `${folder}/${f.name}`);
      if (files.length > 0) await call('DELETE', `/storage/v1/object/${BUCKET}`, { prefixes: files });
      photos += files.length;
      cleared.push(recipe.id);
    } catch (error) {
      failed.push(recipe.id);
      console.error(`Kept recipe ${recipe.id} for the next night: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const recipes = cleared.length > 0 ? await call<number>('POST', '/rest/v1/rpc/purge_deleted_recipes', { ids: cleared }) : 0;
  return { recipes, photos, failed };
}

/** Local development: the URL and service key from the Supabase CLI (never printed). */
async function localConfig(): Promise<PurgeConfig | null> {
  const { execFileSync } = await import('node:child_process');
  try {
    const out = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const status = JSON.parse(out.slice(out.indexOf('{'))) as Record<string, string | undefined>;
    return status.API_URL && status.SERVICE_ROLE_KEY ? { url: status.API_URL, serviceKey: status.SERVICE_ROLE_KEY } : null;
  } catch {
    return null;
  }
}

// CLI: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node purge.mjs (or `pnpm purge` locally).
if (import.meta.url === `file://${process.argv[1]}`) {
  const { SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: serviceKey } = process.env;
  const config = url && serviceKey ? { url, serviceKey } : await localConfig();
  if (!config) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not set, and local Supabase is not running.');
    process.exit(1);
  }
  purgeDeleted(config).then(
    ({ recipes, photos, failed }) => {
      if (recipes > 0 || photos > 0) console.log(`Removed ${recipes} recipe(s) deleted over 30 days ago, and ${photos} photo(s).`);
      if (failed.length > 0) process.exit(1);
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
