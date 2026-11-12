import { cuisineOf } from '@cocon/schemas';
import { strings } from '../strings/en';
import type { Member } from './session';

/**
 * A recipe's total time (spec 006 FR-002), the one format used by the list, the recipe page (008)
 * and Home (028): "40 min", "2 h", "1 h 05".
 */
export function formatTotalTime(minutes: number): string {
  if (minutes < 60) return strings.time.minutes(minutes);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? strings.time.hours(h) : strings.time.hoursMinutes(h, String(m).padStart(2, '0'));
}

export interface MetaFacts {
  total_minutes: number | null;
  serves: number;
  cuisine: string | null;
  variantCount: number;
}

/**
 * "1 h 10 · Serves 6 · French · 2 variants" (FR-001). A fact with no value is left out with its
 * separator: no total time, cuisine Other, no variants.
 */
export function recipeMeta({ total_minutes, serves, cuisine, variantCount }: MetaFacts): string {
  const key = cuisineOf(cuisine);
  return [
    total_minutes ? formatTotalTime(total_minutes) : null,
    strings.recipe.serves(serves),
    key ? strings.cuisines[key] : null,
    variantCount > 0 ? strings.recipe.variants(variantCount) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** The assistant's name for a write source ('chatgpt' → "ChatGPT"), or null when made in the app. */
export function assistantName(source: string): string | null {
  if (source === 'app') return null;
  return source in strings.assistants ? strings.assistants[source as keyof typeof strings.assistants] : strings.assistants.other;
}

/**
 * Spec 051 FR-015: where a recipe comes from, as the list, its page and the shared page show it:
 * its source ("La Cuisine de Mamie · p. 48"), else the assistant that made it ("ChatGPT"), else
 * who added it ("Mia"). Never "{name} · via {assistant}"; the activity log keeps that.
 */
export function recipeSource(recipe: { source_text: string | null; source: string }, creatorName: string | null): string {
  const text = recipe.source_text?.trim();
  if (text) return text;
  if (recipe.source !== 'app') return recipe.source in strings.assistants && recipe.source !== 'other' ? (assistantName(recipe.source) as string) : strings.recipe.anAssistant;
  return creatorName ?? strings.recipe.formerMember;
}

/** A member's name by user id, or null when they left (`recipeSource` then says "Former member"). */
export const memberName = (userId: string | null, members: readonly Pick<Member, 'user_id' | 'display_name'>[]) =>
  members.find((m) => m.user_id === userId)?.display_name ?? null;
