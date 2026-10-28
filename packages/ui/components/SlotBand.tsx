import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Fill, type EventColor } from './EventChip';
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

/** A time-of-day band (SlotBand README): "Morning 09:00–12:00", its events or the add row. */
export interface DayBand {
  key: string;
  title: string;
  hours: string;
  events: DayEventItem[];
  /** "+ Add in the morning", shown when the band has no events. */
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
}

export interface SlotBandProps {
  band: DayBand;
  onEventPress: (key: string) => void;
  onAdd: () => void;
}

/**
 * SlotBand README: a band's title and hours, then its event rows, or a dashed "+ Add in the …"
 * row when it has none (spec 039 FR-003, FR-004).
 */
export function SlotBand({ band, onEventPress, onAdd }: SlotBandProps) {
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
      {band.events.map((e) => (
        <DayEventRow key={e.key} event={e} onPress={() => onEventPress(e.key)} />
      ))}
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
        <Text size={17} weight="800">
          {event.title}
        </Text>
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

/** OC-CalDay › All day: a full-width row in the member color, title left and tag right. */
export function AllDayRow({ item, onPress }: { item: DayAllDayItem; onPress: () => void }) {
  return (
    <Pressable
      role="link"
      aria-label={item.label}
      onPress={onPress}
      className={cn('min-h-[52px] flex-row items-center justify-between gap-12 rounded-[18px] px-16', focusRing)}
    >
      <Fill colors={item.colors} rounded="rounded-[18px]" />
      <Text size={17} weight="800" className="min-w-0 flex-1">
        {item.title}
      </Text>
      {item.tag ? (
        <Text size={13} weight="800">
          {item.tag}
        </Text>
      ) : null}
    </Pressable>
  );
}
