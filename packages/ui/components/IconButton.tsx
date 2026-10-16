import { Pressable, type PressableProps } from 'react-native';
import { cn, focusRing } from '../cn';
import type { ColorName } from '../theme';
import { Icon, type IconName } from './Icon';

export type IconButtonVariant = 'default' | 'soft' | 'olive' | 'square' | 'olive-square';

// bundle.css › IconButton
const looks: Record<IconButtonVariant, { box: string; icon: ColorName }> = {
  default: { box: 'w-[48px] h-[48px] rounded-full bg-surface-card active:bg-surface-card-pressed', icon: 'ink' },
  soft: { box: 'w-control-md h-control-md rounded-full bg-surface-soft active:bg-surface-soft-pressed', icon: 'ink' },
  olive: { box: 'w-control-md h-control-md rounded-full bg-olive active:bg-olive-pressed', icon: 'onOlive' },
  square: { box: 'w-control-md h-control-md rounded-md bg-surface-soft active:bg-surface-soft-pressed', icon: 'ink' },
  'olive-square': { box: 'w-control-lg h-control-lg rounded-[18px] bg-olive active:bg-olive-pressed', icon: 'onOlive' },
};

export interface IconButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  icon: IconName;
  /** Required: "Share recipe", "More servings". */
  label: string;
  variant?: IconButtonVariant;
  /** `square` only: the "More options" panel is open (honey fill). */
  expanded?: boolean;
  /** Icon size, 20–22 per README. */
  iconSize?: number;
  className?: string;
}

/** A single-icon button (IconButton README). */
export function IconButton({ icon, label, variant = 'default', expanded, iconSize = 20, disabled, className, ...props }: IconButtonProps) {
  const look = looks[variant];
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-expanded={variant === 'square' ? expanded === true : undefined}
      disabled={disabled}
      className={cn('items-center justify-center', look.box, variant === 'square' && expanded && 'bg-honey', focusRing, className)}
      {...props}
    >
      <Icon name={icon} size={iconSize} color={look.icon} />
    </Pressable>
  );
}
