import { Platform, Pressable, View, type TextStyle } from 'react-native';
import { LARGE_TEXT_SCALE } from '../a11y';
import { cn, focusRing } from '../cn';
import { memberEdges, type AvatarColor } from './Avatar';
import { Text } from './Text';

/** An event's fill: a member color, Everyone, Others, or a member who left (grey). */
export type EventColor = AvatarColor;

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
};

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
      <View className={cn('absolute inset-0 border', memberEdges[first], rounded)} />
    </View>
  );
}

// react-native-web always adds an ellipsis to one-line text, but lets the style override it (iOS uses ellipsizeMode).
const clipOnWeb = (Platform.OS === 'web' ? { textOverflow: 'clip' } : {}) as TextStyle;

/** 10/800 ink, one line, clipped at the padding with no "…" (EventChip README › Chip). */
function ChipText({ text }: { text: string }) {
  // A 15 px chip can't grow: past the large-text size the month shows dots instead (spec 030).
  return (
    <Text size={10} weight="800" numberOfLines={1} ellipsizeMode="clip" maxFontSizeMultiplier={LARGE_TEXT_SCALE} style={[{ lineHeight: CHIP_HEIGHT }, clipOnWeb]}>
      {text}
    </Text>
  );
}

/** EventChip README › Chip: 15 tall, so five fit in a month cell. */
const CHIP_HEIGHT = 15;

export interface EventChipProps {
  /** "{initials} {title}" from 430 px ("J Baby swim", "G·E School night"); the title alone below. */
  text: string;
  /** One or two fills, in the event's member order. */
  colors: readonly EventColor[];
}

/**
 * A one-line event in a month cell (EventChip README): 15 tall, radius 4, padding 0 3. With
 * `onPress` it's a link of its own, reaching into the gaps between chips; the month grid passes none, so
 * a tap goes to the day (spec 037 FR-008).
 */
export function EventChip({ text, colors, onPress }: EventChipProps & { onPress?: () => void }) {
  const look = 'h-[15px] overflow-hidden rounded-[4px] px-[3px]';
  if (!onPress) {
    return (
      <View className={look}>
        <Fill colors={colors} rounded="rounded-[4px]" />
        <ChipText text={text} />
      </View>
    );
  }
  return (
    <Pressable role="link" aria-label={text} onPress={onPress} hitSlop={{ top: 1, bottom: 2 }} className={cn(look, focusRing)}>
      <Fill colors={colors} rounded="rounded-[4px]" />
      <ChipText text={text} />
    </Pressable>
  );
}

/** The cell's "+N" after four rows: 10/900 ink-muted. */
export function MoreCount({ text }: { text: string }) {
  return (
    <Text size={10} weight="900" color="ink-muted" className="pl-[3px]" maxFontSizeMultiplier={LARGE_TEXT_SCALE}>
      {text}
    </Text>
  );
}

export interface EventBarProps extends EventChipProps {
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
  onPress?: () => void;
  /** Month: over a week row of the grid. Week: in the week view's "All day" row. */
  size?: 'month' | 'week';
}

/** The month row's chip rhythm (EventBar README › Month): 23 from the top (3 padding, 18 date, 2 gap), then 15 + the cells' 2 px gap. */
export const BAR_TOP = 23;
export const BAR_STEP = 17;
/** EventBar README › Week all-day row: 28 tall, stacked with the grid's 2 px gap. */
export const WEEK_BAR_HEIGHT = 28;
export const WEEK_BAR_STEP = 30;

/**
 * A multi-day event drawn over a month week row (EventBar README › Month), from its first to its
 * last day in the row so the title runs the full width. Inset 3 px each side (the cells' padding), above the cells.
 * Without `onPress` it's only drawn: taps reach the cell under it (the month's day sheet).
 */
export function EventBar({ text, colors, label, column, days, lane, startsHere, endsHere, onPress, size = 'month' }: EventBarProps) {
  const week = size === 'week';
  const rounded = week ? cn(startsHere && 'rounded-l-[8px]', endsHere && 'rounded-r-[8px]') : cn(startsHere && 'rounded-l-[4px]', endsHere && 'rounded-r-[4px]');
  // The outer box spans the days; its padding is the inset (no calc() in React Native): 3 px in a
  // month row, 1 px either side in the week row (the grid's 2 px gap).
  const bar = cn('overflow-hidden', week ? 'h-[28px] px-6' : 'h-[15px] px-[3px]', rounded);
  const content = (
    <>
      <Fill colors={colors} rounded={rounded} />
      {week ? (
        <Text size={11} weight="800" numberOfLines={1} ellipsizeMode="clip" style={[{ lineHeight: WEEK_BAR_HEIGHT }, clipOnWeb]}>
          {text}
        </Text>
      ) : (
        <ChipText text={text} />
      )}
    </>
  );
  return (
    <View
      pointerEvents={onPress ? 'box-none' : 'none'}
      aria-hidden={!onPress}
      className={cn('absolute z-10', week ? 'px-[1px]' : 'px-[3px]')}
      style={{ top: week ? lane * WEEK_BAR_STEP : BAR_TOP + lane * BAR_STEP, left: `${(column * 100) / 7}%`, width: `${(days * 100) / 7}%` }}
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
