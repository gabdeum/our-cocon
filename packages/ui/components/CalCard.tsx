import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { pressedState } from '../a11y';
import { cn, focusRing } from '../cn';
import { Fill, type EventColor } from './EventChip';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface CalCardProps {
  /** "Family calendar", for screen readers. */
  label: string;
  /** The header's left side: the Today · This week toggle, or a title. */
  header: ReactNode;
  /** The olive "+" (44): "Add event". */
  addLabel: string;
  onAdd: () => void;
  addDisabled?: boolean;
  children: ReactNode;
  /** "Open calendar ›" under a divider; none in the empty state. */
  footer?: { label: string; onPress: () => void };
}

/** Home's calendar card (CalCard README): white, radius 26, padding 14 16 12, gap 12. */
export function CalCard({ label, header, addLabel, onAdd, addDisabled, children, footer }: CalCardProps) {
  return (
    <View role="region" aria-label={label} className="gap-12 rounded-[26px] bg-surface-card px-16 pb-12 pt-14">
      <View className="flex-row items-center gap-10">
        <View className="min-w-0 flex-1">{header}</View>
        <Pressable
          role="button"
          aria-label={addLabel}
          aria-disabled={addDisabled || undefined}
          disabled={addDisabled}
          onPress={onAdd}
          className={cn('h-control-md w-control-md flex-none items-center justify-center rounded-full bg-olive active:bg-olive-pressed', addDisabled && 'opacity-dimmed', focusRing)}
        >
          <Icon name="plus" size={22} color="onOlive" />
        </Pressable>
      </View>
      {children}
      {footer ? (
        <Pressable
          role="link"
          onPress={footer.onPress}
          className={cn('min-h-touch-min flex-row items-center justify-between border-t-[1.5px] border-line pt-10', focusRing)}
        >
          <Text size={15} weight="800" color="olive">
            {footer.label}
          </Text>
          <Icon name="chevron-right" size={18} color="olive" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** CalCard README › Banner: a soft row with an icon, "Eva’s birthday is on Tuesday". */
export function CalCardBanner({ icon, text, onPress }: { icon: IconName; text: string; onPress: () => void }) {
  return (
    <Pressable
      role="link"
      onPress={onPress}
      className={cn('min-h-touch-min flex-row items-center gap-10 rounded-[16px] bg-surface-soft px-12 py-10 active:bg-surface-soft-pressed', focusRing)}
    >
      <Icon name={icon} size={20} color="peachInk" />
      <Text size={15} weight="800" className="min-w-0 flex-1">
        {text}
      </Text>
    </Pressable>
  );
}

export interface WeekStripDay {
  date: string;
  /** "S", "M". */
  letter: string;
  /** "25". */
  num: string;
  /** Up to 3 member colors. */
  dots: readonly EventColor[];
  today: boolean;
  /** "Today, October 25, 2 people busy". */
  label: string;
}

/**
 * WeekStrip README: seven tiles (min 62, radius 14), toggle buttons: tapping one picks that day,
 * tapping it again goes back to the whole week (`picked` null).
 */
export function WeekStrip({ days, picked, onDay }: { days: readonly WeekStripDay[]; picked: string | null; onDay: (date: string) => void }) {
  return (
    <View className="flex-row gap-4">
      {days.map((d) => {
        const empty = d.dots.length === 0;
        const on = d.date === picked;
        return (
          <Pressable
            key={d.date}
            role="button"
            aria-label={d.label}
            {...pressedState(on)}
            onPress={() => onDay(d.date)}
            className={cn(
              'min-h-[62px] min-w-0 flex-1 items-center justify-center gap-[2px] rounded-[14px]',
              on ? 'bg-olive' : d.today ? 'border-2 border-olive bg-surface-soft' : empty ? 'bg-transparent' : 'bg-surface-page',
              focusRing,
            )}
          >
            <Text size={12} weight="900" color={on ? 'on-olive' : 'ink-muted'}>
              {d.letter}
            </Text>
            <Text size={16} weight="900" color={on ? 'on-olive' : empty && !d.today ? 'ink-muted' : 'ink'} tabular>
              {d.num}
            </Text>
            <View aria-hidden className="h-[7px] flex-row gap-[2px]">
              {d.dots.slice(0, 3).map((c, i) => (
                <View key={i} className="h-[7px] w-[7px]">
                  <Fill colors={[c]} rounded="rounded-full" />
                </View>
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
