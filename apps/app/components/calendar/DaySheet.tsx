import { BottomSheet, DayEventRow, IconButton, Text } from '@cocon/ui';
import type { DaySheet as DaySheetLayout } from '../../lib/calendar-day';
import { strings } from '../../strings/en';

const s = strings.calendar.month.sheet;

/**
 * Spec 037 FR-009 (OC-CalMonth.md › Day sheet): one day of the month grid, its events as the day
 * view's rows and a round add button for that day.
 */
export function DaySheet({ sheet, onClose, onOpenEvent, onAdd }: { sheet: DaySheetLayout; onClose: () => void; onOpenEvent: (key: string) => void; onAdd: () => void }) {
  return (
    <BottomSheet
      visible
      onClose={onClose}
      title={sheet.title}
      lead={sheet.count}
      closeLabel={s.close}
      headerAction={<IconButton variant="soft" icon="close" label={s.close} onPress={onClose} />}
      floating={<IconButton variant="fab" icon="plus" iconSize={28} label={sheet.addLabel} onPress={onAdd} />}
    >
      {sheet.rows.length ? (
        sheet.rows.map((row) => <DayEventRow key={row.key} event={row} onPress={() => onOpenEvent(row.key)} />)
      ) : (
        <Text size={16} weight="700" color="ink-muted" className="my-8">
          {s.empty}
        </Text>
      )}
    </BottomSheet>
  );
}
