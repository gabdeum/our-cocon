import { View } from 'react-native';
import { cn } from '../cn';
import { Icon, type IconName } from './Icon';

export type IconTileTone = 'sage' | 'honey';

const fills: Record<IconTileTone, string> = { sage: 'bg-sage', honey: 'bg-honey' };

export interface IconTileProps {
  icon: IconName;
  tone?: IconTileTone;
  className?: string;
}

/**
 * A 40 px square with one ink icon, leading a card (IconTile README): a version (sage swap) or an
 * option (honey plus) on recipe settings (spec 017). Decorative: the card next to it is labelled.
 */
export function IconTile({ icon, tone = 'sage', className }: IconTileProps) {
  return (
    <View aria-hidden className={cn('h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[12px]', fills[tone], className)}>
      <Icon name={icon} size="sm" color="ink" />
    </View>
  );
}
