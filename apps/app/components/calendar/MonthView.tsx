import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';
import type { SlotTimes, WeekStartsOn } from '@cocon/calendar';
import type { StoredEvent } from '@cocon/data';
import { FloatingAdd, MonthGrid } from '@cocon/ui';
import {
  eventWindow,
  firstWeekOfMonth,
  layoutWeek,
  memberLook,
  monthOccurrences,
  monthRange,
  monthShownAt,
  parseOccurrenceKey,
  weekIndexOf,
  weekdayLetters,
} from '../../lib/calendar-month';
import type { Member } from '../../lib/session';
import { useToast } from '../../lib/toast';
import { strings } from '../../strings/en';

const m = strings.calendar.month;

export interface MonthViewProps {
  members: Member[];
  myMemberId: string;
  /** Loaded for `eventWindow(month)`; undefined while loading (the grid shows empty days). */
  events: StoredEvent[] | undefined;
  slotTimes: SlotTimes;
  /** Hidden in the header's filter: member ids, "everyone", "others". */
  hidden: ReadonlySet<string>;
  /** The 1st of the month the grid opens on. */
  month: string;
  today: string;
  weekStartsOn: WeekStartsOn;
  /** ‹ › and Today: scroll so this month's first week is at the top. */
  jump?: { month: string; nonce: number };
  /** The month that fills the grid changed (FR-005), as its 1st. */
  onMonthShown: (month: string) => void;
  onOpenDay: (date: string) => void;
  onAddEvent: (date: string) => void;
  onOpenEvent: (id: string, date: string) => void;
  showHint: boolean;
  onDismissHint: () => void;
}

/** Spec 037 (OC-CalMonth): the continuous month grid, the first-visit hint and the add button. */
export function MonthView({ members, myMemberId, events, slotTimes, hidden, month, today, weekStartsOn, jump, onMonthShown, onOpenDay, onAddEvent, onOpenEvent, showHint, onDismissHint }: MonthViewProps) {
  // Toast README: the add button hides while the save toast shows (032-later L96).
  const { visible: toastShown } = useToast();
  const range = useMemo(() => monthRange(today, weekStartsOn), [today, weekStartsOn]);
  const look = useMemo(() => memberLook(members), [members]);
  const { from, to } = eventWindow(month);
  const occurrences = useMemo(() => monthOccurrences(events ?? [], from, to, myMemberId, hidden), [events, from, to, myMemberId, hidden]);
  const weekAt = useCallback((index: number) => layoutWeek(index, occurrences, { range, today, look, slotTimes }), [occurrences, range, today, look, slotTimes]);
  // Opens with the month's first week at the top, and today on screen when it's this month.
  const [initialIndex] = useState(() => firstWeekOfMonth(range, month));
  const keepVisibleIndex = month === `${today.slice(0, 8)}01` ? weekIndexOf(range, today) : undefined;
  const openEvent = useCallback(
    (key: string) => {
      const { id, date } = parseOccurrenceKey(key);
      onOpenEvent(id, date);
    },
    [onOpenEvent],
  );
  const gridJump = useMemo(() => (jump ? { index: firstWeekOfMonth(range, jump.month), nonce: jump.nonce } : undefined), [jump, range]);

  return (
    <View className="flex-1">
      <MonthGrid
        weekdays={weekdayLetters(weekStartsOn)}
        weekCount={range.weekCount}
        weekAt={weekAt}
        initialIndex={initialIndex}
        keepVisibleIndex={keepVisibleIndex}
        jump={gridJump}
        onTopRowChange={(top) => onMonthShown(monthShownAt(range, top))}
        onDayPress={onOpenDay}
        onDayLongPress={onAddEvent}
        onBarPress={openEvent}
        onChipPress={openEvent}
        addLabel={m.addEvent}
      />
      <FloatingAdd hidden={toastShown} label={m.addEvent} onPress={() => onAddEvent(today)} hint={showHint ? { text: m.hint, actionLabel: m.gotIt, onAction: onDismissHint } : null} />
    </View>
  );
}
