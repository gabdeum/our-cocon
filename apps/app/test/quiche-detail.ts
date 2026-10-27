import { NO_RECIPE_OVERRIDES } from '@cocon/schemas';
import { quiche } from '@cocon/schemas/quiche.fixture';
import type { RecipeDetail } from '../lib/recipe';
import { gabriel } from './fakes';

/**
 * The seed quiche as the recipe page loads it, with catalog facts for eggs (whole only), cream
 * (a density) and leeks, like the seed's catalog matches (spec 013's sheets).
 */
export const quicheDetail: RecipeDetail = {
  id: 'c0c0e000-0000-4000-8000-000000000001',
  name: 'Leek & bacon quiche',
  description: null,
  serves: 6,
  total_minutes: 70,
  prep_minutes: null,
  source_text: null,
  cuisine: 'french',
  best_months: [],
  photo_path: null,
  created_by: gabriel.user_id,
  source: 'app',
  deleted_at: null,
  deleted_by: null,
  overrides: NO_RECIPE_OVERRIDES,
  ingredients: quiche.ingredients.map((i) => ({ ...i, catalog_key: ({ Eggs: 'egg', 'Heavy cream': 'heavy_cream' } as Record<string, string>)[i.name] ?? null })),
  steps: quiche.steps,
  variants: quiche.variants,
  facts: {
    egg: { default_size: 'large', size_small_g: 38, size_medium_g: 44, size_large_g: 50, whole_only: true },
    heavy_cream: { density_g_per_ml: 1 },
  },
};
