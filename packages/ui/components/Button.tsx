import { Pressable, type PressableProps } from 'react-native';
import { cn, focusRing } from '../cn';
import type { ColorName } from '../theme';
import { Icon, type IconName } from './Icon';
import { Text, type TextColor, type Weight } from './Text';

export type ButtonVariant = 'ink' | 'olive' | 'honey' | 'soft' | 'outline' | 'dashed' | 'danger';
/** sm 44 · md 58 · lg 60 (cooking mode, recipe CTA) · dialog 56 (Dialog README). */
export type ButtonSize = 'sm' | 'md' | 'lg' | 'dialog';

interface Look {
  fill: string;
  text: TextColor;
  icon: ColorName;
  weight: Weight;
  /** Label size when the variant sets its own (outline 16, dashed 15). */
  fontSize?: number;
  /** outline and dashed are 54 tall whatever the size. */
  fixedHeight?: string;
  /** dashed: radius 18 instead of a pill. */
  radius?: string;
}

// bundle.css › Button
const looks: Record<ButtonVariant, Look> = {
  ink: { fill: 'bg-ink active:bg-ink-pressed', text: 'on-olive', icon: 'onOlive', weight: '900' },
  olive: { fill: 'bg-olive active:bg-olive-pressed', text: 'on-olive', icon: 'onOlive', weight: '900' },
  honey: { fill: 'bg-honey active:bg-honey-pressed', text: 'ink', icon: 'ink', weight: '900' },
  soft: { fill: 'bg-surface-soft active:bg-surface-soft-pressed', text: 'ink', icon: 'ink', weight: '800' },
  outline: {
    fill: 'bg-surface-card border-2 border-olive active:bg-surface-card-pressed',
    text: 'olive-deep',
    icon: 'oliveDeep',
    weight: '800',
    fontSize: 16,
    fixedHeight: 'h-control-lg',
  },
  dashed: {
    fill: 'bg-transparent border-2 border-dashed border-line-dashed active:bg-surface-soft',
    radius: 'rounded-[18px]',
    text: 'olive-deep',
    icon: 'oliveDeep',
    weight: '800',
    fontSize: 15,
    fixedHeight: 'h-control-lg',
  },
  danger: { fill: 'bg-danger active:bg-danger-pressed', text: 'on-olive', icon: 'onOlive', weight: '900' },
};

const sizes: Record<ButtonSize, { height: string; padding: string; fontSize: number }> = {
  sm: { height: 'h-control-md', padding: 'px-18', fontSize: 15 },
  md: { height: 'h-control-xl', padding: 'px-24', fontSize: 17 },
  lg: { height: 'h-[60px]', padding: 'px-24', fontSize: 18 },
  dialog: { height: 'h-[56px]', padding: 'px-24', fontSize: 17 },
};

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width. */
  block?: boolean;
  icon?: IconName;
  /** Keeps the width and shows `busyLabel` ("Saving…") while work runs. */
  busy?: boolean;
  busyLabel?: string;
  className?: string;
}

/** Pill-shaped button (Button README). One ink button per screen. */
export function Button({
  label,
  variant = 'ink',
  size = 'md',
  block,
  icon,
  disabled,
  busy,
  busyLabel,
  className,
  ...props
}: ButtonProps) {
  const look = looks[variant];
  const s = sizes[size];
  const off = disabled === true;
  return (
    <Pressable
      role="button"
      disabled={off || busy}
      aria-busy={busy || undefined}
      className={cn(
        'flex-row items-center justify-center gap-10',
        look.radius ?? 'rounded-pill',
        look.fixedHeight ?? s.height,
        s.padding,
        off ? 'bg-on-ink' : look.fill,
        block ? 'self-stretch' : 'self-start',
        focusRing,
        className,
      )}
      {...props}
    >
      {icon ? <Icon name={icon} color={off ? 'inkMuted' : look.icon} /> : null}
      <Text size={look.fontSize ?? s.fontSize} weight={look.weight} color={off ? 'ink-muted' : look.text} numberOfLines={1}>
        {busy && busyLabel ? busyLabel : label}
      </Text>
    </Pressable>
  );
}

export type LinkTone = 'olive' | 'danger' | 'quiet';
const linkColor: Record<LinkTone, TextColor> = { olive: 'olive', danger: 'danger', quiet: 'ink-muted' };

export interface LinkProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  tone?: LinkTone;
  /** Visible size; 15 by default, 16 for back links and form-bar Cancel. */
  size?: number;
  underline?: boolean;
  weight?: Weight;
  className?: string;
}

/** Tertiary text button (Button README › link): "Clear all", "See all", "Stop sharing". 44 tall touch area. */
export function Link({ label, tone = 'olive', size = 15, underline, weight = '800', className, ...props }: LinkProps) {
  return (
    <Pressable role="button" className={cn('min-h-touch-min justify-center self-start', focusRing, className)} {...props}>
      <Text size={size} weight={weight} color={linkColor[tone]} underline={underline}>
        {label}
      </Text>
    </Pressable>
  );
}
