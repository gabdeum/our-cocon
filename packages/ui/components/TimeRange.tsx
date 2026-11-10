import { View } from 'react-native';
import { cn } from '../cn';
import { TextField } from './TextField';

export type TimeRangeField = 'start' | 'end';

export interface TimeRangeProps {
  /** "Starts", "Ends". */
  startLabel: string;
  endLabel: string;
  /** "HH:MM" in 24 h, or '' for none (All day). */
  start: string;
  end: string;
  /** Web: what's typed. Phone: the picked time, "HH:MM". */
  onChange: (field: TimeRangeField, value: string) => void;
  startWarning?: string;
  endWarning?: string;
  /** Phone: the picker's clock. */
  use24h?: boolean;
  /** Phone: how a time reads in its field ("6:30 PM"). */
  format?: (time: string) => string;
  /** Phone: the time a picker opens on for an empty field, "HH:MM". */
  fallback: Record<TimeRangeField, string>;
  className?: string;
}

/**
 * Starts and Ends side by side (TimeRange README). On the web they're typed, "18:30"; on the phone
 * each opens the system's time picker (TimeRange.native.tsx).
 */
export function TimeRange({ startLabel, endLabel, start, end, onChange, startWarning, endWarning, className }: TimeRangeProps) {
  return (
    <View className={cn('flex-row gap-8', className)}>
      <TextField
        className="flex-1"
        label={startLabel}
        value={start}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        onChangeText={(value) => onChange('start', value)}
        warning={startWarning}
      />
      <TextField
        className="flex-1"
        label={endLabel}
        value={end}
        keyboardType="numbers-and-punctuation"
        maxLength={5}
        onChangeText={(value) => onChange('end', value)}
        warning={endWarning}
      />
    </View>
  );
}
