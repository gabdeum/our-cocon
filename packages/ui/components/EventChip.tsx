import { Platform, Pressable, View, type TextStyle } from 'react-native';
import { cn, focusRing } from '../cn';
import type { AvatarColor } from './Avatar';
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
 * gradient). Others adds a 1 px line-handle outline so it shows on white.
 */
export function Fill({ colors, rounded }: { colors: readonly EventColor[]; rounded: string }) {
  const [first = 'others', second] = colors;
  return (
    <View aria-hidden className={cn('absolute inset-0 flex-row overflow-hidden', rounded)}>
      <View className={cn('flex-1', fills[first])} />
      {second ? <View className={cn('flex-1', fills[second])} /> : null}
      {colors.includes('others') ? <View className={cn('absolute inset-0 border border-line-handle', rounded)} /> : null}
    </View>
  );
}

// react-native-web always adds an ellipsis to one-line text, but lets the style override it (iOS uses ellipsizeMode).
const clipOnWeb = (Platform.OS === 'web' ? { textOverflow: 'clip' } : {}) as TextStyle;

/** 11/800 ink, one line, clipped at the padding with no "…" (EventChip README › Chip). */
function ChipText({ text }: { text: string }) {
  return (
    <Text size={11} weight="800" numberOfLines={1} ellipsizeMode="clip" style={[{ lineHeight: 20 }, clipOnWeb]}>
      {text}
    </Text>
  );
}

export interface EventChipProps {
  /** "{initials} {title}": "J Baby swim", "G·E School night". */
  text: string;
  /** One or two fills, in the event's member order. */
  colors: readonly EventColor[];
}

/**
 * A one-line event in a month cell (EventChip README): 20 tall, radius 6, padding 0 4. With
 * `onPress` it opens the event (a tap beside it opens the day), reaching into the gaps between chips.
 */
export function EventChip({ text, colors, onPress }: EventChipProps & { onPress?: () => void }) {
  const look = 'h-[20px] overflow-hidden rounded-xs px-4';
  if (!onPress) {
    return (
      <View className={look}>
        <Fill colors={colors} rounded="rounded-xs" />
        <ChipText text={text} />
      </View>
    );
  }
  return (
    <Pressable role="link" aria-label={text} onPress={onPress} hitSlop={{ top: 1, bottom: 2 }} className={cn(look, focusRing)}>
      <Fill colors={colors} rounded="rounded-xs" />
      <ChipText text={text} />
    </Pressable>
  );
}

/** The cell's "+N" after two chips: 11/900 ink-muted. */
export function MoreCount({ text }: { text: string }) {
  return (
    <Text size={11} weight="900" color="ink-muted" className="pl-[3px]">
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

/** The month row's chip rhythm (EventBar README › Month): 29 from the top, then 20 + the cells' 3 px gap. */
export const BAR_TOP = 29;
export const BAR_STEP = 23;
/** EventBar README › Week all-day row: 28 tall, stacked with the grid's 2 px gap. */
export const WEEK_BAR_HEIGHT = 28;
export const WEEK_BAR_STEP = 30;

/**
 * A multi-day event drawn over a month week row (EventBar README › Month), from its first to its
 * last day in the row so the title runs the full width. Inset 4 px each side, above the cells.
 */
export function EventBar({ text, colors, label, column, days, lane, startsHere, endsHere, onPress, size = 'month' }: EventBarProps) {
  const week = size === 'week';
  const rounded = week ? cn(startsHere && 'rounded-l-[8px]', endsHere && 'rounded-r-[8px]') : cn(startsHere && 'rounded-l-xs', endsHere && 'rounded-r-xs');
  // The outer box spans the days; its padding is the inset (no calc() in React Native): 4 px in a
  // month row, 1 px either side in the week row (the grid's 2 px gap).
  return (
    <View
      pointerEvents="box-none"
      className={cn('absolute z-10', week ? 'px-[1px]' : 'px-4')}
      style={{ top: week ? lane * WEEK_BAR_STEP : BAR_TOP + lane * BAR_STEP, left: `${(column * 100) / 7}%`, width: `${(days * 100) / 7}%` }}
    >
      <Pressable role="link" aria-label={label} onPress={onPress} className={cn('overflow-hidden', week ? 'h-[28px] px-6' : 'h-[20px] px-4', rounded, focusRing)}>
        <Fill colors={colors} rounded={rounded} />
        {week ? (
          <Text size={11} weight="800" numberOfLines={1} ellipsizeMode="clip" style={[{ lineHeight: WEEK_BAR_HEIGHT }, clipOnWeb]}>
            {text}
          </Text>
        ) : (
          <ChipText text={text} />
        )}
      </Pressable>
    </View>
  );
}
