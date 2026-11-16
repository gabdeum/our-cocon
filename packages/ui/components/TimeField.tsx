import { useState } from 'react';
import { TextInput } from 'react-native';
import { cn } from '../cn';
import { theme } from '../theme';
import { useThemeColors } from '../ThemeProvider';

export interface TimeFieldProps {
  /** "Time", for screen readers (the row's label says what it's for). */
  label: string;
  /** "HH:MM" in 24 h. Web: as typed. */
  value: string;
  /** Web: what's typed. Phone: the picked time, "HH:MM". */
  onChange: (value: string) => void;
  /** Phone: the picker's clock. */
  use24h?: boolean;
  /** Phone: how the time reads ("3:00 PM"). */
  format?: (time: string) => string;
  /** Typed time that isn't a time: warn border. */
  invalid?: boolean;
}

/**
 * TimeField README: one time, small (84 × 44), at the end of a row: the reminder sheet's "Set a
 * time" (spec 057). Typed on the web, "15:00"; the system's time picker on the phone
 * (TimeField.native.tsx). For a start and an end, use TimeRange.
 */
export function TimeField({ label, value, onChange, invalid }: TimeFieldProps) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      aria-label={label}
      aria-invalid={invalid || undefined}
      value={value}
      onChangeText={onChange}
      keyboardType="numbers-and-punctuation"
      maxLength={5}
      placeholderTextColor={colors.inkMuted}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={cn(
        'h-control-md w-[84px] flex-none rounded-[12px] border-2 px-10 text-center web:outline-none',
        invalid ? 'border-warn-border bg-warn-soft text-warn' : cn('bg-surface-page text-ink', focused ? 'border-olive' : 'border-line-strong'),
      )}
      style={{ fontFamily: theme.font[900], fontSize: 17 }}
    />
  );
}
