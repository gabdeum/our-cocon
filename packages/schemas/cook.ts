import { z } from 'zod';

/**
 * Spec 051 FR-001: a recipe being cooked. It stays in progress until someone marks it done or
 * cancels it; done sessions are the family's cooking log ("Cooked 4 times · last by Eva").
 */
export const CookStatus = z.enum(['in_progress', 'done', 'cancelled']);
export type CookStatus = z.infer<typeof CookStatus>;
export const CookCancelReason = z.enum(['user', 'stale', 'replaced', 'recipe_deleted']);
export type CookCancelReason = z.infer<typeof CookCancelReason>;

/** Where a cook is: the step (from 0), the variant and the servings it's cooked for. */
export const CookProgress = z.strictObject({
  current_step: z.int().min(0).max(200),
  variant_id: z.uuid().nullable(),
  servings: z.int().min(1).max(50),
});
export type CookProgress = z.infer<typeof CookProgress>;

const HOUR = 3_600_000;
/** Untouched this long, a session reads "started yesterday" (Needs your attention: a guess). */
export const COOK_YESTERDAY_HOURS = 24;
/** Untouched this long, it's cancelled as stale (the nightly purge) and no longer shown. */
export const COOK_STALE_HOURS = 72;

export const isStaleCook = (lastActiveAt: string, now: Date): boolean => now.getTime() - Date.parse(lastActiveAt) >= COOK_STALE_HOURS * HOUR;
export const isOldCook = (lastActiveAt: string, now: Date): boolean => now.getTime() - Date.parse(lastActiveAt) >= COOK_YESTERDAY_HOURS * HOUR;

/** FR-005: how often the family cooked a recipe, from its done sessions; never stored. */
export interface CookedSummary {
  times: number;
  lastBy: string | null;
  lastAt: string;
}

export function cookedSummary(done: readonly { finished_at: string | null; finished_by: string | null }[]): CookedSummary | null {
  const finished = done.filter((s): s is { finished_at: string; finished_by: string | null } => s.finished_at !== null);
  if (finished.length === 0) return null;
  const last = finished.reduce((a, b) => (Date.parse(b.finished_at) > Date.parse(a.finished_at) ? b : a));
  return { times: finished.length, lastBy: last.finished_by, lastAt: last.finished_at };
}
