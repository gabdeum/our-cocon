import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { theme } from '../theme';
import { cn } from '../cn';

export type TextVariant = keyof typeof theme.text;
export type Weight = keyof typeof theme.font;
/** Text colours allowed by Extending.md's pairing table (plus danger and ink-faint for their one use). */
export type TextColor = 'ink' | 'ink-muted' | 'ink-faint' | 'olive' | 'olive-deep' | 'warn' | 'on-olive' | 'on-ink' | 'peach-ink' | 'danger' | 'surface-page';

const colorClass: Record<TextColor, string> = {
  ink: 'text-ink',
  'ink-muted': 'text-ink-muted',
  'ink-faint': 'text-ink-faint',
  olive: 'text-olive',
  'olive-deep': 'text-olive-deep',
  warn: 'text-warn',
  'on-olive': 'text-on-olive',
  'on-ink': 'text-on-ink',
  'peach-ink': 'text-peach-ink',
  danger: 'text-danger',
  // bundle.css uses it for text on the dark timer card.
  'surface-page': 'text-surface-page',
};

export interface TextProps extends RNTextProps {
  /** A text style from tokens.json. */
  variant?: TextVariant;
  /** Overrides the variant's size, for component sizes bundle.css sets directly (e.g. 14 px pills). */
  size?: number;
  weight?: Weight;
  color?: TextColor;
  tabular?: boolean;
  uppercase?: boolean;
  align?: 'left' | 'center' | 'right';
  strike?: boolean;
  underline?: boolean;
  className?: string;
}

/** Nunito text from the type tokens. Weights map to their own font files (Nunito_900Black…). */
export function Text({
  variant = 'body',
  size,
  weight,
  color = 'ink',
  tabular,
  uppercase,
  align,
  strike,
  underline,
  className,
  style,
  ...props
}: TextProps) {
  const t = theme.text[variant];
  const w = weight ?? (t.fontWeight as Weight);
  const fontSize = size ?? t.fontSize;
  return (
    <RNText
      className={cn(colorClass[color], uppercase && 'uppercase', strike && 'line-through', underline && 'underline', className)}
      style={[
        {
          fontFamily: theme.font[w],
          fontSize,
          lineHeight: size ? undefined : t.lineHeight,
          letterSpacing: t.letterSpacing,
          textAlign: align,
          fontVariant: tabular ? ['tabular-nums'] : undefined,
        },
        style,
      ]}
      {...props}
    />
  );
}
