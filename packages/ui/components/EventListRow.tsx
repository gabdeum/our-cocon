import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Fill, type EventColor } from './EventChip';
import { Icon } from './Icon';
import { Tag, type TagTone } from './Tag';
import { Text } from './Text';

/** One event in a list (ListRow README › Event row). */
export interface EventListItem {
  key: string;
  title: string;
  /** "14:30 · Gabriel takes James", "Lunch · Grandma’s house", "All day". */
  sub: string;
  /** "Now" (honey), "Surprise" (sage), "Day 1 of 3" or "Birthday" (soft); null for none. */
  tag: { label: string; tone: Extract<TagTone, 'honey' | 'sage' | 'soft'> } | null;
  /** In the avatar: "G", "All", "G·E"; empty for Others. */
  initials: string;
  colors: readonly EventColor[];
  /** For screen readers: the whole row in one sentence. */
  label: string;
  /** A reminder due today (Home's calendar card, spec 028): a bell before the title. */
  bell?: boolean;
}

/** ListRow README › Event row: a day's white card (radius 22, padding 4 14 4 10) holding its rows. */
export function EventListGroup({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <View className="gap-8">
      <Text role="heading" size={18} weight="900">
        {heading}
      </Text>
      <View role="list" className="rounded-xl bg-surface-card py-4 pl-10 pr-14">
        {children}
      </View>
    </View>
  );
}

/**
 * ListRow README › Event row: stripe, 36 avatar, title, sub-line and an optional tag; min 64 tall.
 * `sm` is Home's calendar card (CalCard): min 58, 5 stripe, 32 avatar, title 16, sub-line 13.
 */
export function EventListRow({ event, onPress, last, size = 'md' }: { event: EventListItem; onPress: () => void; last?: boolean; size?: 'sm' | 'md' }) {
  const two = event.initials.length > 1;
  const sm = size === 'sm';
  return (
    <View role="listitem" className={cn(!last && 'border-b-[1.5px] border-line')}>
      <Pressable
        role="link"
        aria-label={event.label}
        onPress={onPress}
        className={cn(sm ? 'min-h-[58px] gap-10 py-6' : 'min-h-[64px] gap-12 py-8', 'flex-row items-center active:bg-surface-card-pressed', focusRing)}
      >
        <View aria-hidden className={cn(sm ? 'w-[5px]' : 'w-[6px]', 'self-stretch flex-none')}>
          <Fill colors={event.colors} rounded="rounded-[3px]" />
        </View>
        <View aria-hidden className={cn(sm ? 'h-[32px] w-[32px]' : 'h-[36px] w-[36px]', 'flex-none items-center justify-center')}>
          <Fill colors={event.colors} rounded="rounded-full" />
          {event.colors[0] === 'others' && !event.initials ? (
            <Icon name="person" size={sm ? 16 : 18} color="inkMuted" />
          ) : (
            <Text size={two ? (sm ? 11 : 12) : sm ? 14 : 15} weight="900">
              {event.initials}
            </Text>
          )}
        </View>
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-6">
            {event.bell ? <Icon name="bell" size={16} color="olive" /> : null}
            <Text size={sm ? 16 : 17} weight="800" className="min-w-0 shrink">
              {event.title}
            </Text>
          </View>
          <Text size={sm ? 13 : 14} weight="700" color="ink-muted">
            {event.sub}
          </Text>
        </View>
        {event.tag ? <Tag label={event.tag.label} tone={event.tag.tone} size="md" className="flex-none self-center" /> : null}
      </Pressable>
    </View>
  );
}

/** One line of the week (ListRow README › Week row, CalCard): "Tue", stripe, "Yoga · Eva · Evening". */
export interface WeekEventItem {
  key: string;
  /** "Tue". */
  day: string;
  title: string;
  /** "Eva · Evening": who and when, after the title. */
  detail: string;
  colors: readonly EventColor[];
  /** For screen readers: the whole row in one sentence. */
  label: string;
}

/** ListRow README › Week row: day 40 wide, 5 × 26 stripe, one line with an ellipsis; min 44. */
export function WeekEventRow({ event, onPress, last }: { event: WeekEventItem; onPress: () => void; last?: boolean }) {
  return (
    <View role="listitem" className={cn(!last && 'border-b-[1.5px] border-line')}>
      <Pressable
        role="link"
        aria-label={event.label}
        onPress={onPress}
        className={cn('min-h-touch-min flex-row items-center gap-10 active:bg-surface-card-pressed', focusRing)}
      >
        <Text size={13} weight="900" color="ink-muted" className="w-[40px] flex-none">
          {event.day}
        </Text>
        <View aria-hidden className="h-[26px] w-[5px] flex-none">
          <Fill colors={event.colors} rounded="rounded-[3px]" />
        </View>
        <Text size={15} weight="800" numberOfLines={1} className="min-w-0 flex-1">
          {event.title}
          <Text size={15} weight="700" color="ink-muted">
            {` · ${event.detail}`}
          </Text>
        </Text>
      </Pressable>
    </View>
  );
}
