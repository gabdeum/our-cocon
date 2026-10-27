import { View } from 'react-native';
import { memberInitials, type Tracker } from '@cocon/schemas';
import type { CalendarView } from '@cocon/schemas/calendar';
import { shiftAnchor, type WeekStartsOn } from '@cocon/calendar';
import { CalendarHeader, type CalendarHeaderChip } from '@cocon/ui';
import { arrowLabels, headerTitle, viewSegments } from '../../lib/calendar-header';
import { useCalendarFilter } from '../../lib/calendar-filter';
import type { ChoiceStorage } from '../../lib/recipe-choices';
import type { Member } from '../../lib/session';
import { strings } from '../../strings/en';
import { OfflineBanner } from '../sync/OfflineBanner';

const h = strings.calendar.header;

export interface CalendarScreenProps {
  userId: string;
  /** In member order (join order, as the session sorts them). */
  members: Member[];
  view: CalendarView;
  /** The day the view shows. */
  anchor: string;
  /** Today in the family's home time zone. */
  today: string;
  /** Screen width, for the title's short or long month names. */
  width: number;
  weekStartsOn: WeekStartsOn;
  /** Changes the URL: another view (same day), or another day. */
  onNavigate: (params: { view: CalendarView } | { date: string }) => void;
  tracker: Tracker;
  storage?: ChoiceStorage;
}

/** Spec 036: the Calendar tab's header. The views below it come with specs 037–040. */
export function CalendarScreen({ userId, members, view, anchor, today, width, weekStartsOn, onNavigate, tracker, storage }: CalendarScreenProps) {
  const { hidden, toggle } = useCalendarFilter(userId, storage);
  const initials = memberInitials(members);
  const chips: CalendarHeaderChip[] = [
    ...members.map((m) => ({
      key: m.id,
      name: m.display_name,
      initial: initials.get(m.id) ?? '?',
      color: m.color,
      pressed: !hidden.has(m.id),
    })),
    { key: 'everyone', name: h.everyone, initial: h.everyoneInitial, color: 'everyone', pressed: !hidden.has('everyone') },
    { key: 'others', name: h.others, initial: '', color: 'others', pressed: !hidden.has('others') },
  ];
  const arrows = arrowLabels(view);

  const onToggle = (key: string) => {
    const next = toggle(key);
    tracker.track('calendar_member_filter_changed', { members_visible: chips.filter((c) => !next.has(c.key)).length });
  };
  const onView = (to: CalendarView) => {
    if (to === view) return;
    onNavigate({ view: to });
    tracker.track('calendar_view_changed', { from: view, to });
  };

  return (
    <View className="flex-1 bg-surface-page">
      <CalendarHeader
        title={headerTitle(view, anchor, today, width, weekStartsOn)}
        prevLabel={arrows.prev}
        nextLabel={arrows.next}
        onPrev={() => onNavigate({ date: shiftAnchor(view, anchor, -1) })}
        onNext={() => onNavigate({ date: shiftAnchor(view, anchor, 1) })}
        todayLabel={h.today}
        onToday={() => onNavigate({ date: today })}
        views={viewSegments}
        view={view}
        onView={onView}
        viewsLabel={h.viewsLabel}
        chips={chips}
        onToggle={onToggle}
        chipsLabel={h.filterLabel}
      />
      <View className="px-20">
        <OfflineBanner screen="calendar" tracker={tracker} />
      </View>
    </View>
  );
}
