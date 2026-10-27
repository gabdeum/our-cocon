import { View } from 'react-native';
import { cn } from '../cn';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type IconTileTone = 'sage' | 'honey' | 'peach' | 'soft';

const fills: Record<IconTileTone, string> = { sage: 'bg-sage', honey: 'bg-honey', peach: 'bg-peach', soft: 'bg-surface-soft' };

export type IconTileProps = {
  tone?: IconTileTone;
  className?: string;
} & ({ icon: IconName; letters?: never } | { letters: string; icon?: never });

/**
 * A 40 px square with one ink icon, leading a card (IconTile README): a version (sage swap) or an
 * option (honey plus) on recipe settings (spec 017). Or an assistant's letters (16/900) on its row
 * in Settings › AI assistants (spec 025). Decorative: the card or row next to it is labelled.
 */
export function IconTile({ icon, letters, tone = 'sage', className }: IconTileProps) {
  return (
    <View aria-hidden className={cn('h-[40px] w-[40px] shrink-0 items-center justify-center rounded-[12px]', fills[tone], className)}>
      {icon ? (
        <Icon name={icon} size="sm" color="ink" />
      ) : (
        <Text size={16} weight="900">
          {letters}
        </Text>
      )}
    </View>
  );
}
