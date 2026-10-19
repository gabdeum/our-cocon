import { readFileSync } from 'node:fs';
import { CatalogFile, type CatalogEntry } from '@cocon/schemas/catalog';
import type { IngredientFactsInput } from './types';

/** Tests read the real catalog (spec 031), so they follow its numbers. */
const catalog = CatalogFile.parse(JSON.parse(readFileSync(new URL('../../data/catalog/ingredients.json', import.meta.url), 'utf8')));

/** One entry's facts, shaped like the `ingredient_facts` view. */
export function facts(key: string): IngredientFactsInput {
  const e = catalog.ingredients.find((i) => i.key === key) as CatalogEntry;
  if (!e) throw new Error(`No catalog entry ${key}`);
  return {
    density_g_per_ml: e.density_g_per_ml ?? null,
    size_small_g: e.sizes?.small ?? null,
    size_medium_g: e.sizes?.medium ?? null,
    size_large_g: e.sizes?.large ?? null,
    default_size: e.default_size ?? null,
    whole_only: e.whole_only,
    name: e.names.en?.singular ?? null,
    plural: e.names.en?.plural ?? null,
    noun_singular: e.nouns?.singular ?? null,
    noun_plural: e.nouns?.plural ?? null,
  };
}
