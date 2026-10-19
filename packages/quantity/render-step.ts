import { format } from './format';
import type { FormatOptions, QuantityIngredient } from './types';

/** A run of step text: plain text, a highlighted amount, or a token whose ingredient is gone (spec 009). */
export type StepSegment =
  | { type: 'text'; text: string }
  | { type: 'amount'; text: string; ingredientId: string }
  | { type: 'missing'; ingredientId: string };

/** Spec 016: step bodies mention ingredients as `{ing:<ingredient id>}`. */
const TOKEN = /\{ing:([^{}\s]+)\}/g;

/** FR-006: step text with each token replaced by its ingredient's phrase, for StepCard. */
export function renderStep(body: string, ingredients: QuantityIngredient[], options: FormatOptions): StepSegment[] {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const segments: StepSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(TOKEN)) {
    if (match.index > last) segments.push({ type: 'text', text: body.slice(last, match.index) });
    const id = match[1] as string;
    const ing = byId.get(id);
    segments.push(ing ? { type: 'amount', text: format(ing, options).phrase, ingredientId: id } : { type: 'missing', ingredientId: id });
    last = match.index + match[0].length;
  }
  if (last < body.length) segments.push({ type: 'text', text: body.slice(last) });
  return segments;
}
