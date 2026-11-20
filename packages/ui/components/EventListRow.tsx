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
 * `sm` is Home's calendar card (CalCard): min 50, 5 stripe, 32 avatar, title 16, sub-line 13.
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
        className={cn(sm ? 'min-h-[50px] gap-10 py-4' : 'min-h-[64px] gap-12 py-8', 'flex-row items-center active:bg-surface-card-pressed', focusRing)}
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

/** One line of the week (ListRow README › Week rows, CalCard): stripe, "Morning run · 06:30 · Gabriel". */
export interface WeekEventItem {
  key: string;
  title: string;
  /** "06:30 · Gabriel": when and who, after the title. */
  detail: string;
  colors: readonly EventColor[];
  /** For screen readers: the whole row in one sentence, its day first. */
  label: string;
}

/** One day of the week list: its label shows once, at the top of the group. */
export interface WeekEventDay {
  date: string;
  /** "Tue". */
  day: string;
  events: readonly WeekEventItem[];
}

/**
 * ListRow README › Week rows: one day's events, the day label (40 wide) once at the top, rows of a
 * 5 × 26 stripe and one line with an ellipsis (min 44), no lines inside the day; a divider above
 * every day but the first.
 */
export function WeekEventGroup({ group, onPress, first }: { group: WeekEventDay; onPress: (key: string) => void; first?: boolean }) {
  return (
    <View className={cn('flex-row items-start gap-10', !first && 'border-t-[1.5px] border-line')}>
      <Text aria-hidden size={13} weight="900" color="ink-muted" className="w-[40px] flex-none pt-12">
        {group.day}
      </Text>
      <View role="list" className="min-w-0 flex-1">
        {group.events.map((event) => (
          <View key={event.key} role="listitem">
            <Pressable
              role="link"
              aria-label={event.label}
              onPress={() => onPress(event.key)}
              className={cn('min-h-touch-min flex-row items-center gap-10 active:bg-surface-card-pressed', focusRing)}
            >
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
        ))}
      </View>
    </View>
  );
}

/** A reminder among a day's events (ListRow README › Reminder in the calendar, spec 058). */
export interface ReminderListItem {
  key: string;
  title: string;
  /** "15:00 · Gabriel", "Any time · Eva", "Gabriel · was due Mon", "Done just now". */
  sub: string;
  /** "2d late", "3h late"; null when it isn't. */
  late: string | null;
  /** "Snoozed": the pill in the late badge's place, on a snoozed one listed on the day it's back (spec 058). */
  snoozed?: string;
  done: boolean;
  /** A later repeat: its box can't be ticked before its day (pressing it says why). */
  future: boolean;
  /** Done, and can't be unticked any more (a repeat's earlier date, when a later one was done after it). */
  locked?: boolean;
  /** "Mark done: {title}" / "Mark not done: {title}"; a later repeat's says it can't be yet ("Not yet: {title}"). */
  toggleLabel: string;
  /** For screen readers: the whole row in one sentence. */
  label: string;
}

export interface ReminderListRowProps {
  item: ReminderListItem;
  onToggle: () => void;
  onOpen: () => void;
  /** Offline: the box keeps its look, not pressable. */
  disabled?: boolean;
}

/**
 * ListRow README › Reminder in the calendar: the 26 px tick box in a 44 × 44 target, where an event
 * has its stripe and avatar. A later repeat's box is half opacity and still answers a press (to say
 * why); the web keeps `aria-disabled` only on boxes that can't be pressed, so its name says it too.
 */
export function ReminderTick({ item, onToggle, disabled }: Omit<ReminderListRowProps, 'onOpen'>) {
  const off = disabled || item.future || item.locked;
  return (
    <Pressable
      role="checkbox"
      aria-checked={item.done}
      aria-label={item.toggleLabel}
      aria-disabled={off || undefined}
      disabled={disabled || item.locked}
      onPress={onToggle}
      className={cn('-mx-8 h-control-md w-[44px] flex-none items-center justify-center rounded-[12px]', !off && 'active:bg-surface-soft', focusRing)}
    >
      <View
        aria-hidden
        className={cn('h-[26px] w-[26px] items-center justify-center rounded-[8px]', item.done ? 'bg-olive' : 'border-[2.5px] border-line-dashed bg-surface-card', item.future && 'opacity-50')}
      >
        {item.done ? <Icon name="check" size={16} color="onOlive" /> : null}
      </View>
    </Pressable>
  );
}

/** The title, sub-line and late badge of a reminder in the calendar: one button that opens the drawer (not when done). */
export function ReminderListText({ item, onOpen }: Pick<ReminderListRowProps, 'item' | 'onOpen'>) {
  const text = (
    <>
      <Text size={17} weight="800" strike={item.done} color={item.done ? 'ink-muted' : 'ink'}>
        {item.title}
      </Text>
      <Text size={14} weight="700" color="ink-muted">
        {item.sub}
      </Text>
    </>
  );
  return (
    <>
      {item.done ? (
        <View className="min-w-0 flex-1 py-2">
          {text}
        </View>
      ) : (
        <Pressable role="button" aria-label={item.label} aria-haspopup="dialog" onPress={onOpen} className={cn('min-w-0 flex-1 rounded-[8px] py-2 active:bg-surface-soft', focusRing)}>
          {text}
        </Pressable>
      )}
      {item.late && !item.done ? (
        <View className="flex-none self-center rounded-full bg-warn-soft px-10 py-[5px]">
          <Text size={13} weight="900" color="warn">
            {item.late}
          </Text>
        </View>
      ) : item.snoozed && !item.done ? (
        <View className="flex-none self-center rounded-full bg-surface-soft px-10 py-[5px]">
          <Text size={13} weight="900" color="ink-muted">
            {item.snoozed}
          </Text>
        </View>
      ) : null}
    </>
  );
}

/**
 * ListRow README › Reminder in the calendar (OC-CalAgendaReminders): tick box, title and sub-line,
 * late badge; min 64 like an event row, so the two sit in one card but never look alike.
 */
export function ReminderListRow({ item, onToggle, onOpen, disabled, last }: ReminderListRowProps & { last?: boolean }) {
  return (
    <View role="listitem" className={cn('min-h-[64px] flex-row items-center gap-12 py-6', !last && 'border-b-[1.5px] border-line')}>
      <ReminderTick item={item} onToggle={onToggle} disabled={disabled} />
      <ReminderListText item={item} onOpen={onOpen} />
    </View>
  );
}
