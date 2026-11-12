import type { Ref } from 'react';
import { Pressable, type HostInstance, type PressableProps } from 'react-native';
import { cn, focusRing } from '../cn';
import { theme, type ColorName } from '../theme';
import { Icon, type IconName } from './Icon';

export type IconButtonVariant = 'default' | 'card' | 'soft' | 'olive' | 'square' | 'olive-square' | 'fab' | 'round' | 'outline' | 'tint';

// bundle.css › IconButton
const looks: Record<IconButtonVariant, { box: string; icon: ColorName }> = {
  default: { box: 'w-[48px] h-[48px] rounded-full bg-surface-card active:bg-surface-card-pressed', icon: 'ink' },
  // 44, white: the calendar header's ‹ › on the page background (spec 036).
  card: { box: 'w-control-md h-control-md rounded-full bg-surface-card active:bg-surface-card-pressed', icon: 'ink' },
  soft: { box: 'w-control-md h-control-md rounded-full bg-surface-soft active:bg-surface-soft-pressed', icon: 'ink' },
  olive: { box: 'w-control-md h-control-md rounded-full bg-olive active:bg-olive-pressed', icon: 'onOlive' },
  square: { box: 'w-control-md h-control-md rounded-md bg-surface-soft active:bg-surface-soft-pressed', icon: 'ink' },
  'olive-square': { box: 'w-control-lg h-control-lg rounded-[18px] bg-olive active:bg-olive-pressed', icon: 'onOlive' },
  // 60, olive, floating: the calendar's add button (spec 037).
  fab: { box: 'w-[60px] h-[60px] rounded-full bg-olive active:bg-olive-pressed', icon: 'onOlive' },
  // 40, white, floating: the top bar's back and actions (spec 050); `hitSlop` keeps the 44 target.
  round: { box: 'w-[40px] h-[40px] rounded-full bg-surface-card active:bg-surface-card-pressed', icon: 'ink' },
  // 60, white with a 2 px olive ring, beside an ink `lg` Button: the recipe page's cart (spec 051 FR-014).
  outline: { box: 'w-[60px] h-[60px] rounded-full border-2 border-olive bg-surface-card active:bg-surface-card-pressed', icon: 'oliveDeep' },
  // 40, ink at 8% over the fill it sits on, no shadow: the toast's Undo, Try again and ✕ (spec 053).
  tint: { box: 'w-[40px] h-[40px] rounded-full bg-toast-button active:bg-toast-button-pressed', icon: 'ink' },
};

const shadows: Partial<Record<IconButtonVariant, string>> = { fab: theme.shadow.lift, round: theme.shadow.button };
// Round buttons carry a bigger icon for their size (spec 050).
const iconSizes: Partial<Record<IconButtonVariant, number>> = { round: 22, outline: 22 };
const slops: Partial<Record<IconButtonVariant, number>> = { round: 2, tint: 2 };

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: IconName;
  /** Required: "Share recipe", "More servings". */
  label: string;
  variant?: IconButtonVariant;
  /** `square` only: the "More options" panel is open (honey fill). */
  expanded?: boolean;
  /** Icon size, 20–22 per README. */
  iconSize?: number;
  /** The icon's colour when the variant's doesn't fit (`tint` on a warn toast). */
  iconColor?: ColorName;
  className?: string;
  /** To measure it (a menu opening under it) or give focus back to it. */
  ref?: Ref<HostInstance>;
}

/** A single-icon button (IconButton README). */
export function IconButton({ icon, label, variant = 'default', expanded, iconSize, iconColor, disabled, className, ...props }: IconButtonProps) {
  const look = looks[variant];
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-expanded={variant === 'square' ? expanded === true : undefined}
      disabled={disabled}
      className={cn('items-center justify-center', look.box, variant === 'square' && expanded && 'bg-honey', focusRing, className)}
      style={shadows[variant] ? { boxShadow: shadows[variant] } : undefined}
      hitSlop={slops[variant]}
      {...props}
    >
      <Icon name={icon} size={iconSize ?? iconSizes[variant] ?? 20} color={iconColor ?? look.icon} />
    </Pressable>
  );
}
