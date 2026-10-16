import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface StatTileProps {
  icon: IconName;
  value: number | string;
  /** "to buy", "family recipes". */
  label: string;
  /** honey: things to act on (groceries) · sage: collections (recipes). */
  tone: 'honey' | 'sage';
  onPress: () => void;
  className?: string;
}

/** Big-number shortcut on Home (StatTile README). The whole tile is a link. */
export function StatTile({ icon, value, label, tone, onPress, className }: StatTileProps) {
  return (
    <Pressable
      role="link"
      aria-label={`${value} ${label}`}
      onPress={onPress}
      className={cn('gap-16 rounded-[24px] px-18 py-16', tone === 'honey' ? 'bg-honey active:bg-honey-pressed' : 'bg-sage active:bg-sage-pressed', focusRing, className)}
    >
      <Icon name={icon} size={26} />
      <View>
        <Text variant="stat" tabular>
          {value}
        </Text>
        <Text size={15} weight="700">
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
