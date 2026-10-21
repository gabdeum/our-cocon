import { useId, useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { cn, focusRing } from '../cn';
import { theme } from '../theme';
import { useThemeColors } from '../ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  label: string;
  /** "(optional)" after the label, in ink-muted. */
  optionalLabel?: string;
  hint?: string;
  /** "54 / 140" on the right of the hint. */
  counter?: string;
  /** Warns, never blocks typing: "Pick a unit so we can convert and scale it." */
  warning?: string;
  size?: 'md' | 'sm';
  /** Read by screen readers only: rows whose design labels them by place (OC-EditIngredients). */
  labelHidden?: boolean;
  className?: string;
}

/** Labelled input with a hint and a friendly warning (TextField README). `multiline` is the textarea. */
export function TextField({ label, optionalLabel, hint, counter, warning, size = 'md', labelHidden, multiline, className, onFocus, onBlur, ...props }: TextFieldProps) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const hintId = useId();
  const warnId = useId();
  const sm = size === 'sm';
  const text = multiline
    ? { fontFamily: theme.font[600], fontSize: 16, lineHeight: 16 * 1.45 }
    : { fontFamily: theme.font[700], fontSize: sm ? 16 : 17 };
  return (
    <View className={cn('gap-6', className)}>
      {labelHidden ? null : (
        <Text size={15} weight="900" nativeID={`${hintId}-label`}>
          {label}
          {optionalLabel ? (
            <Text size={15} weight="600" color="ink-muted">
              {' '}
              {optionalLabel}
            </Text>
          ) : null}
        </Text>
      )}
      <TextInput
        aria-label={label}
        aria-describedby={[warning ? warnId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined}
        aria-invalid={warning ? true : undefined}
        multiline={multiline}
        placeholderTextColor={colors.inkMuted}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={cn(
          'w-full border-2 web:outline-none',
          multiline ? 'min-h-[76px] rounded-lg px-16 py-12' : sm ? 'h-[46px] rounded-[12px] px-12' : 'h-control-lg rounded-lg px-16',
          warning ? 'border-warn-border bg-warn-soft text-warn' : cn('bg-surface-card text-ink', focused ? 'border-olive' : 'border-line-strong'),
        )}
        style={text}
        {...props}
      />
      {warning ? (
        <View nativeID={warnId} className="flex-row items-center gap-8">
          <Icon name="warning" size={18} color="warn" />
          <Text size={14} weight="700" color="warn" className="flex-1">
            {warning}
          </Text>
        </View>
      ) : null}
      {hint || counter ? (
        <View className="flex-row justify-between gap-8">
          {hint ? (
            <Text variant="caption" color="ink-muted" nativeID={hintId} className="flex-1">
              {hint}
            </Text>
          ) : (
            <View />
          )}
          {counter ? (
            <Text variant="caption" color="ink-muted" tabular>
              {counter}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export interface PickerFieldProps {
  label: string;
  /** The picked choice's label, or null to show the placeholder. */
  value: string | null;
  /** "Pick one" */
  placeholder: string;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * A field whose value is picked from a list in a sheet (TextField README › Picker): looks like the
 * input, with a chevron; tapping it opens the sheet (OC-EditBasics › Cuisine).
 */
export function PickerField({ label, value, placeholder, onPress, disabled, className }: PickerFieldProps) {
  return (
    <View className={cn('gap-6', className)}>
      <Text size={15} weight="900" aria-hidden>
        {label}
      </Text>
      <Pressable
        role="button"
        aria-label={`${label}: ${value ?? placeholder}`}
        aria-haspopup="dialog"
        onPress={onPress}
        disabled={disabled}
        className={cn('h-control-lg flex-row items-center justify-between gap-8 rounded-lg border-2 border-line-strong bg-surface-card pl-16 pr-12 active:bg-surface-soft', focusRing)}
      >
        <Text size={17} weight={value ? '700' : '600'} color={value ? 'ink' : 'ink-muted'} numberOfLines={1} className="shrink">
          {value ?? placeholder}
        </Text>
        <Icon name="chevron-right" size={18} color="inkMuted" />
      </Pressable>
    </View>
  );
}

export interface SearchFieldProps extends Omit<TextInputProps, 'style' | 'placeholderTextColor'> {
  /** Visually hidden label (read by screen readers). */
  label: string;
  /** "Try “leek” or “quick”". */
  hint?: string;
  className?: string;
}

/** Search input (TextField README › Search): 52 tall, radius 18, search icon. */
export function SearchField({ label, hint, className, ...props }: SearchFieldProps) {
  const colors = useThemeColors();
  return (
    <View className={cn('gap-6', className)}>
      <View className="h-[52px] flex-row items-center gap-10 rounded-[18px] border-2 border-line-strong bg-surface-card px-16">
        <Icon name="search" color="inkMuted" />
        <TextInput
          role="searchbox"
          aria-label={label}
          placeholderTextColor={colors.inkMuted}
          className="min-w-0 flex-1 text-ink web:outline-none"
          style={{ fontFamily: theme.font[600], fontSize: 16 }}
          {...props}
        />
      </View>
      {hint ? (
        <Text variant="caption" color="ink-muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
