import { View } from 'react-native';
import { brandShapes, iconShapes, LogoShape, type BrandName, type IconName } from '../icons.generated';
import { useThemeColors } from '../ThemeProvider';
import { theme, type ColorName } from '../theme';

export type { BrandName, IconName };

const sizes = { sm: theme.size.iconSm, md: theme.size.iconMd } as const;

export interface IconProps {
  name: IconName;
  /** sm 20 (buttons, pills, callouts) · md 24 (tab bar, stat tiles) · or a px size from a README. */
  size?: keyof typeof sizes | number;
  color?: ColorName;
}

/** A design-system icon (design/system/assets/Icons). Decorative: label the control around it. */
export function Icon({ name, size = 'sm', color = 'ink' }: IconProps) {
  const colors = useThemeColors();
  const px = typeof size === 'number' ? size : sizes[size];
  const Shape = iconShapes[name];
  return (
    <View aria-hidden style={{ width: px, height: px }}>
      <Shape size={px} color={colors[color]} />
    </View>
  );
}

/** The Our Cocon mark (Logos/README.md): never on honey. */
export function Logo({ size = 34 }: { size?: number }) {
  const colors = useThemeColors();
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <LogoShape size={size} honey={colors.honey} ink={colors.ink} />
    </View>
  );
}

/** A sign-in provider's mark ("Continue with Google"), in its own colours. Decorative. */
export function BrandMark({ name, size = theme.size.iconSm }: { name: BrandName; size?: number }) {
  const Shape = brandShapes[name];
  return (
    <View aria-hidden style={{ width: size, height: size }}>
      <Shape size={size} />
    </View>
  );
}
