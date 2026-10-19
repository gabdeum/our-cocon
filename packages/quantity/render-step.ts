import { format } from './format';
import { formatTemperature, type TemperatureOptions } from './temperature';
import type { FormatOptions, QuantityIngredient } from './types';

/** A run of step text: plain text, a highlighted amount, or a token whose ingredient is gone (spec 009). */
export type StepSegment =
  | { type: 'text'; text: string }
  | { type: 'amount'; text: string; ingredientId: string }
  | { type: 'missing'; ingredientId: string };

/**
 * Step bodies mention ingredients as `{ing:<ingredient id>}` (spec 016) and temperatures, stored in
 * °C, as `{temp:<celsius>}` (an oven: "180 °C (350 °F)") or `{temp:<celsius>:food}` (a thermometer
 * reading, nearest 5 °F). Build them with `ingredientToken` and `temperatureToken`.
 */
const TOKEN = /\{(ing|temp):([^{}\s:]+)(?::(food))?\}/g;

export function ingredientToken(ingredientId: string): string {
  return `{ing:${ingredientId}}`;
}

export function temperatureToken(celsius: number, kind: TemperatureOptions['kind'] = 'oven'): string {
  const c = Math.round(celsius * 10) / 10;
  return kind === 'food' ? `{temp:${c}:food}` : `{temp:${c}}`;
}

/** FR-006: step text with each token replaced: ingredients by their phrase, temperatures in both scales. */
export function renderStep(body: string, ingredients: QuantityIngredient[], options: FormatOptions): StepSegment[] {
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const segments: StepSegment[] = [];
  const addText = (text: string) => {
    if (!text) return;
    const last = segments.at(-1);
    if (last?.type === 'text') last.text += text;
    else segments.push({ type: 'text', text });
  };
  let last = 0;
  for (const match of body.matchAll(TOKEN)) {
    addText(body.slice(last, match.index));
    last = match.index + match[0].length;
    const [token, kind, value, food] = match as unknown as [string, 'ing' | 'temp', string, string | undefined];
    if (kind === 'temp') {
      const celsius = Number(value);
      addText(Number.isFinite(celsius) ? formatTemperature(celsius, { system: options.system, kind: food ? 'food' : 'oven' }) : token);
      continue;
    }
    const ing = byId.get(value);
    segments.push(ing ? { type: 'amount', text: format(ing, options).phrase, ingredientId: value } : { type: 'missing', ingredientId: value });
  }
  addText(body.slice(last));
  return segments;
}
