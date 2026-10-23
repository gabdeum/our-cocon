import { ingredientName } from '@cocon/schemas/ingredient-text';
import { groceryIdentity } from './groceries';
import { sumNeeds } from './packs';
import type { QuantityIngredient } from './types';
import { convert, kindOf } from './units';

/**
 * Which rows are one ingredient: the same catalog item, or the same name as cooks read it, so
 * "Onion (sauce)" and "Onion, sliced" are one onion line (as on the grocery list, spec 020).
 */
export function sameIngredientKey(row: { name: string; catalog_key?: string | null }): string {
  return groceryIdentity({ catalog_key: row.catalog_key ?? null, name: ingredientName(row.name) });
}

/** The rows grouped by ingredient, each group where its first row is. */
export function groupSameIngredient<I extends { name: string; catalog_key?: string | null }>(rows: readonly I[]): I[][] {
  const groups = new Map<string, I[]>();
  for (const row of rows) {
    const key = sameIngredientKey(row);
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.values()];
}

/**
 * Rows of one ingredient as one row, summed in the first amount's unit (through the catalog's
 * density and piece weights when the units differ). Rows with no amount add nothing. Null when the
 * amounts don't add up (a volume and a weight with no density).
 */
export function sumIngredients<I extends QuantityIngredient>(rows: readonly I[]): I | null {
  const known = rows.filter((r) => r.quantity != null && r.quantity > 0);
  const lead = known[0];
  if (!lead) return rows[0] ?? null;
  if (known.length === 1) return lead;
  const total = (list: readonly I[]) => list.reduce((n, r) => n + (r.quantity as number), 0);
  const unit = lead.unit ?? null;
  const sameSize = known.every((r) => (r.size_word ?? null) === (lead.size_word ?? null));
  if (known.every((r) => (r.unit ?? null) === unit) && (unit !== 'piece' || sameSize)) return { ...lead, quantity: total(known) };
  if (unit && kindOf(unit) === 'pinch') return null;
  const sum = sumNeeds(
    known.map((r) => ({ quantity: r.quantity as number, unit: r.unit === 'piece' ? null : (r.unit ?? null) })),
    lead.facts,
  );
  if (!sum) return null;
  if (sum.kind === 'piece') return { ...lead, quantity: sum.quantity, size_word: sameSize ? lead.size_word : null, weight_per_piece_g: sameSize ? lead.weight_per_piece_g : null };
  const base = sum.kind === 'weight' ? 'g' : 'ml';
  return { ...lead, quantity: convert(sum.quantity, base, unit ?? base), unit: unit ?? base };
}

/**
 * The first row's part of the rows' total, so a scale by the total ("2 onions" for the sauce and
 * the topping together) can go by the first row with the same factor. Null when the first row has
 * no amount or the amounts don't add up.
 */
export function firstRowShare(rows: readonly QuantityIngredient[]): number | null {
  const first = rows[0];
  if (!first?.quantity) return null;
  const need = (r: QuantityIngredient) => ({ quantity: r.quantity as number, unit: r.unit === 'piece' ? null : (r.unit ?? null) });
  const all = sumNeeds(rows.filter((r) => r.quantity != null && r.quantity > 0).map(need), first.facts);
  const own = sumNeeds([need(first)], first.facts);
  return all && own && all.quantity > 0 ? own.quantity / all.quantity : null;
}
