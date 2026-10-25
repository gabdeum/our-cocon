import { useRef, useState } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';
import { cn, focusRing } from '../cn';
import type { ColorName } from '../theme';
import { BrandMark, Icon, type BrandName, type IconName } from './Icon';
import { Text, type TextColor, type Weight } from './Text';

export type ButtonVariant = 'ink' | 'olive' | 'honey' | 'soft' | 'outline' | 'dashed' | 'tile' | 'danger';
/** sm 44 · md 58 · lg 60 (cooking mode, recipe CTA) · dialog 56 (Dialog README). */
export type ButtonSize = 'sm' | 'md' | 'lg' | 'dialog';

interface Look {
  fill: string;
  text: TextColor;
  icon: ColorName;
  weight: Weight;
  /** Label size when the variant sets its own (outline 16, dashed 15). */
  fontSize?: number;
  /** outline and dashed are 54 tall, tile 44, whatever the size (outline `lg` is 60, to pair with an ink `lg`). */
  fixedHeight?: string;
  /** dashed: radius 18, tile: 12, instead of a pill. */
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
  // A choice in a two-column grid of actions: "Add a change" (OC-EditVariants, spec 017).
  tile: {
    fill: 'bg-surface-card border-2 border-line-strong active:bg-surface-soft',
    radius: 'rounded-[12px]',
    text: 'ink',
    icon: 'ink',
    weight: '800',
    fontSize: 14,
    fixedHeight: 'h-control-md',
  },
  danger: { fill: 'bg-danger active:bg-danger-pressed', text: 'on-olive', icon: 'onOlive', weight: '900' },
};

const sizes: Record<ButtonSize, { height: string; padding: string; paddingPx: number; fontSize: number }> = {
  sm: { height: 'h-control-md', padding: 'px-18', paddingPx: 18, fontSize: 15 },
  md: { height: 'h-control-xl', padding: 'px-24', paddingPx: 24, fontSize: 17 },
  lg: { height: 'h-[60px]', padding: 'px-24', paddingPx: 24, fontSize: 18 },
  dialog: { height: 'h-[56px]', padding: 'px-24', paddingPx: 24, fontSize: 17 },
};

/** The icon (20) and its gap (10) before the label. */
const ICON_SPACE = 30;

/**
 * Whether a label `textWidth` wide fits on one line in a button `buttonWidth` wide, with its
 * padding on both sides and the icon if it has one. Unmeasured (0) counts as fitting.
 */
export function labelFits(buttonWidth: number, textWidth: number, paddingPx: number, hasIcon: boolean): boolean {
  if (buttonWidth <= 0 || textWidth <= 0) return true;
  return textWidth <= buttonWidth - 2 * paddingPx - (hasIcon ? ICON_SPACE : 0);
}

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Full width. */
  block?: boolean;
  icon?: IconName;
  /** A sign-in provider's mark in place of the icon: "Continue with Google" (outline). */
  brand?: BrandName;
  /** Keeps the width and shows `busyLabel` ("Saving…") while work runs. */
  busy?: boolean;
  busyLabel?: string;
  /**
   * A shorter label ("Cook") shown in place of `label` when it doesn't fit on one line, never
   * wrapped or cut. Screen readers still read `label`.
   */
  shortLabel?: string;
  /** Shows `shortLabel` whatever the width: a button beside this one went short, so both do. */
  short?: boolean;
  /** Whether `label` fits, once measured (to shorten a pair of buttons together). */
  onLabelFits?: (fits: boolean) => void;
  className?: string;
}

/** Pill-shaped button (Button README). One ink button per screen. */
export function Button({
  label,
  variant = 'ink',
  size = 'md',
  block,
  icon,
  brand,
  disabled,
  busy,
  busyLabel,
  shortLabel,
  short,
  onLabelFits,
  className,
  ...props
}: ButtonProps) {
  const look = looks[variant];
  const s = sizes[size];
  const off = disabled === true;
  const fontSize = look.fontSize ?? s.fontSize;
  // With a short label: the button's width and the full label's own width, measured. Refs, as both
  // layouts can arrive in one render.
  const width = useRef(0);
  const textWidth = useRef(0);
  const [fits, setFits] = useState(true);
  const measure = () => {
    const next = labelFits(width.current, textWidth.current, s.paddingPx, Boolean(icon || brand));
    setFits(next);
    if (width.current > 0 && textWidth.current > 0) onLabelFits?.(next);
  };
  const shown = busy && busyLabel ? busyLabel : shortLabel && (short || !fits) ? shortLabel : label;
  return (
    <Pressable
      role="button"
      disabled={off || busy}
      aria-busy={busy || undefined}
      aria-label={shortLabel && shown !== label ? label : undefined}
      onLayout={
        shortLabel
          ? (e) => {
              width.current = e.nativeEvent.layout.width;
              measure();
            }
          : undefined
      }
      className={cn(
        'flex-row items-center justify-center gap-10',
        shortLabel && 'overflow-hidden',
        look.radius ?? 'rounded-pill',
        (size === 'lg' && variant === 'outline' ? undefined : look.fixedHeight) ?? s.height,
        s.padding,
        off ? 'bg-on-ink' : look.fill,
        block ? 'self-stretch' : 'self-start',
        focusRing,
        className,
      )}
      {...props}
    >
      {brand ? <BrandMark name={brand} /> : icon ? <Icon name={icon} color={off ? 'inkMuted' : look.icon} /> : null}
      <Text size={fontSize} weight={look.weight} color={off ? 'ink-muted' : look.text} numberOfLines={1}>
        {shown}
      </Text>
      {shortLabel ? (
        // The full label at its own width, out of sight, to know whether it fits.
        <View aria-hidden pointerEvents="none" className="absolute left-0 top-0 w-[1000px] flex-row opacity-0">
          <Text
            size={fontSize}
            weight={look.weight}
            onLayout={(e) => {
              textWidth.current = e.nativeEvent.layout.width;
              measure();
            }}
          >
            {label}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/** `warn`: an action that ends something but can be redone, like "Stop sharing this link" (OC-Share). */
export type LinkTone = 'olive' | 'danger' | 'warn' | 'quiet';
const linkColor: Record<LinkTone, TextColor> = { olive: 'olive', danger: 'danger', warn: 'warn', quiet: 'ink-muted' };
const linkIconColor: Record<LinkTone, ColorName> = { olive: 'olive', danger: 'danger', warn: 'warn', quiet: 'inkMuted' };

export interface LinkProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  tone?: LinkTone;
  /** Visible size; 15 by default, 16 for back links and form-bar Cancel. */
  size?: number;
  underline?: boolean;
  weight?: Weight;
  /** Optional 18 px icon before the label, in the label's colour: trash for "Delete this recipe". */
  icon?: IconName;
  className?: string;
}

/** Tertiary text button (Button README › link): "Clear all", "See all", "Stop sharing". 44 tall touch area. */
export function Link({ label, tone = 'olive', size = 15, underline, weight = '800', icon, className, ...props }: LinkProps) {
  return (
    <Pressable role="button" className={cn('min-h-touch-min flex-row items-center gap-8 self-start', focusRing, className)} {...props}>
      {icon ? <Icon name={icon} size={18} color={props.disabled ? 'inkMuted' : linkIconColor[tone]} /> : null}
      <Text size={size} weight={weight} color={props.disabled ? 'ink-muted' : linkColor[tone]} underline={underline}>
        {label}
      </Text>
    </Pressable>
  );
}
