import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Text } from './Text';

export interface MonthPickerProps {
  /** Selected months, 0 = January. */
  value: number[];
  onChange: (months: number[]) => void;
  /** Three-letter month names in the device locale, January first. */
  monthLabels: string[];
  /** Screen-reader name of the grid: "Best months". */
  label: string;
  hint?: string;
}

/** A 6 × 2 grid of month toggles, multi-select (MonthPicker README). */
export function MonthPicker({ value, onChange, monthLabels, label, hint }: MonthPickerProps) {
  const toggle = (m: number) => onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m].sort((a, b) => a - b));
  const rows = [monthLabels.slice(0, 6), monthLabels.slice(6, 12)];
  return (
    <View className="gap-6">
      <View role="group" aria-label={label} className="gap-6">
        {rows.map((row, r) => (
          // The full grid row counts as the 44 touch target; cells are 40 tall.
          <View key={r} className="min-h-touch-min flex-row items-center gap-6">
            {row.map((name, i) => {
              const m = r * 6 + i;
              const on = value.includes(m);
              return (
                <Pressable
                  key={m}
                  role="button"
                  aria-pressed={on}
                  onPress={() => toggle(m)}
                  className={cn('h-[40px] flex-1 items-center justify-center rounded-[12px]', on ? 'bg-olive' : 'bg-surface-soft', focusRing)}
                >
                  <Text size={14} weight={on ? '900' : '700'} color={on ? 'on-olive' : 'ink'}>
                    {name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      {hint ? (
        <Text variant="caption" color="ink-muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
