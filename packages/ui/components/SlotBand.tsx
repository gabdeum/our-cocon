import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Fill, isTravelLook, TravelMark, type EventColor } from './EventChip';
import { ReminderListText, ReminderTick, type ReminderListItem, type ReminderListRowProps } from './EventListRow';
import { Icon } from './Icon';
import { Tag } from './Tag';
import { Text } from './Text';

/** One event in a band (SlotBand README › Event row). */
export interface DayEventItem {
  key: string;
  title: string;
  /** "Lunch · Grandma’s house", "14:30 · Aquatic Center". */
  time: string;
  /** "Gabriel takes James", when someone takes a member without the app. */
  driver: string | null;
  /** "Now" while it's happening; null otherwise. */
  nowText: string | null;
  /** In the avatar: "G", "All", "G·E"; empty for Others. */
  initials: string;
  colors: readonly EventColor[];
  /** For screen readers: the whole row in one sentence. */
  label: string;
}

/** A reminder in a band or in All day (spec 058). */
export type DayReminderItem = ReminderListItem & { kind: 'reminder' };

/** What a band holds: its events and reminders, by time. */
export type DayBandItem = (DayEventItem & { kind?: 'event' }) | DayReminderItem;

/** A time-of-day band (SlotBand README): "Morning 09:00–12:00", its events or the add row. */
export interface DayBand {
  key: string;
  title: string;
  hours: string;
  events: DayBandItem[];
  /** "+ Add in the morning", shown when the band has nothing in it. */
  addText: string;
  addLabel: string;
}

/** An "All day" row (OC-CalDay): the title and a tag ("Birthday", "Day 2 of 3"). */
export interface DayAllDayItem {
  key: string;
  title: string;
  tag: string | null;
  colors: readonly EventColor[];
  label: string;
  /** The trip the same people start that day, when this one ends it: the row is split in the middle. */
  next?: Omit<DayAllDayItem, 'next'>;
}

export interface SlotBandProps {
  band: DayBand;
  onEventPress: (key: string) => void;
  onAdd: () => void;
  /** A reminder's tick box and its title (spec 058). */
  onReminderToggle?: (key: string) => void;
  onReminderOpen?: (key: string) => void;
  /** Offline: reminders' boxes can't be ticked. */
  readOnly?: boolean;
}

/**
 * SlotBand README: a band's title and hours, then its event rows, or a dashed "+ Add in the …"
 * row when it has none (spec 039 FR-003, FR-004).
 */
export function SlotBand({ band, onEventPress, onAdd, onReminderToggle, onReminderOpen, readOnly }: SlotBandProps) {
  return (
    <View className="gap-8">
      <View role="heading" className="flex-row items-baseline gap-8">
        <Text size={18} weight="900">
          {band.title}
        </Text>
        <Text size={14} weight="700" color="ink-muted">
          {band.hours}
        </Text>
      </View>
      {band.events.map((e) =>
        e.kind === 'reminder' ? (
          <DayReminderRow key={e.key} item={e} onToggle={() => onReminderToggle?.(e.key)} onOpen={() => onReminderOpen?.(e.key)} disabled={readOnly} />
        ) : (
          <DayEventRow key={e.key} event={e} onPress={() => onEventPress(e.key)} />
        ),
      )}
      {band.events.length === 0 ? (
        <Pressable
          role="button"
          aria-label={band.addLabel}
          onPress={onAdd}
          className={cn('min-h-[52px] flex-row items-center justify-center gap-6 rounded-[18px] border-2 border-dashed border-line-dashed active:bg-surface-soft', focusRing)}
        >
          <Text size={15} weight="800" color="olive-deep">
            {band.addText}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** SlotBand README › Event row: stripe, avatar, title, time line, driver line and "Now". */
export function DayEventRow({ event, onPress }: { event: DayEventItem; onPress: () => void }) {
  const two = event.initials.length > 1;
  return (
    <Pressable
      role="link"
      aria-label={event.label}
      onPress={onPress}
      className={cn('flex-row items-center gap-12 rounded-[20px] bg-surface-card py-12 pl-12 pr-14 active:bg-surface-card-pressed', focusRing)}
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
      <View className="min-w-0 flex-1 gap-[2px]">
        <View className="flex-row items-center gap-6">
          {isTravelLook(event.colors) ? <TravelMark size={16} /> : null}
          <Text size={17} weight="800" className="min-w-0 shrink">
            {event.title}
          </Text>
        </View>
        <Text size={14} weight="700" color="ink-muted">
          {event.time}
        </Text>
        {event.driver ? (
          <View className="flex-row items-center gap-6">
            <Icon name="car" size={16} color="oliveDeep" />
            <Text size={14} weight="800" color="olive-deep">
              {event.driver}
            </Text>
          </View>
        ) : null}
      </View>
      {event.nowText ? <Tag label={event.nowText} tone="honey" className="flex-none self-center" /> : null}
    </Pressable>
  );
}

/** SlotBand README › Reminder row (spec 058): the agenda's reminder row in the day's white card, radius 20. */
export function DayReminderRow({ item, onToggle, onOpen, disabled }: ReminderListRowProps) {
  return (
    <View className="min-h-[64px] flex-row items-center gap-12 rounded-[20px] bg-surface-card py-6 pl-12 pr-14">
      <ReminderTick item={item} onToggle={onToggle} disabled={disabled} />
      <ReminderListText item={item} onOpen={onOpen} />
    </View>
  );
}

/**
 * OC-CalDay › All day: a full-width row in the member color, title left and tag right. With
 * `next` (back-to-back trips), one row split in the middle: the trip that ends, then the one that starts.
 */
export function AllDayRow({ item, onPress }: { item: DayAllDayItem; onPress: (key: string) => void }) {
  if (!item.next) return <AllDayPart item={item} onPress={() => onPress(item.key)} rounded="rounded-[18px]" />;
  const next = item.next;
  return (
    <View className="flex-row gap-[2px]">
      <AllDayPart item={item} onPress={() => onPress(item.key)} rounded="rounded-l-[18px]" />
      <AllDayPart item={next} onPress={() => onPress(next.key)} rounded="rounded-r-[18px]" />
    </View>
  );
}

function AllDayPart({ item, onPress, rounded }: { item: Omit<DayAllDayItem, 'next'>; onPress: () => void; rounded: string }) {
  return (
    <Pressable role="link" aria-label={item.label} onPress={onPress} className={cn('min-h-[52px] min-w-0 flex-1 flex-row items-center justify-between gap-12 px-16', rounded, focusRing)}>
      <Fill colors={item.colors} rounded={rounded} />
      <View className="min-w-0 flex-1 flex-row items-center gap-6">
        {isTravelLook(item.colors) ? <TravelMark size={16} /> : null}
        <Text size={17} weight="800" className="min-w-0 shrink">
          {item.title}
        </Text>
      </View>
      {item.tag ? (
        <Text size={13} weight="800">
          {item.tag}
        </Text>
      ) : null}
    </Pressable>
  );
}
