import { useMemo } from 'react';
import { View } from 'react-native';
import { BottomSheet, DayEventRow, DayReminderRow, IconButton, Text, TogglePill } from '@cocon/ui';
import { layoutDaySheet, type DayViewContext } from '../../lib/calendar-day';
import type { MonthOccurrence } from '../../lib/calendar-month';
import { placeForScreen, pressReminderBox, type CalendarReminders } from '../../lib/calendar-reminders';
import { strings } from '../../strings/en';

const s = strings.calendar.month.sheet;

export interface DaySheetProps {
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
  onClose: () => void;
  onOpenEvent: (key: string) => void;
  onAdd: () => void;
}

/**
 * Spec 037 FR-009 (OC-CalMonth.md › Day sheet): one day of the month grid (and since 058 of the
 * week), its events as the day view's rows with its reminders among them, and a round add button.
 */
export function DaySheet({ date, occurrences, ctx, timeZone, hidden, reminders, showReminders, onShowReminders, onClose, onOpenEvent, onAdd }: DaySheetProps) {
  const placed = useMemo(
    () => placeForScreen(showReminders ? reminders : undefined, { from: date, to: date, today: ctx.today, tz: timeZone, members: ctx.members, use24h: ctx.use24h ?? true, hidden }),
    [showReminders, reminders, date, ctx.today, timeZone, ctx.members, ctx.use24h, hidden],
  );
  const sheet = useMemo(() => layoutDaySheet(date, occurrences, ctx, [...placed.values()]), [date, occurrences, ctx, placed]);
  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={sheet.title}
      lead={sheet.count}
      closeLabel={s.close}
      headerAction={
        <View className="flex-row gap-8">
          {reminders ? <TogglePill label={strings.calendar.reminders.toggle} icon="alarm" selected={showReminders} onPress={() => onShowReminders(!showReminders)} /> : null}
          <IconButton variant="soft" icon="close" label={s.close} onPress={onClose} />
        </View>
      }
      floating={<IconButton variant="fab" icon="plus" iconSize={28} label={sheet.addLabel} onPress={onAdd} />}
    >
      {sheet.rows.length ? (
        sheet.rows.map((row) => {
          if (row.kind !== 'reminder') return <DayEventRow key={row.key} event={row} onPress={() => onOpenEvent(row.key)} />;
          const x = placed.get(row.key);
          return (
            <DayReminderRow
              key={row.key}
              item={row}
              disabled={reminders?.readOnly}
              onToggle={() => x && reminders && pressReminderBox(x, reminders)}
              onOpen={() => {
                if (!x || !reminders) return;
                // The drawer is a sheet of its own.
                onClose();
                reminders.onOpen(x.row);
              }}
            />
          );
        })
      ) : (
        <Text size={16} weight="700" color="ink-muted" className="my-8">
          {s.empty}
        </Text>
      )}
    </BottomSheet>
  );
}
