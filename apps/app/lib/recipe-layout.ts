import { theme, type LayoutTier } from '@cocon/ui';

export interface RecipeLayout {
  /** From 960 (spec 067 FR-005): the rail and the Recipes list beside the recipe, in a framed panel. */
  split: boolean;
  /** FR-002: ingredients and steps side by side, no tabs, once the recipe itself has 600 to fill. */
  twoColumn: boolean;
  /** The photo header: 280 beside the columns, else the phone's 240. */
  photoHeight: number;
}

/**
 * How the recipe page lays out (spec 067; OC-RecipeResponsive's `detailW >= 600`). `width` is the
 * window; on the web it's capped at the app frame (1200 + the rail). Beside the rail and the list the
 * recipe has the rest, so from 960 to 1023 it keeps its tabs.
 */
export function recipeLayout(tier: LayoutTier, width: number, web = false): RecipeLayout {
  const { rail, panelExpanded, maxContent, medium, heroWide } = theme.layout;
  const split = tier === 'expanded';
  const frame = web && split ? Math.min(width, maxContent + rail) : width;
  const detail = split ? frame - rail - panelExpanded : frame;
  const twoColumn = tier !== 'compact' && detail >= medium;
  return { split, twoColumn, photoHeight: twoColumn ? heroWide : 240 };
}
