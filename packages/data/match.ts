import type { IngredientFactsInput } from '@cocon/quantity';
import { parseIngredientText, type Aisle } from '@cocon/schemas';
import type { Db } from './client';

/** What the catalog knows about a name (spec 031), with the family's corrections. */
export type MatchedFacts = IngredientFactsInput & { catalog_key?: string | null; aisle?: Aisle };

/**
 * The catalog's facts for each name (spec 031's `match_ingredients`), in order: null where nothing
 * matched. Undefined when the lookup failed, so rows aren't marked new just because we're offline.
 */
export async function matchIngredients(client: Pick<Db, 'rpc'>, names: string[]): Promise<(MatchedFacts | null)[] | undefined> {
  if (names.length === 0) return [];
  try {
    const queries = names.map((n) => {
      const { full, core } = parseIngredientText(n);
      return { full: full.slice(0, 80), core: core.slice(0, 80) };
    });
    const { data, error } = await client.rpc('match_ingredients', { queries });
    if (error || !data) return undefined;
    const out: (MatchedFacts | null)[] = names.map(() => null);
    for (const row of data) {
      if (row.how === 'none') continue;
      out[row.idx] = row as MatchedFacts;
    }
    return out;
  } catch {
    return undefined;
  }
}
