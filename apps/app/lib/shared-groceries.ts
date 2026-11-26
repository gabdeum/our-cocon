import { parseGroceryLine } from '@cocon/quantity';
import { parseIngredientText, SharedGroceriesResponse, SharedGroceryWrite, ShareToken } from '@cocon/schemas';
import type { GroceryItem, PackData } from './groceries';
import type { SharedEndpoint } from './shared-recipe';

export type SharedGroceriesLoad = { kind: 'shared'; list: SharedGroceriesResponse } | { kind: 'not_shared' };

/** The shared list's query key. Not under `grocery_items`, so a member's own sync never touches it. */
export const sharedGroceriesKey = (token: string) => ['shared-groceries', token] as const;

/** FR-006: the page refetches this often while it's open, in case a live message is missed. */
export const POLL_MS = 15_000;

/** Live pings within this long make one refetch (FR-006). */
export const PING_MS = 1000;

/** The public topic the database pings on each change (spec 072 FR-006). */
export const sharedGroceriesTopic = (token: string) => `grocery-share:${token}`;

const endpoint = (supabaseUrl: string) => `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/shared-groceries`;
const headers = (anonKey: string) => ({ apikey: anonKey, Authorization: `Bearer ${anonKey}` });

/**
 * The endpoint's own "not shared", not any 404: a gateway without the function (a local server
 * started before it existed) answers "Function not found", which is a failure to say, not a stop.
 */
async function notShared(res: Response): Promise<boolean> {
  const body: unknown = await res.json().catch(() => null);
  return (body as { status?: unknown } | null)?.status === 'not_shared';
}

/**
 * A shared grocery list from the share endpoint (FR-003), signed out. "Not shared" for a bad,
 * stopped or ended link (all the same to the viewer); throws when the endpoint can't be reached,
 * so the page can offer to try again.
 */
export async function loadSharedGroceries(token: string, { supabaseUrl, anonKey, fetch: get = fetch }: SharedEndpoint, signal?: AbortSignal): Promise<SharedGroceriesLoad> {
  if (!ShareToken.safeParse(token).success) return { kind: 'not_shared' };
  const res = await get(`${endpoint(supabaseUrl)}?token=${encodeURIComponent(token)}`, { headers: headers(anonKey), ...(signal ? { signal } : {}) });
  if (res.status === 404 && (await notShared(res))) return { kind: 'not_shared' };
  if (!res.ok) throw new Error(`Share endpoint answered ${res.status}`);
  const parsed = SharedGroceriesResponse.safeParse(await res.json());
  if (!parsed.success) throw new Error('Unexpected shared list');
  return { kind: 'shared', list: parsed.data };
}

export type SharedWrite = SharedGroceryWrite;

/** How a write went: done, or why not (the page says each its own way). */
export type SharedWriteResult = 'ok' | 'not_shared' | 'read_only' | 'too_many' | 'failed';

/** FR-004/005: one change through the endpoint, which checks the link again. */
export async function writeSharedGroceries(token: string, write: SharedWrite, { supabaseUrl, anonKey, fetch: post = fetch }: SharedEndpoint): Promise<SharedWriteResult> {
  if (!SharedGroceryWrite.safeParse(write).success) return 'failed';
  try {
    const res = await post(endpoint(supabaseUrl), {
      method: 'POST',
      headers: { ...headers(anonKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...write }),
    });
    if (res.ok) return 'ok';
    if (res.status === 404) return (await notShared(res)) ? 'not_shared' : 'failed';
    if (res.status === 403) return 'read_only';
    if (res.status === 429) return 'too_many';
    return 'failed';
  } catch {
    return 'failed';
  }
}

/**
 * "2 lemons" as the add field reads it, with the matcher's query (the database matches it for the
 * family): the app's own quick-add (spec 020 FR-002). Null when there's nothing to add.
 */
export function sharedAdd(text: string): Extract<SharedWrite, { op: 'add' }> | null {
  const parsed = parseGroceryLine(text.slice(0, 200));
  const name = parsed?.name.slice(0, 80).trim();
  if (!parsed || !name) return null;
  const { full, core } = parseIngredientText(name);
  const add = SharedGroceryWrite.safeParse({ op: 'add', name, quantity: parsed.quantity, unit: parsed.quantity == null ? null : parsed.unit, full: full.slice(0, 80), core: core.slice(0, 80) });
  return add.success && add.data.op === 'add' ? add.data : null;
}

/** The shared items as the list's own rows read them (lib/groceries.ts), without who or what added them. */
export function sharedItems(list: SharedGroceriesResponse): GroceryItem[] {
  return list.items.map((i) => ({
    ...i,
    checked_by: null,
    checked_at: null,
    recipe_id: null,
    from_recipe: false,
    created_by: null,
    source: 'link',
    created_at: '',
    recipes: null,
  }));
}

/** The packs as `loadPacks` gives them to a member; a guest never sees the family's own sizes as such. */
export const sharedPacks = (list: SharedGroceriesResponse): Record<string, PackData> =>
  Object.fromEntries(Object.entries(list.packs).map(([key, p]) => [key, { ...p, corrected: null }]));
