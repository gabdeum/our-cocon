import { ScrollView, View } from 'react-native';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { MemberChip, type MemberChipColor } from './MemberChip';
import { SegmentedControl, type Segment } from './SegmentedControl';
import { Text } from './Text';

export interface CalendarHeaderChip {
  /** A member id, "everyone" or "others". */
  key: string;
  name: string;
  initial: string;
  color: MemberChipColor;
  /** Shown. */
  pressed: boolean;
}

export interface CalendarHeaderProps<V extends string> {
  /** "October", "Oct. 25 – 31", "Sun, Oct. 25", "Coming up" (spec 034 FR-007). */
  title: string;
  /** "Previous month" / "Next month", by the view. */
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  /** "Today". */
  todayLabel: string;
  onToday: () => void;
  /** Month · Week · Day · Agenda. */
  views: Segment<V>[];
  view: V;
  onView: (view: V) => void;
  /** Screen-reader name of the switcher: "Calendar view". */
  viewsLabel: string;
  /** Members in member order, then Everyone and Others. */
  chips: CalendarHeaderChip[];
  onToggle: (key: string) => void;
  /** Group label of the filter row: "Show events for". */
  chipsLabel: string;
}

/**
 * The shared header of the four calendar views (CalendarHeader README, CalHeader screen):
 * title with ‹ › and Today, the view switcher, and the member filter. 54 top, 20 sides, 10 bottom.
 */
export function CalendarHeader<V extends string>(p: CalendarHeaderProps<V>) {
  return (
    <View className="gap-12 bg-surface-page px-20 pb-10 pt-[54px]">
      <View className="flex-row items-center gap-8">
        <Text variant="displayLg" role="heading" aria-level={1} numberOfLines={1} className="min-w-0 flex-1">
          {p.title}
        </Text>
        <IconButton variant="card" icon="back" label={p.prevLabel} onPress={p.onPrev} />
        <IconButton variant="card" icon="chevron-right" label={p.nextLabel} onPress={p.onNext} />
        <Button variant="soft" size="sm" label={p.todayLabel} onPress={p.onToday} />
      </View>
      <SegmentedControl links segments={p.views} value={p.view} onChange={p.onView} label={p.viewsLabel} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        role="group"
        aria-label={p.chipsLabel}
        className="-mx-20"
        contentContainerClassName="gap-8 px-20 pb-2"
      >
        {p.chips.map((c) => (
          <MemberChip key={c.key} name={c.name} initial={c.initial} color={c.color} pressed={c.pressed} onPress={() => p.onToggle(c.key)} />
        ))}
      </ScrollView>
    </View>
  );
}
