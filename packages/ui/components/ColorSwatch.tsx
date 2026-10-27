import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { useThemeColors } from '../ThemeProvider';
import { avatarFills, type MemberColor } from './Avatar';
import { Text } from './Text';

export interface SwatchOption {
  color: MemberColor;
  /** `selected`: mine, or the one being picked (double ring). `taken`: someone else's, can't be picked. */
  state: 'selected' | 'taken' | 'free';
  /** Who has it: shown on taken and selected swatches. */
  initial?: string;
  /** Spoken name: "Sky, taken" / "Lilac, free" / "Honey, your color". */
  accessibilityLabel: string;
}

export interface ColorSwatchProps {
  /** The group's spoken name ("My color"). */
  label: string;
  options: readonly SwatchOption[];
  onSelect: (color: MemberColor) => void;
  disabled?: boolean;
}

/** Member color picker (ColorSwatch README): 4 × 2 in a white card; taken colors show who has them. */
export function ColorSwatch({ label, options, onSelect, disabled = false }: ColorSwatchProps) {
  const colors = useThemeColors();
  const rows = [options.slice(0, 4), options.slice(4, 8)].filter((r) => r.length > 0);
  return (
    <View role="radiogroup" aria-label={label} className="gap-10 rounded-[22px] bg-surface-card p-14">
      {rows.map((row, r) => (
        <View key={r} className="flex-row gap-10">
          {row.map((o) => {
            const selected = o.state === 'selected';
            const locked = disabled || o.state === 'taken';
            return (
              <Pressable
                key={o.color}
                role="radio"
                aria-checked={selected}
                aria-disabled={locked}
                aria-label={o.accessibilityLabel}
                disabled={locked}
                onPress={() => onSelect(o.color)}
                className={cn('h-[60px] flex-1 items-center justify-center rounded-[18px]', avatarFills[o.color], focusRing)}
                style={selected ? { boxShadow: `0 0 0 3px ${colors.surfaceCard}, 0 0 0 6px ${colors.ink}` } : undefined}
              >
                {o.state !== 'free' && o.initial ? (
                  <Text size={18} weight="900">
                    {o.initial}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
