import { Platform, Pressable } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { cn, focusRing } from '../cn';
import { useThemeColors } from '../ThemeProvider';
import { Text } from './Text';
import type { TimeFieldProps } from './TimeField';

export type { TimeFieldProps } from './TimeField';

const toDate = (t: string) => {
  const [h = 0, m = 0] = t.split(':').map(Number);
  return new Date(2000, 0, 1, h, m);
};
const pad = (n: number) => String(n).padStart(2, '0');
const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** TimeField on the phone (TimeField README): iOS's compact time button, or Android's clock dialog. */
export function TimeField({ label, value, onChange, use24h = true, format = (t) => t }: TimeFieldProps) {
  const colors = useThemeColors();
  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        accessibilityLabel={label}
        value={toDate(value)}
        mode="time"
        display="compact"
        minuteInterval={5}
        locale={use24h ? 'en_GB' : 'en_US'}
        textColor={colors.ink}
        onValueChange={(_, date) => onChange(toTime(date))}
      />
    );
  }
  return (
    <Pressable
      role="button"
      aria-label={`${label}: ${format(value)}`}
      onPress={() => DateTimePickerAndroid.open({ value: toDate(value), mode: 'time', is24Hour: use24h, onValueChange: (_, date) => onChange(toTime(date)) })}
      className={cn('h-control-md min-w-[84px] flex-none items-center justify-center rounded-[12px] border-2 border-line-strong bg-surface-page px-10 active:bg-surface-soft', focusRing)}
    >
      <Text size={17} weight="900" tabular>
        {format(value)}
      </Text>
    </Pressable>
  );
}
