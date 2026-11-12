import { COOK_STALE_HOURS, CookProgress, cookedSummary, isStaleCook, type CookCancelReason, type CookedSummary, type CookStatus } from '@cocon/schemas';
import type { Db } from './client';

/** Spec 051: a recipe being cooked, as the cards and cooking mode show it. */
export interface CookSession {
  id: string;
  recipe_id: string;
  started_by: string | null;
  started_at: string;
  last_active_at: string;
  current_step: number;
  variant_id: string | null;
  servings: number;
  status: CookStatus;
}

const columns = 'id, recipe_id, started_by, started_at, last_active_at, current_step, variant_id, servings, status';

/** FR-003: the family's sessions in progress, newest first; one stale but not yet cancelled is left out. */
export async function loadOpenCooks(client: Pick<Db, 'from'>, now = new Date()): Promise<CookSession[]> {
  const { data, error } = await client.from('cook_sessions').select(columns).eq('status', 'in_progress').order('started_at', { ascending: false });
  if (error) throw error;
  return (data as CookSession[]).filter((s) => !isStaleCook(s.last_active_at, now));
}

/** One session by id (the Done sheet after cooking mode), or null when it isn't the family's. */
export async function loadCook(client: Pick<Db, 'from'>, id: string): Promise<CookSession | null> {
  const { data, error } = await client.from('cook_sessions').select(columns).eq('id', id).maybeSingle();
  if (error) throw error;
  return data as CookSession | null;
}

/** FR-005: how often the family cooked a recipe, and who did last (spec 023 `get_recipe` too). */
export async function loadCooked(client: Pick<Db, 'from'>, recipeId: string): Promise<CookedSummary | null> {
  const { data, error } = await client.from('cook_sessions').select('finished_at, finished_by').eq('recipe_id', recipeId).eq('status', 'done');
  if (error) throw error;
  return cookedSummary(data);
}

/**
 * FR-002: "Start recipe". With `replace` (Start over), the open session is cancelled first;
 * without it, an open one makes the insert fail (the database keeps one per recipe).
 */
export async function startCook(client: Pick<Db, 'from'>, familyId: string, recipeId: string, progress: CookProgress, replace?: string): Promise<CookSession> {
  if (replace) await endCook(client, replace, 'cancelled', 'replaced');
  // A cook untouched for 72 hours is hidden but still open until the nightly job: it ends here.
  const stale = new Date(Date.now() - COOK_STALE_HOURS * 3_600_000).toISOString();
  const cleared = await client
    .from('cook_sessions')
    .update({ status: 'cancelled', cancel_reason: 'stale' })
    .eq('recipe_id', recipeId)
    .eq('status', 'in_progress')
    .lt('last_active_at', stale);
  if (cleared.error) throw cleared.error;
  const { data, error } = await client
    .from('cook_sessions')
    .insert({ family_id: familyId, recipe_id: recipeId, ...CookProgress.parse(progress) })
    .select(columns)
    .single();
  if (error) throw error;
  return data as CookSession;
}

/** FR-002: the step cooking mode is on (the server stamps `last_active_at`). */
export async function saveCookStep(client: Pick<Db, 'from'>, id: string, step: number): Promise<void> {
  const { error } = await client.from('cook_sessions').update({ current_step: CookProgress.shape.current_step.parse(step) }).eq('id', id).eq('status', 'in_progress');
  if (error) throw error;
}

/**
 * FR-005, FR-006: Done or Cancel; the server records when and by whom. Throws when it's no longer
 * in progress (someone else ended it a moment ago).
 */
export async function endCook(client: Pick<Db, 'from'>, id: string, status: Exclude<CookStatus, 'in_progress'>, reason?: Exclude<CookCancelReason, 'stale' | 'recipe_deleted'>): Promise<void> {
  const { data, error } = await client
    .from('cook_sessions')
    .update({ status, cancel_reason: status === 'cancelled' ? (reason ?? 'user') : null })
    .eq('id', id)
    .eq('status', 'in_progress')
    .select('id');
  if (error) throw error;
  if (data.length === 0) throw new Error('That cook has already ended');
}

/** Undo of Done or Cancel, within the hour: back in progress at the same step. Fails if the recipe was started again since. */
export async function reopenCook(client: Pick<Db, 'from'>, id: string): Promise<void> {
  const { error } = await client.from('cook_sessions').update({ status: 'in_progress', cancel_reason: null }).eq('id', id).neq('status', 'in_progress');
  if (error) throw error;
}
