import { useState, type ReactNode } from 'react';
import { Pressable, TextInput, View, type LayoutChangeEvent, type TextInputProps } from 'react-native';
import { cn, focusRing } from '../cn';
import { theme } from '../theme';
import { useThemeColors } from '../ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

/** Which part of the row the warning is about (its border turns warn). */
export type IngredientEditField = 'name' | 'quantity' | 'unit' | 'weight';

export interface IngredientEditCardProps {
  /** The drag handle, from ReorderList. */
  handle?: ReactNode;
  name: string;
  onNameChange: (text: string) => void;
  nameLabel: string;
  onNameFocus?: () => void;
  onNameBlur?: () => void;
  quantity: string;
  onQuantityChange: (text: string) => void;
  quantityLabel: string;
  /** The picked unit's label ("pieces", "g", "small"), or null for none yet. */
  unit: string | null;
  /** Shown when no unit is picked: "Unit" (muted), or "Unit?" (warn) when the row needs one. */
  unitPlaceholder: string;
  unitLabel: string;
  onUnitPress: () => void;
  /** Pieces only: "each ≈ [150] g". */
  weight?: { value: string; onChange: (text: string) => void; label: string; prefix: string; suffix: string } | null;
  removeLabel: string;
  onRemove: () => void;
  /** "Pick a unit so we can convert and scale it." */
  warning?: string | null;
  warningField?: IngredientEditField | null;
  /** Under the name row: suggestions, the aisle line, advanced fields. */
  children?: ReactNode;
  onLayout?: (e: LayoutChangeEvent) => void;
}

function RowInput({ invalid, bold, className, ...props }: Omit<TextInputProps, 'style'> & { invalid?: boolean; bold?: boolean; className?: string }) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      placeholderTextColor={colors.inkMuted}
      aria-invalid={invalid ? true : undefined}
      onFocus={(e) => {
        setFocused(true);
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        props.onBlur?.(e);
      }}
      {...props}
      className={cn(
        'h-[46px] min-w-0 rounded-[12px] border-2 px-12 web:outline-none',
        invalid ? 'border-warn-border bg-warn-soft text-warn' : cn('bg-surface-card text-ink', focused ? 'border-olive' : 'border-line-strong'),
        className,
      )}
      style={{ fontFamily: theme.font[bold ? 800 : 700], fontSize: 16 }}
    />
  );
}

/**
 * One ingredient in the recipe form (IngredientEditCard README; OC-EditIngredients): handle, name
 * and remove, then quantity, unit and, for pieces, the weight of one. A problem gives the card a
 * warn border and says what to do.
 */
export function IngredientEditCard({
  handle,
  name,
  onNameChange,
  nameLabel,
  onNameFocus,
  onNameBlur,
  quantity,
  onQuantityChange,
  quantityLabel,
  unit,
  unitPlaceholder,
  unitLabel,
  onUnitPress,
  weight,
  removeLabel,
  onRemove,
  warning,
  warningField,
  children,
  onLayout,
}: IngredientEditCardProps) {
  const unitWarn = warningField === 'unit';
  return (
    <View onLayout={onLayout} className={cn('gap-8 rounded-[20px] bg-surface-card p-12', warning && 'border-2 border-warn-border')}>
      <View className="flex-row items-center gap-8">
        {handle ?? <View className="w-[22px]" />}
        <RowInput
          aria-label={nameLabel}
          value={name}
          onChangeText={onNameChange}
          onFocus={onNameFocus}
          onBlur={onNameBlur}
          maxLength={80}
          invalid={warningField === 'name'}
          className="flex-1"
        />
        <Pressable
          role="button"
          aria-label={removeLabel}
          onPress={onRemove}
          className={cn('h-control-md w-control-md items-center justify-center rounded-[12px] bg-surface-soft active:bg-surface-soft-pressed', focusRing)}
        >
          <Icon name="close" size={18} color="inkMuted" />
        </Pressable>
      </View>
      {children ? <View className="gap-8 pl-[30px]">{children}</View> : null}
      <View className="flex-row gap-8 pl-[30px]">
        <RowInput
          aria-label={quantityLabel}
          value={quantity}
          onChangeText={onQuantityChange}
          inputMode="decimal"
          maxLength={12}
          bold
          invalid={warningField === 'quantity'}
          className="flex-[1]"
        />
        <Pressable
          role="button"
          aria-label={`${unitLabel}: ${unit ?? unitPlaceholder}`}
          aria-haspopup="dialog"
          aria-invalid={unitWarn ? true : undefined}
          onPress={onUnitPress}
          className={cn(
            'h-[46px] min-w-0 flex-[1.2] flex-row items-center justify-center gap-4 rounded-[12px] border-2 px-8',
            unitWarn ? 'border-warn-border bg-warn-soft' : 'border-line-strong bg-surface-card active:bg-surface-soft',
            focusRing,
          )}
        >
          <Text size={15} weight="800" color={unitWarn ? 'warn' : unit ? 'ink' : 'ink-muted'} numberOfLines={1} className="shrink">
            {unit ?? unitPlaceholder}
          </Text>
          <Icon name="chevron-down" size={16} color={unitWarn ? 'warn' : 'inkMuted'} />
        </Pressable>
        {weight ? (
          <View
            className={cn(
              'h-[46px] min-w-0 flex-[1.4] flex-row items-center gap-4 rounded-[12px] px-10',
              warningField === 'weight' ? 'border-2 border-warn-border bg-warn-soft' : 'bg-surface-soft',
            )}
          >
            <Text size={14} weight="700" color={warningField === 'weight' ? 'warn' : 'ink'}>
              {weight.prefix}
            </Text>
            <TextInput
              aria-label={weight.label}
              value={weight.value}
              onChangeText={weight.onChange}
              inputMode="decimal"
              maxLength={6}
              className={cn('h-[40px] min-w-0 flex-1 text-ink web:outline-none', focusRing)}
              style={{ fontFamily: theme.font[900], fontSize: 16 }}
            />
            <Text size={14} weight="700" color={warningField === 'weight' ? 'warn' : 'ink'}>
              {weight.suffix}
            </Text>
          </View>
        ) : (
          <View className="flex-[1.4]" />
        )}
      </View>
      {warning ? (
        <View role="alert" className="flex-row items-center gap-8 pl-[30px]">
          <Icon name="warning" size={18} color="warn" />
          <Text size={14} weight="700" color="warn" className="flex-1">
            {warning}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
