import { useId, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { theme } from '../theme';
import { useThemeColors } from '../ThemeProvider';
import { Icon } from './Icon';
import { Mark } from './ListRow';
import { Text } from './Text';

export interface AmountFieldProps<U extends string> {
  /** "2. How much do you have?", "Convert". */
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  unit: U;
  /** Only the units that fit (OC-ScaleIng: no ml for lardons). One unit shows no menu. */
  units: readonly U[];
  onUnitChange: (unit: U) => void;
  /** "g", "fl oz", "pieces". */
  unitLabel: (unit: U) => string;
  /** The unit button's spoken name: "Unit". */
  unitA11y: string;
  /** Under the input: "Enter how much you have". */
  hint?: string;
  /** lg: 56 tall, 22/900 (scale sheet) · xl: 60 tall, 26/900 (converter). */
  size?: 'lg' | 'xl';
  className?: string;
}

/**
 * A big number input with a unit picker beside it (AmountField README; OC-ScaleIng, OC-Units).
 * The picker opens a list of units under the field.
 */
export function AmountField<U extends string>({ label, value, onChangeText, unit, units, onUnitChange, unitLabel, unitA11y, hint, size = 'lg', className }: AmountFieldProps<U>) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const hintId = useId();
  const xl = size === 'xl';
  const box = cn('border-2 bg-surface-card', xl ? 'h-[60px] rounded-[18px]' : 'h-[56px] rounded-lg');
  const many = units.length > 1;
  return (
    <View className={cn('gap-6', className)}>
      <Text size={15} weight="900">
        {label}
      </Text>
      <View className="flex-row gap-8">
        <TextInput
          aria-label={label}
          aria-describedby={hint ? hintId : undefined}
          value={value}
          onChangeText={onChangeText}
          inputMode="decimal"
          keyboardType="decimal-pad"
          placeholderTextColor={colors.inkMuted}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className={cn(box, 'min-w-0 flex-1 px-16 text-ink web:outline-none', focused ? 'border-olive' : 'border-line-strong')}
          style={{ fontFamily: theme.font[900], fontSize: xl ? 26 : 22 }}
        />
        <Pressable
          role="button"
          aria-label={`${unitA11y}: ${unitLabel(unit)}`}
          aria-expanded={many ? open : undefined}
          disabled={!many}
          onPress={() => setOpen((o) => !o)}
          className={cn(box, 'flex-row items-center justify-center gap-4 border-line-strong active:bg-surface-soft', xl ? 'w-[100px]' : 'w-[96px]', focusRing)}
        >
          <Text size={xl ? 18 : 17} weight="800" numberOfLines={1}>
            {unitLabel(unit)}
          </Text>
          {many ? <Icon name={open ? 'chevron-up' : 'chevron-down'} size={16} /> : null}
        </Pressable>
      </View>
      {open ? (
        <View role="radiogroup" aria-label={unitA11y} className="overflow-hidden rounded-lg bg-surface-card">
          {units.map((u, i) => (
            <Pressable
              key={u}
              role="radio"
              aria-checked={u === unit}
              onPress={() => {
                onUnitChange(u);
                setOpen(false);
              }}
              className={cn('min-h-control-md flex-row items-center gap-12 px-14 py-8 active:bg-surface-soft', i > 0 && 'border-t-[1.5px] border-line', focusRing)}
            >
              <Mark kind="radio" checked={u === unit} />
              <Text size={16} weight={u === unit ? '800' : '700'}>
                {unitLabel(u)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {hint ? (
        <Text variant="caption" color="ink-muted" nativeID={hintId}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
