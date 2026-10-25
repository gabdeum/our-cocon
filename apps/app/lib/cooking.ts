import type { RecipeDetail } from './recipe';

/**
 * Cooking mode's scroll rules (spec 012, design/ui/OC-Cook.md › Behaviour). Pure, so the screen
 * only measures and scrolls.
 */

/** The current step is the last one whose top is above this share of the scroll area. */
export const CURRENT_AT = 0.35;
/** Next, Back and segment taps land this far above the step's top. */
export const SCROLL_OFFSET = 8;
/** FR-004: scroll tracking pauses this long after a programmatic scroll. */
export const SCROLL_LOCK_MS = 700;
/**
 * Opened at a step: for this long, any layout change (text reflowing as fonts load, steps above
 * growing, the page not yet tall enough to scroll that far) scrolls to the step again, unless the
 * person has scrolled by then.
 */
export const OPEN_SETTLE_MS = 2000;

/** 0-based: the last step whose top (in the scroll content) is above 35% of the visible height. */
export function currentStep(stepTops: readonly number[], scrollTop: number, viewportHeight: number): number {
  let best = 0;
  stepTops.forEach((top, i) => {
    if (top - scrollTop < viewportHeight * CURRENT_AT) best = i;
  });
  return best;
}

/** Where to scroll for a step whose top is `stepTop`. */
export function scrollTarget(stepTop: number): number {
  return Math.max(0, stepTop - SCROLL_OFFSET);
}

/** Within a step taller than the screen, snap points are at most this far apart, less this overlap. */
export const SNAP_OVERLAP = 80;

/**
 * Where scrolling comes to rest (OC-Cook › Behaviour): each step's top (−8). A step taller than the
 * scroll area also stops with its bottom at the bottom of the screen, so one swipe reads to the end
 * of the step and the next one lands on the next step; a very tall step has stops in between too,
 * a screen apart less 80, so none of it is skipped. Sorted, no duplicates.
 */
export function snapPoints(stepTops: readonly number[], stepHeights: readonly number[], viewportHeight: number): number[] {
  const points = new Set<number>();
  stepTops.forEach((top, i) => {
    const start = scrollTarget(top);
    points.add(start);
    const height = stepHeights[i];
    if (height === undefined || viewportHeight <= 0) return;
    const end = top + height - viewportHeight;
    if (end <= start) return;
    const stride = Math.max(viewportHeight - SNAP_OVERLAP, 1);
    for (let at = start + stride; at < end; at += stride) points.add(Math.round(at));
    points.add(Math.round(end));
  });
  return [...points].sort((a, b) => a - b);
}

/** Whether a step is taller than the scroll area (so it also snaps at its end). */
export function isTall(stepHeight: number | undefined, viewportHeight: number): boolean {
  return stepHeight !== undefined && viewportHeight > 0 && stepHeight + SCROLL_OFFSET > viewportHeight;
}

/** Whole minutes spent cooking, for `cooking_finished` (at most a day). */
export function cookingMinutes(startedAt: number, now: number): number {
  return Math.min(1440, Math.max(0, Math.round((now - startedAt) / 60_000)));
}

/** Where cooking mode opens: the step with this id (from the Timers screen), else step 1. */
export function startIndex(stepIds: readonly string[], stepId: string | undefined): number {
  const i = stepId ? stepIds.indexOf(stepId) : -1;
  return i < 0 ? 0 : i;
}

/**
 * Whether a step timer's step can still be opened (032-later L19): its recipe is there and not
 * deleted, and the step is one of the recipe's own or one a variant adds (`<variant id>:<n>`).
 */
export function stepStillThere(
  recipe: Pick<RecipeDetail, 'deleted_at' | 'steps' | 'variants'> | null | undefined,
  stepId: string,
): boolean {
  if (!recipe || recipe.deleted_at) return false;
  if (recipe.steps.some((s) => s.id === stepId)) return true;
  return recipe.variants.some((v) => v.changes.some((change, i) => change.type === 'add_step' && `${v.id}:${i}` === stepId));
}
