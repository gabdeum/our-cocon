import { parseSharedRecipe, ShareToken, type SharedRecipe } from '@cocon/schemas';

export type SharedLoad = { kind: 'shared'; recipe: SharedRecipe; photoUrls: Record<string, string> } | { kind: 'not_shared' };

export interface SharedEndpoint {
  supabaseUrl: string;
  anonKey: string;
  fetch?: typeof fetch;
}

/** The shared page's query key. Not under `recipes`, so family changes never touch it. */
export const sharedRecipeKey = (token: string) => ['shared-recipe', token] as const;

/**
 * A shared recipe from the share endpoint (spec 019 FR-002), signed out. "Not shared" for a bad,
 * stopped or deleted link (all the same to the viewer); throws when the endpoint can't be reached,
 * so the page can offer to try again.
 */
export async function loadSharedRecipe(token: string, { supabaseUrl, anonKey, fetch: get = fetch }: SharedEndpoint): Promise<SharedLoad> {
  if (!ShareToken.safeParse(token).success) return { kind: 'not_shared' };
  const base = supabaseUrl.replace(/\/+$/, '');
  const res = await get(`${base}/functions/v1/shared-recipe?token=${encodeURIComponent(token)}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
  });
  if (res.status === 404) return { kind: 'not_shared' };
  if (!res.ok) throw new Error(`Share endpoint answered ${res.status}`);
  const parsed = parseSharedRecipe(await res.json(), base);
  if (!parsed) throw new Error('Unexpected shared recipe');
  return { kind: 'shared', ...parsed };
}
