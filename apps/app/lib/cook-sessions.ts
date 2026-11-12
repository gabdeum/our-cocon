import { useQuery, useQueryClient } from '@tanstack/react-query';
import { endCook, loadCooked, loadOpenCooks, reopenCook, startCook, type CookSession } from '@cocon/data';
import { isOldCook, MAX_TRACKED_STEPS, type CookedSummary, type CookProgress, type Tracker } from '@cocon/schemas';
import { strings } from '../strings/en';
import { clock } from './clock';
import type { RecipeDetail } from './recipe';
import type { Member } from './session';
import { useSession } from './session';
import type { Client } from './supabase';

export type { CookSession } from '@cocon/data';

/**
 * Spec 051: recipes being cooked. Keys start with `cook_sessions`, so a change from anyone in the
 * family refetches them (lib/sync.tsx): the "In progress" cards show on every phone.
 */
export const openCooksKey = (familyId: string) => ['cook_sessions', familyId, 'open'] as const;
export const cookedKey = (familyId: string, recipeId: string) => ['cook_sessions', familyId, 'cooked', recipeId] as const;

/** The family's recipes in progress, newest first (FR-003). */
export function useOpenCooks() {
  const { state, client } = useSession();
  const familyId = state.status === 'ready' ? state.family.id : null;
  return useQuery({ queryKey: openCooksKey(familyId ?? ''), queryFn: () => loadOpenCooks(client), enabled: familyId !== null });
}

/** How often the family cooked a recipe (FR-005). */
export function useCooked(recipeId: string | null) {
  const { state, client } = useSession();
  const familyId = state.status === 'ready' ? state.family.id : null;
  return useQuery({
    queryKey: cookedKey(familyId ?? '', recipeId ?? ''),
    queryFn: () => (recipeId ? loadCooked(client, recipeId) : null),
    enabled: familyId !== null && recipeId !== null,
  });
}

/** Refetches every cooking query after a write of ours (the live message does it for everyone else). */
export function useRefreshCooks() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['cook_sessions'] });
}

type Members = readonly Pick<Member, 'user_id' | 'display_name'>[];
const nameOf = (userId: string | null, members: Members) => members.find((m) => m.user_id === userId)?.display_name ?? strings.recipe.formerMember;

/** "18:40" in the member's clock, or null once it's been untouched for a day ("started yesterday"). */
function since(session: Pick<CookSession, 'started_at' | 'last_active_at'>, now: Date, use24h: boolean): string | null {
  if (isOldCook(session.last_active_at, now)) return null;
  const d = new Date(session.started_at);
  return clock(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`, use24h);
}

/** A cook's step count: the recipe's, or more when a variant added steps. */
export const stepTotal = (recipeSteps: number, session: Pick<CookSession, 'current_step'>) => Math.max(recipeSteps, session.current_step + 1, 1);

/** The list card's line (FR-003): "Step 3 of 6 · Gabriel · since 18:40". */
export function listLine(session: CookSession, total: number, members: Members, now: Date, use24h: boolean): string {
  return strings.recipes.cookLine(session.current_step + 1, total, nameOf(session.started_by, members), since(session, now, use24h));
}

/** The recipe page card (FR-004): its title and "Gabriel started at 18:40 · Classic, serves 6". */
export function pageCard(session: CookSession, recipe: Pick<RecipeDetail, 'variants'>, total: number, members: Members, now: Date, use24h: boolean) {
  const p = strings.recipePage;
  const variant = recipe.variants.length === 0 ? null : (recipe.variants.find((v) => v.id === session.variant_id)?.name ?? p.classic);
  return {
    title: p.cookingNow(session.current_step + 1, total),
    line: p.cookStarted(nameOf(session.started_by, members), since(session, now, use24h), variant, session.servings),
  };
}

/** Whole calendar days from `iso` to `now`, on this device's calendar. */
export function daysSince(iso: string, now: Date): number {
  const then = new Date(iso);
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(now) - day(then)) / 86_400_000);
}

/** FR-005: "Cooked 4 times · last by Eva, 3 weeks ago", "Cooked once · today"; null when never. */
export function cookedLine(summary: CookedSummary | null | undefined, members: Members, now: Date): string | null {
  if (!summary) return null;
  const when = strings.time.daysAgo(daysSince(summary.lastAt, now));
  return summary.times === 1 ? strings.recipePage.cookedOnce(when) : strings.recipePage.cookedTimes(summary.times, nameOf(summary.lastBy, members), when);
}

const minutesSince = (iso: string, now: Date) => Math.min(4320, Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000)));
const stepsSeen = (session: Pick<CookSession, 'current_step'>) => Math.min(session.current_step + 1, MAX_TRACKED_STEPS);

export interface CookDeps {
  client: Pick<Client, 'from'>;
  tracker: Tracker;
  now?: () => Date;
}

/** FR-005: Done. The server records when and by whom. */
export async function finishCook({ client, tracker, now = () => new Date() }: CookDeps, session: CookSession): Promise<void> {
  await endCook(client, session.id, 'done');
  tracker.track('cook_finished', { status: 'done', cancel_reason: null, steps_seen: stepsSeen(session), minutes: minutesSince(session.started_at, now()) });
}

/** FR-006: Cancel (it's no longer in progress, and isn't counted as cooked). */
export async function cancelCook({ client, tracker, now = () => new Date() }: CookDeps, session: CookSession): Promise<void> {
  await endCook(client, session.id, 'cancelled', 'user');
  tracker.track('cook_finished', { status: 'cancelled', cancel_reason: 'user', steps_seen: stepsSeen(session), minutes: minutesSince(session.started_at, now()) });
}

/** Undo of Done or Cancel: back in progress at the same step. */
export const undoEndCook = ({ client }: Pick<CookDeps, 'client'>, session: Pick<CookSession, 'id'>) => reopenCook(client, session.id);

/**
 * FR-002: "Start recipe" (or "Start over", which cancels `replacing` first). `resumed_existing`
 * is false: a resume never makes a new session.
 */
export async function beginCook(
  { client, tracker, now = () => new Date() }: CookDeps,
  familyId: string,
  recipeId: string,
  progress: CookProgress,
  replacing?: CookSession,
): Promise<CookSession> {
  const session = await startCook(client, familyId, recipeId, progress, replacing?.id);
  if (replacing) tracker.track('cook_finished', { status: 'cancelled', cancel_reason: 'replaced', steps_seen: stepsSeen(replacing), minutes: minutesSince(replacing.started_at, now()) });
  tracker.track('cook_started', { recipe_id: recipeId, resumed_existing: false });
  return session;
}
