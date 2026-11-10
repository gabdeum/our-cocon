import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { cn, focusRing } from '../cn';
import { useThemeColors } from '../ThemeProvider';
import { FieldWarning } from './TextField';
import { Text } from './Text';
import type { TimeRangeField, TimeRangeProps } from './TimeRange';

export type { TimeRangeField, TimeRangeProps } from './TimeRange';

const isTime = (t: string) => /^\d{2}:\d{2}$/.test(t);
const toDate = (t: string) => {
  const [h = 0, m = 0] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m);
};
const pad = (n: number) => String(n).padStart(2, '0');
const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * Starts and Ends on the phone (TimeRange README): each field opens the system's time picker. On
 * iOS the wheel opens under the fields, as in Apple's Calendar, and a second tap closes it; on
 * Android it's the clock dialog.
 */
export function TimeRange({ startLabel, endLabel, start, end, onChange, startWarning, endWarning, use24h = true, format = (t) => t, fallback, className }: TimeRangeProps) {
  const colors = useThemeColors();
  const [picking, setPicking] = useState<TimeRangeField | null>(null);
  const values = { start, end };
  // A field emptied meanwhile (All day) closes its wheel.
  const open = picking && isTime(values[picking]) ? picking : null;
  const at = (field: TimeRangeField) => (isTime(values[field]) ? values[field] : fallback[field]);

  const press = (field: TimeRangeField) => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({ value: toDate(at(field)), mode: 'time', is24Hour: use24h, onValueChange: (_, date) => onChange(field, toTime(date)) });
      return;
    }
    if (open === field) return setPicking(null);
    // The wheel always shows a time, so the field does too.
    if (!isTime(values[field])) onChange(field, fallback[field]);
    setPicking(field);
  };

  const field = (key: TimeRangeField, label: string, warning: string | undefined) => (
    <View className="flex-1 gap-6">
      <Text size={15} weight="900" aria-hidden>
        {label}
      </Text>
      <Pressable
        role="button"
        aria-label={isTime(values[key]) ? `${label}: ${format(values[key])}` : label}
        aria-expanded={Platform.OS === 'ios' ? open === key : undefined}
        aria-invalid={warning ? true : undefined}
        onPress={() => press(key)}
        className={cn(
          'h-control-lg justify-center rounded-lg border-2 px-16',
          warning ? 'border-warn-border bg-warn-soft' : cn('bg-surface-card active:bg-surface-soft', open === key ? 'border-olive' : 'border-line-strong'),
          focusRing,
        )}
      >
        <Text size={17} weight="700" color={warning ? 'warn' : 'ink'} tabular numberOfLines={1}>
          {isTime(values[key]) ? format(values[key]) : ''}
        </Text>
      </Pressable>
      {warning ? <FieldWarning text={warning} /> : null}
    </View>
  );

  return (
    <View className={cn('gap-8', className)}>
      <View className="flex-row gap-8">
        {field('start', startLabel, startWarning)}
        {field('end', endLabel, endWarning)}
      </View>
      {open ? (
        <DateTimePicker
          value={toDate(values[open])}
          mode="time"
          display="spinner"
          minuteInterval={5}
          locale={use24h ? 'en_GB' : 'en_US'}
          textColor={colors.ink}
          onValueChange={(_, date) => onChange(open, toTime(date))}
        />
      ) : null}
    </View>
  );
}
