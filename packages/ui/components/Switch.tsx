import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Text } from './Text';

export interface SwitchProps {
  value: boolean;
  onValueChange?: (value: boolean) => void;
  /** Screen-reader label when the switch stands alone; inside SettingRow the row is labelled. */
  label?: string;
  /** On an ink card, "on" is honey instead of olive. */
  onInk?: boolean;
  disabled?: boolean;
}

/** The track and knob (bundle.css › Switch). Use it inside a SettingRow. */
export function Switch({ value, onValueChange, label, onInk, disabled }: SwitchProps) {
  return (
    <Pressable
      role="switch"
      aria-checked={value}
      aria-label={label}
      disabled={disabled}
      onPress={() => onValueChange?.(!value)}
      className={cn('h-[32px] w-[52px] flex-row rounded-[16px] p-[3px]', value ? (onInk ? 'bg-honey' : 'bg-olive') : 'bg-line-handle', value ? 'justify-end' : 'justify-start', focusRing)}
    >
      <View className="h-[26px] w-[26px] rounded-full bg-surface-card" />
    </Pressable>
  );
}

export interface SettingRowProps {
  label: string;
  /** Says what On (or Off) does: "Off: hides temperature checks in steps". */
  hint?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** Replaces the hint in warn when a recipe overrides a family default: "Changed for this recipe". */
  changedHint?: string;
  /** "Reset", after the changed hint. */
  resetLabel?: string;
  onReset?: () => void;
  onInk?: boolean;
  last?: boolean;
}

/** A setting with its switch (Switch README › setting row). The whole row toggles. */
export function SettingRow({ label, hint, value, onValueChange, changedHint, resetLabel, onReset, onInk, last }: SettingRowProps) {
  const toggle = () => onValueChange(!value);
  return (
    <View className={cn('flex-row items-center gap-12 py-14', !last && 'border-b-[1.5px] border-line')}>
      <View className="min-w-0 flex-1">
        <Pressable role="switch" aria-checked={value} aria-label={label} onPress={toggle} className={focusRing}>
          <Text size={16} weight="800" color={onInk ? 'on-olive' : 'ink'}>
            {label}
          </Text>
          {hint && !changedHint ? (
            <Text variant="caption" color={onInk ? 'on-ink' : 'ink-muted'} className="mt-[2px]">
              {hint}
            </Text>
          ) : null}
        </Pressable>
        {changedHint ? (
          <View className="mt-[2px] flex-row flex-wrap items-center">
            <Text variant="caption" color="warn">
              {changedHint}
              {resetLabel ? ' · ' : ''}
            </Text>
            {resetLabel && onReset ? (
              <Pressable role="button" onPress={onReset} hitSlop={14} className={focusRing}>
                <Text variant="caption" color="warn" underline>
                  {resetLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
      <Pressable aria-hidden tabIndex={-1} onPress={toggle}>
        <View pointerEvents="none">
          <Switch value={value} onInk={onInk} />
        </View>
      </Pressable>
    </View>
  );
}
