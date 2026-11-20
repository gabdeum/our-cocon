import { useWindowDimensions } from 'react-native';
import { theme } from './theme';

// Layout tiers for larger screens (spec 063, design/ui/OC-LargeScreens.md): by window width, never
// by device, so an iPad in a narrow split view gets the phone layout.

export type LayoutTier = 'compact' | 'medium' | 'expanded';

/** compact below 600 (today's phone app), medium 600–959, expanded from 960. */
export function layoutTier(width: number): LayoutTier {
  if (width >= theme.layout.expanded) return 'expanded';
  if (width >= theme.layout.medium) return 'medium';
  return 'compact';
}

/**
 * The window's tier and size, live on rotation, split-view and browser resizing (FR-001). Only
 * re-renders: nothing remounts, so running timers, scroll positions and open steps stay.
 */
export function useLayoutTier(): { tier: LayoutTier; width: number; height: number } {
  const { width, height } = useWindowDimensions();
  return { tier: layoutTier(width), width, height };
}

/** Side gutter: 20 on the phone, 24 from 600 (FR-003). */
export function gutterFor(tier: LayoutTier): number {
  return tier === 'compact' ? theme.layout.gutter : theme.layout.gutterWide;
}

/** Navigation (spec 064): the floating tab bar below 960, the side rail from 960. */
export function navFor(tier: LayoutTier): 'bar' | 'rail' {
  return tier === 'expanded' ? 'rail' : 'bar';
}

/** Where tab screens' content starts (spec 064 FR-003): after the 104 rail at expanded, else the edge. */
export function railInset(tier: LayoutTier): number {
  return tier === 'expanded' ? theme.layout.rail : 0;
}

/**
 * Space under a tab screen's content (spec 064 FR-003): 180 for the floating tab bar and timer pill
 * (TabBar README) below 960; 28 beside the rail, where nothing floats at the bottom.
 */
export function tabBottomPad(tier: LayoutTier): number {
  return tier === 'expanded' ? 28 : 180;
}

/**
 * A list laid out in `columns` columns that read by column (FR-004): order kept, column 1 filled
 * top to bottom, then column 2. Each item goes where its middle falls, so a column breaks at the cut
 * nearest its equal share of the total weight. Column 1 is never empty; later ones can be.
 */
export function splitColumns<T>(items: readonly T[], columns: number, weight: (item: T) => number = () => 1): T[][] {
  const count = Math.max(1, Math.floor(columns));
  const out: T[][] = Array.from({ length: count }, () => []);
  const weighed = items.map((item) => ({ item, w: weight(item) }));
  const share = weighed.reduce((sum, { w }) => sum + w, 0) / count;
  let col = 0;
  let before = 0;
  for (const { item, w } of weighed) {
    while (col < count - 1 && (out[col]?.length ?? 0) > 0 && before + w / 2 > share * (col + 1)) col += 1;
    out[col]?.push(item);
    before += w;
  }
  return out;
}

/** How a sheet shows (spec 065 FR-001): what it is for, declared once by each sheet. */
export type SheetKind = 'menu' | 'flow';
export type SheetPresentation = 'sheet' | 'popover' | 'card';

/** The bottom sheet below 600; from 600, a popover for short choices, a centred card for longer flows. */
export function sheetPresentation(tier: LayoutTier, kind: SheetKind): SheetPresentation {
  if (tier === 'compact') return 'sheet';
  return kind === 'menu' ? 'popover' : 'card';
}

/** The presentation a sheet of this kind has right now, for its events (`presentation`). */
export function useSheetPresentation(kind: SheetKind): SheetPresentation {
  return sheetPresentation(useLayoutTier().tier, kind);
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PopoverPlacement {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  /** The arrow's left, inside the popover's 1.5 border, so its centre sits on the anchor's centre (SC-002). */
  arrowLeft: number;
  /** Opened above the anchor (no room below): the arrow is at the bottom, pointing down. */
  above: boolean;
}

/** Space between the anchor and the popover, the popover and the window edge, and the arrow's size. */
export const POPOVER = { gap: 12, edge: 16, arrow: 14, border: 1.5, radius: 22 } as const;

/**
 * Where a popover opens (FR-002): 12 below the anchor, under the anchor's left edge when there's
 * room, else with its right edge 16 from the window's. Its arrow is centred on the anchor's centre.
 * Taller than the room below (`height`, once measured) and with more room above, it opens above.
 */
export function popoverPlacement(anchor: Rect, win: { width: number; height: number }, height?: number): PopoverPlacement {
  const { gap, edge, arrow, border, radius } = POPOVER;
  const width = Math.min(theme.layout.popover, win.width - 2 * edge);
  const left = Math.max(edge, anchor.x + width <= win.width - edge ? anchor.x : win.width - edge - width);
  const below = anchor.y + anchor.height + gap;
  const roomBelow = win.height - edge - below;
  const roomAbove = anchor.y - gap - edge;
  const above = height != null && height > roomBelow && roomAbove > roomBelow;
  const top = above ? Math.max(edge, anchor.y - gap - (height ?? 0)) : below;
  const centre = anchor.x + anchor.width / 2;
  // Kept clear of the rounded corners when the anchor sits past them.
  const arrowLeft = Math.min(Math.max(centre - left - border - arrow / 2, radius / 2), width - 2 * border - arrow - radius / 2);
  return { left, top, width, maxHeight: above ? roomAbove : roomBelow, arrowLeft, above };
}
