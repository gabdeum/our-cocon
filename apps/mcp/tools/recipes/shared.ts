import { z } from 'zod';
import { Cuisine } from '@cocon/schemas';
import { ToolError, type ToolContext } from '../../src/tools.js';

/** How the app names each assistant ("Gabriel · via Claude"). */
const assistantLabels: Record<string, string> = { claude: 'Claude', chatgpt: 'ChatGPT', gemini: 'Gemini' };
export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

export const RecipeId = z.uuid({ error: 'Use a recipe id from search_recipes.' }).describe('The recipe’s id, from search_recipes.');

/** The recipe's page in the app. */
export const recipeLink = (ctx: Pick<ToolContext, 'appUrl'>, id: string) => `${ctx.appUrl}/recipes/${id}`;

export interface Member {
  user_id: string;
  display_name: string;
}

/**
 * The caller's family, for "added by" (RLS returns only their family's members). Members without
 * the app (spec 033) never add anything, so only account members.
 */
export async function loadMembers(ctx: Pick<ToolContext, 'db'>): Promise<Member[]> {
  const { data, error } = await ctx.db.from('members').select('user_id, display_name').order('joined_at');
  if (error) throw error;
  return data.flatMap((m) => (m.user_id === null ? [] : [{ user_id: m.user_id, display_name: m.display_name }]));
}

/** "Gabriel", or "Gabriel · via Claude" when an assistant added it (the app's wording). */
export function addedBy(createdBy: string | null, source: string, members: readonly Member[]): string {
  const name = members.find((m) => m.user_id === createdBy)?.display_name ?? 'A former member';
  if (source === 'app') return name;
  return `${name} · via ${assistantLabels[source] ?? 'an AI assistant'}`;
}

/**
 * Spec 023 FR-002a: a cuisine key from spec 006's list. `other` is allowed where it can mean
 * "no cuisine" (filters). Anything else gets the sentence the assistant fixes it from.
 */
export function cuisineKey(value: string, allowOther: boolean): Cuisine | 'other' {
  const key = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (allowOther && key === 'other') return 'other';
  const parsed = Cuisine.safeParse(key);
  if (parsed.success) return parsed.data;
  throw new ToolError(`Unknown cuisine '${value}'. Use one of: ${Cuisine.options.join(', ')}${allowOther ? ', or other for recipes with no cuisine' : ', or leave it empty'}.`);
}
