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

/** ListRow README › Event row: stripe, 36 avatar, title, sub-line and an optional tag; min 64 tall. */
export function EventListRow({ event, onPress, last }: { event: EventListItem; onPress: () => void; last?: boolean }) {
  const two = event.initials.length > 1;
  return (
    <View role="listitem" className={cn(!last && 'border-b-[1.5px] border-line')}>
      <Pressable
        role="link"
        aria-label={event.label}
        onPress={onPress}
        className={cn('min-h-[64px] flex-row items-center gap-12 py-8 active:bg-surface-card-pressed', focusRing)}
      >
        <View aria-hidden className="w-[6px] self-stretch flex-none">
          <Fill colors={event.colors} rounded="rounded-[3px]" />
        </View>
        <View aria-hidden className="h-[36px] w-[36px] flex-none items-center justify-center">
          <Fill colors={event.colors} rounded="rounded-full" />
          {event.colors[0] === 'others' && !event.initials ? (
            <Icon name="person" size={18} color="inkMuted" />
          ) : (
            <Text size={two ? 12 : 15} weight="900">
              {event.initials}
            </Text>
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text size={17} weight="800">
            {event.title}
          </Text>
          <Text size={14} weight="700" color="ink-muted">
            {event.sub}
          </Text>
        </View>
        {event.tag ? <Tag label={event.tag.label} tone={event.tag.tone} size="md" className="flex-none self-center" /> : null}
      </Pressable>
    </View>
  );
}
