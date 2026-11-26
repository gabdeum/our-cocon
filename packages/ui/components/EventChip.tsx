import { Platform, Pressable, View, type TextStyle } from 'react-native';
import { LARGE_TEXT_SCALE } from '../a11y';
import { cn, focusRing } from '../cn';
import { memberEdges, type AvatarColor } from './Avatar';
import { Icon } from './Icon';
import { Text } from './Text';

/** An event's fill: a member color, Everyone, Others, a member who left (grey), or a Travel event's own color. */
export type EventColor = AvatarColor | 'travel';

/** A Travel event: its own fill, and the plane before its title. */
export const isTravelLook = (colors: readonly EventColor[]) => colors[0] === 'travel';

const fills: Record<EventColor, string> = {
  honey: 'bg-member-honey',
  rose: 'bg-member-rose',
  sky: 'bg-member-sky',
  mint: 'bg-member-mint',
  lilac: 'bg-member-lilac',
  peach: 'bg-member-peach',
  pistachio: 'bg-member-pistachio',
  clay: 'bg-member-clay',
  everyone: 'bg-member-everyone',
  others: 'bg-member-others',
  removed: 'bg-member-removed',
  travel: 'bg-event-travel',
};

const edges: Record<EventColor, string> = { ...memberEdges, travel: 'border-event-travel-edge' };

/**
 * EventChip README › Fill: one color, or two split 50/50 (two flat halves: React Native has no CSS
 * gradient), inside a 1 px outline in the first color's edge so it shows on white (spec 030 FR-007).
 */
export function Fill({ colors, rounded }: { colors: readonly EventColor[]; rounded: string }) {
  const [first = 'others', second] = colors;
  return (
    <View aria-hidden className={cn('absolute inset-0 flex-row overflow-hidden', rounded)}>
      <View className={cn('flex-1', fills[first])} />
      {second ? <View className={cn('flex-1', fills[second])} /> : null}
      <View className={cn('absolute inset-0 border', edges[first], rounded)} />
    </View>
  );
}

// react-native-web always adds an ellipsis to one-line text, but lets the style override it (iOS uses ellipsizeMode).
const clipOnWeb = (Platform.OS === 'web' ? { textOverflow: 'clip' } : {}) as TextStyle;

/** Phone chips, or the month's larger ones from 600 wide (spec 070). */
export type ChipSize = 'phone' | 'wide';

/** EventChip README › Chip: 15 tall, so five fit in a month cell; from 600, 20 tall with 12 px text, radius 6, padding 6. */
const CHIP = {
  phone: { height: 15, text: 10, box: 'h-[15px] rounded-[4px] px-[3px]', rounded: 'rounded-[4px]', start: 'rounded-l-[4px]', end: 'rounded-r-[4px]' },
  wide: { height: 20, text: 12, box: 'h-[20px] rounded-[6px] px-6', rounded: 'rounded-[6px]', start: 'rounded-l-[6px]', end: 'rounded-r-[6px]' },
} as const;

/** 10/800 ink (12 from 600), one line, clipped at the padding with no "…" (EventChip README › Chip); the plane first on a Travel event. */
function ChipText({ text, size = 'phone', travel }: { text: string; size?: ChipSize; travel?: boolean }) {
  // A chip can't grow: past the large-text size the month shows dots instead (spec 030).
  const line = (
    <Text size={CHIP[size].text} weight="800" numberOfLines={1} ellipsizeMode="clip" maxFontSizeMultiplier={LARGE_TEXT_SCALE} className={cn(travel && 'min-w-0 shrink')} style={[{ lineHeight: CHIP[size].height }, clipOnWeb]}>
      {text}
    </Text>
  );
  if (!travel) return line;
  return (
    <View className="flex-row items-center gap-[2px]">
      <TravelMark size={CHIP[size].text} />
      {line}
    </View>
  );
}

/** The plane before a Travel event's title, the size of its text. */
export function TravelMark({ size }: { size: number }) {
  return (
    <View aria-hidden className="flex-none">
      <Icon name="plane" size={size} color="ink" />
    </View>
  );
}

export interface EventChipProps {
  /** "{initials} {title}" from 430 px ("J Baby swim", "G·E School night"); the title alone below. */
  text: string;
  /** One or two fills, in the event's member order. */
  colors: readonly EventColor[];
  /** From 600 wide, the month's 20 px chips (spec 070). */
  size?: ChipSize;
}

/**
 * A one-line event in a month cell (EventChip README): 15 tall, radius 4, padding 0 3. With
 * `onPress` it's a link of its own, reaching into the gaps between chips; the month grid passes none, so
 * a tap goes to the day (spec 037 FR-008).
 */
export function EventChip({ text, colors, onPress, size = 'phone' }: EventChipProps & { onPress?: () => void }) {
  const c = CHIP[size];
  const look = cn('overflow-hidden', c.box);
  if (!onPress) {
    return (
      <View className={look}>
        <Fill colors={colors} rounded={c.rounded} />
        <ChipText text={text} size={size} travel={isTravelLook(colors)} />
      </View>
    );
  }
  return (
    <Pressable role="link" aria-label={text} onPress={onPress} hitSlop={{ top: 1, bottom: 2 }} className={cn(look, focusRing)}>
      <Fill colors={colors} rounded={c.rounded} />
      <ChipText text={text} size={size} travel={isTravelLook(colors)} />
    </Pressable>
  );
}

/** The cell's "+N" after the last row: 10/900 ink-muted (12/900 from 600). */
export function MoreCount({ text, size = 'phone' }: { text: string; size?: ChipSize }) {
  return (
    <Text size={size === 'wide' ? 12 : 10} weight="900" color="ink-muted" className="pl-[3px]" maxFontSizeMultiplier={LARGE_TEXT_SCALE}>
      {text}
    </Text>
  );
}

export interface EventBarProps extends Omit<EventChipProps, 'size'> {
  /** "Grandma visits, October 16 to October 19". */
  label: string;
  /** First column (0–6) and number of days in this week row. */
  column: number;
  days: number;
  /** Stacked bars: 0 is the top row. */
  lane: number;
  /** Rounded where the event really starts or ends; square where it continues in another row. */
  startsHere: boolean;
  endsHere: boolean;
  /**
   * Back-to-back trips for the same people: the first stops at the middle of the day they change
   * places and the next starts there, sharing one row instead of stacking.
   */
  halfStart?: boolean;
  halfEnd?: boolean;
  onPress?: () => void;
  /** Month: over a week row of the grid. Week: in the week view's "All day" row. `-wide`: their sizes from 600 (spec 070). */
  size?: 'month' | 'week' | 'month-wide' | 'week-wide';
}

/** The month row's chip rhythm (EventBar README › Month): 23 from the top (3 padding, 18 date, 2 gap), then 15 + the cells' 2 px gap. */
export const BAR_TOP = 23;
export const BAR_STEP = 17;
/** From 600 (spec 070): 32 from the top (6 padding, 24 date, 2 gap), then 20 + 2. */
export const WIDE_BAR_TOP = 32;
export const WIDE_BAR_STEP = 22;
/** EventBar README › Week all-day row: 28 tall, stacked with the grid's 2 px gap; 32 from 600. */
export const WEEK_BAR_HEIGHT = 28;
export const WEEK_BAR_STEP = 30;
export const WIDE_WEEK_BAR_HEIGHT = 32;
export const WIDE_WEEK_BAR_STEP = 34;

/**
 * A multi-day event drawn over a month week row (EventBar README › Month), from its first to its
 * last day in the row so the title runs the full width. Inset 3 px each side (the cells' padding), above the cells.
 * Without `onPress` it's only drawn: taps reach the cell under it (the month's day sheet).
 */
export function EventBar({ text, colors, label, column, days, lane, startsHere, endsHere, halfStart, halfEnd, onPress, size = 'month' }: EventBarProps) {
  const week = size === 'week' || size === 'week-wide';
  const wide = size === 'month-wide' || size === 'week-wide';
  const chip = CHIP[wide ? 'wide' : 'phone'];
  const rounded = week ? cn(startsHere && 'rounded-l-[8px]', endsHere && 'rounded-r-[8px]') : cn(startsHere && chip.start, endsHere && chip.end);
  // The outer box spans the days; its padding is the inset (no calc() in React Native): 3 px in a
  // month row (6 from 600), 1 px either side in the week row (the grid's 2 px gap).
  const bar = cn('overflow-hidden', week ? (wide ? 'h-[32px] px-8' : 'h-[28px] px-6') : wide ? 'h-[20px] px-6' : 'h-[15px] px-[3px]', rounded);
  const top = week ? lane * (wide ? WIDE_WEEK_BAR_STEP : WEEK_BAR_STEP) : wide ? WIDE_BAR_TOP + lane * WIDE_BAR_STEP : BAR_TOP + lane * BAR_STEP;
  const travel = isTravelLook(colors);
  const content = (
    <>
      <Fill colors={colors} rounded={rounded} />
      {week ? (
        <View className="flex-row items-center gap-[3px]">
          {travel ? <TravelMark size={wide ? 14 : 11} /> : null}
          <Text size={wide ? 14 : 11} weight="800" numberOfLines={1} ellipsizeMode="clip" className="min-w-0 shrink" style={[{ lineHeight: wide ? WIDE_WEEK_BAR_HEIGHT : WEEK_BAR_HEIGHT }, clipOnWeb]}>
            {text}
          </Text>
        </View>
      ) : (
        <ChipText text={text} size={wide ? 'wide' : 'phone'} travel={travel} />
      )}
    </>
  );
  const from = column + (halfStart ? 0.5 : 0);
  const span = days - (halfStart ? 0.5 : 0) - (halfEnd ? 0.5 : 0);
  return (
    <View
      pointerEvents={onPress ? 'box-none' : 'none'}
      aria-hidden={!onPress}
      className={cn('absolute z-10', week ? 'px-[1px]' : wide ? 'px-6' : 'px-[3px]')}
      style={{ top, left: `${(from * 100) / 7}%`, width: `${(span * 100) / 7}%` }}
    >
      {onPress ? (
        <Pressable role="link" aria-label={label} onPress={onPress} className={cn(bar, focusRing)}>
          {content}
        </Pressable>
      ) : (
        <View className={bar}>{content}</View>
      )}
    </View>
  );
}
