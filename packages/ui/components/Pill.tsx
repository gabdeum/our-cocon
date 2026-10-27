import type { ReactNode } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import { cn, focusRing } from '../cn';
import { Avatar, type AvatarColor } from './Avatar';
import { Icon } from './Icon';
import { Text } from './Text';

interface ToggleProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  selected?: boolean;
  className?: string;
}

/** Filter pill (Pill README › filter): 40 tall, honey when selected. Multi-select filters. */
export function Pill({ label, selected = false, className, ...props }: ToggleProps) {
  return (
    <Pressable
      role="button"
      aria-pressed={selected}
      className={cn(
        'h-[40px] flex-row items-center gap-6 rounded-pill px-14',
        selected ? 'bg-honey active:bg-honey-pressed' : 'bg-surface-soft active:bg-surface-soft-pressed',
        focusRing,
        className,
      )}
      {...props}
    >
      <Text size={14} weight={selected ? '800' : '700'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** "Filters · 1" (Pill README › filter button): ink, filter icon, opens the filter sheet. */
export function FilterButton({ label, className, ...props }: Omit<ToggleProps, 'selected'>) {
  return (
    <Pressable
      role="button"
      className={cn('h-[40px] flex-row items-center gap-6 rounded-pill bg-ink px-14 active:bg-ink-pressed', focusRing, className)}
      {...props}
    >
      <Icon name="filter" size={18} color="onOlive" />
      <Text size={14} weight="800" color="on-olive" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Choice (Pill README › choice): 44 tall, olive when selected. One choice that changes content. */
export function Choice({ label, selected = false, className, ...props }: ToggleProps) {
  return (
    <Pressable
      role="button"
      aria-pressed={selected}
      className={cn(
        'h-control-md items-center justify-center rounded-pill px-18',
        selected ? 'bg-olive active:bg-olive-pressed' : 'bg-surface-soft active:bg-surface-soft-pressed',
        focusRing,
        className,
      )}
      {...props}
    >
      <Text size={15} weight="800" color={selected ? 'on-olive' : 'ink'} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export interface PersonPillProps extends ToggleProps {
  initial: string;
  color: AvatarColor;
}

/** Person (Pill README › person): 32 avatar + name; honey when selected (it's a filter). */
export function PersonPill({ label, initial, color, selected = false, className, ...props }: PersonPillProps) {
  return (
    <Pressable
      role="button"
      aria-pressed={selected}
      className={cn(
        'h-control-md flex-row items-center gap-8 rounded-pill pl-6 pr-14',
        selected ? 'bg-honey active:bg-honey-pressed' : 'bg-surface-soft active:bg-surface-soft-pressed',
        focusRing,
        className,
      )}
      {...props}
    >
      <Avatar initial={initial} color={color} size="sm" />
      <Text size={14} weight="700" numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A row of pills: filters scroll horizontally (wrap them in a ScrollView), choices wrap. */
export function PillRow({ children, wrap = true, className }: { children: ReactNode; wrap?: boolean; className?: string }) {
  return <View className={cn('flex-row items-center gap-8', wrap && 'flex-wrap', className)}>{children}</View>;
}
