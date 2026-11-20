import { useMemo } from 'react';
import { View } from 'react-native';
import { BottomSheet, DayEventRow, DayReminderRow, IconButton, Text, TogglePill } from '@cocon/ui';
import type { DayBandItem } from '@cocon/ui';
import { layoutDaySheet, type DayViewContext } from '../../lib/calendar-day';
import type { MonthOccurrence } from '../../lib/calendar-month';
import { placeForScreen, pressReminderBox, type CalendarReminder, type CalendarReminders } from '../../lib/calendar-reminders';
import { strings } from '../../strings/en';

const s = strings.calendar.month.sheet;

export interface DayContentProps {
  date: string;
  /** The visible events around the day (already through `viewFor` and the header's filter). */
  occurrences: readonly MonthOccurrence[];
  ctx: DayViewContext;
  /** The family's home time zone. */
  timeZone: string;
  /** The header's people filter, for the reminders. */
  hidden: ReadonlySet<string>;
  /** Spec 058: the day's reminders, and the "Reminders" toggle beside the title. */
  reminders?: CalendarReminders;
  showReminders: boolean;
  onShowReminders: (on: boolean) => void;
  onOpenEvent: (key: string) => void;
}

export interface DaySheetProps extends DayContentProps {
  onClose: () => void;
  onAdd: () => void;
}

/** One day's title, count and rows, with its reminders among the events (spec 058): the sheet's and, from 600, Month's panel's. */
export function useDayContent({ date, occurrences, ctx, timeZone, hidden, reminders, showReminders }: DayContentProps) {
  const placed = useMemo(
    () => placeForScreen(showReminders ? reminders : undefined, { from: date, to: date, today: ctx.today, tz: timeZone, members: ctx.members, use24h: ctx.use24h ?? true, hidden }),
    [showReminders, reminders, date, ctx.today, timeZone, ctx.members, ctx.use24h, hidden],
  );
  const sheet = useMemo(() => layoutDaySheet(date, occurrences, ctx, [...placed.values()]), [date, occurrences, ctx, placed]);
  return { sheet, placed };
}

/** The Reminders toggle beside a day's title (spec 058), when the calendar has reminders. */
export function DayRemindersToggle({ reminders, showReminders, onShowReminders }: Pick<DayContentProps, 'reminders' | 'showReminders' | 'onShowReminders'>) {
  return reminders ? <TogglePill label={strings.calendar.reminders.toggle} icon="alarm" selected={showReminders} onPress={() => onShowReminders(!showReminders)} /> : null;
}

/**
 * The day view's rows for one day (OC-CalMonth.md › Day sheet): events, and reminders with their
 * box and drawer. `onLeave` closes what holds them before a reminder's drawer opens over it.
 */
export function DayRow({
  row,
  placed,
  reminders,
  onOpenEvent,
  onLeave,
}: {
  row: DayBandItem;
  placed: ReadonlyMap<string, CalendarReminder>;
  reminders?: CalendarReminders;
  onOpenEvent: (key: string) => void;
  onLeave?: () => void;
}) {
  if (row.kind !== 'reminder') return <DayEventRow event={row} onPress={() => onOpenEvent(row.key)} />;
  const x = placed.get(row.key);
  return (
    <DayReminderRow
      item={row}
      disabled={reminders?.readOnly}
      onToggle={() => x && reminders && pressReminderBox(x, reminders)}
      onOpen={() => {
        if (!x || !reminders) return;
        // The drawer is a sheet of its own.
        onLeave?.();
        reminders.onOpen(x.row);
      }}
    />
  );
}

/**
 * Spec 037 FR-009 (OC-CalMonth.md › Day sheet): one day of the month grid (and since 058 of the
 * week), its events as the day view's rows with its reminders among them, and a round add button.
 */
export function DaySheet(p: DaySheetProps) {
  const { sheet, placed } = useDayContent(p);
  return (
    <BottomSheet
      visible
      onClose={p.onClose}
      title={sheet.title}
      lead={sheet.count}
      closeLabel={s.close}
      headerAction={
        <View className="flex-row gap-8">
          <DayRemindersToggle {...p} />
          <IconButton variant="soft" icon="close" label={s.close} onPress={p.onClose} />
        </View>
      }
      floating={<IconButton variant="fab" icon="plus" iconSize={28} label={sheet.addLabel} onPress={p.onAdd} />}
    >
      {sheet.rows.length ? (
        sheet.rows.map((row) => <DayRow key={row.key} row={row} placed={placed} reminders={p.reminders} onOpenEvent={p.onOpenEvent} onLeave={p.onClose} />)
      ) : (
        <Text size={16} weight="700" color="ink-muted" className="my-8">
          {s.empty}
        </Text>
      )}
    </BottomSheet>
  );
}
