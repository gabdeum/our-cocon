import { z } from 'zod';
import { CatalogKey, Quantity, Unit } from './recipes';

/** Aisles in their fixed display order (spec 031 FR-007); the database enum has the same order. */
export const Aisle = z.enum(['produce', 'bakery', 'dairy_eggs', 'meat_fish', 'dry_goods', 'spices_baking', 'frozen', 'drinks', 'household', 'other']);
export type Aisle = z.infer<typeof Aisle>;
export const AISLE_ORDER: readonly Aisle[] = Aisle.options;

/** Spec 004 grocery item input. The database checks the same limits (supabase/migrations, groceries). */
export const GroceryItemInput = z
  .strictObject({
    name: z.string().trim().min(1).max(80),
    catalog_key: CatalogKey.nullish(),
    quantity: Quantity.nullish(),
    unit: Unit.nullish(),
    aisle: Aisle.nullish(),
    checked: z.boolean().optional(),
    recipe_id: z.uuid().nullish(),
  })
  .refine((i) => i.unit == null || i.quantity != null, 'A unit needs an amount');
export type GroceryItemInput = z.infer<typeof GroceryItemInput>;
