import { View } from 'react-native';
import { Button, splitColumns, Text } from '@cocon/ui';
import { strings } from '../../strings/en';
import { DayRemindersToggle, DayRow, useDayContent, type DayContentProps } from './DaySheet';

const s = strings.calendar.month.sheet;

export interface DayPanelProps extends DayContentProps {
  /** Medium: two columns read by column, under the grid. Expanded: one column, 320 beside it. */
  columns: 1 | 2;
  onAdd: () => void;
}

/**
 * Spec 070 FR-003/FR-004 (OC-CalendarResponsive): from 600, Month's selected day stays open beside
 * or under the grid instead of a sheet: its title and count, the day sheet's rows, and "+ Add on Sun 25".
 */
export function DayPanel({ columns, onAdd, ...p }: DayPanelProps) {
  const { sheet, placed } = useDayContent(p);
  const cols = splitColumns(sheet.rows, columns);
  return (
    <View role="region" aria-label={sheet.title} className="gap-12">
      <View className="flex-row items-center gap-12">
        <View className="min-w-0 flex-1">
          <Text role="heading" aria-level={2} size={22} weight="900">
            {sheet.title}
          </Text>
          <Text size={14} weight="700" color="ink-muted">
            {sheet.count}
          </Text>
        </View>
        <DayRemindersToggle {...p} />
      </View>
      {sheet.rows.length ? (
        <View className="flex-row gap-8">
          {cols.map((rows, i) => (
            <View key={i} className="min-w-0 flex-1 gap-8">
              {rows.map((row) => (
                <DayRow key={row.key} row={row} placed={placed} reminders={p.reminders} onOpenEvent={p.onOpenEvent} />
              ))}
            </View>
          ))}
        </View>
      ) : (
        <Text size={16} weight="700" color="ink-muted">
          {s.empty}
        </Text>
      )}
      <Button variant="dashed" label={sheet.addOn} aria-label={sheet.addLabel} onPress={onAdd} />
    </View>
  );
}
