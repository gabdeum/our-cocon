/**
 * Spec 018 FR-002: removes for good the recipes deleted more than 30 days ago, with their photos.
 * Spec 020: also the grocery items cleared or removed more than a day ago (kept until then for Undo).
 * Spec 035: and the events deleted more than 30 days ago, with everything about them.
 * Spec 049 (032-later L118): and the notification sends and reminder deliveries over 90 days old.
 * Spec 045 FR-009: and tries again to revoke the Sign in with Apple of deleted accounts, through the
 * apple-sign-in Edge Function (which holds the Apple key). Apple being down never fails the purge.
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
  groceries: number;
  events: number;
  /** Rows of `notification_log` and `reminder_deliveries` over 90 days old. */
  notifications: number;
  /** Cooks untouched for 72 hours, cancelled as stale (spec 051). */
  staleCooks: number;
  /** Recipes kept for the next night because their photos couldn't be removed. */
  failed: string[];
  /** Apple sign-ins revoked, and left for the next night; null when the function couldn't be reached. */
  apple: { revoked: number; left: number } | null;
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
  const groceries = await call<number>('POST', '/rest/v1/rpc/purge_cleared_groceries', {});
  const events = await call<number>('POST', '/rest/v1/rpc/purge_deleted_events', {});
  const notifications = await call<number>('POST', '/rest/v1/rpc/purge_notification_history', {});
  const staleCooks = await call<number>('POST', '/rest/v1/rpc/cancel_stale_cook_sessions', {});
  const apple = await call<{ revoked: number; left: number }>('POST', '/functions/v1/apple-sign-in', { retry: true }).catch((error: unknown) => {
    console.error(`Couldn't retry the Apple revokes: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  });
  return { recipes, photos, groceries, events, notifications, staleCooks, failed, apple };
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
    ({ recipes, photos, groceries, events, notifications, staleCooks, failed, apple }) => {
      if (recipes > 0 || photos > 0) console.log(`Removed ${recipes} recipe(s) deleted over 30 days ago, and ${photos} photo(s).`);
      if (groceries > 0) console.log(`Removed ${groceries} grocery item(s) cleared over a day ago.`);
      if (events > 0) console.log(`Removed ${events} event(s) deleted over 30 days ago.`);
      if (notifications > 0) console.log(`Removed ${notifications} notification record(s) over 90 days old.`);
      if (staleCooks > 0) console.log(`Cancelled ${staleCooks} cook(s) left in progress for over 72 hours.`);
      if (apple && apple.revoked > 0) console.log(`Revoked ${apple.revoked} Sign in with Apple of deleted accounts.`);
      if (apple && apple.left > 0) console.log(`${apple.left} Sign in with Apple revoke(s) left for the next night (Apple didn't answer).`);
      if (failed.length > 0) process.exit(1);
    },
    (error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    },
  );
}
