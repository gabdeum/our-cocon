import { View } from 'react-native';
import { cn } from '../cn';
import { Text } from './Text';

export interface ResultTileProps {
  /** "1¼" */
  value: string;
  /** "cups" */
  label: string;
  /** The main result is honey; the others white. */
  main?: boolean;
  className?: string;
}

/** A converted amount (ResultTile README; OC-Units): a big number over its unit. Not tappable. */
export function ResultTile({ value, label, main, className }: ResultTileProps) {
  return (
    <View aria-label={`${value} ${label}`} className={cn('rounded-[20px] px-16 py-14', main ? 'bg-honey' : 'bg-surface-card', className)}>
      <Text size={26} weight="900" tabular aria-hidden>
        {value}
      </Text>
      <Text size={15} weight="700" aria-hidden>
        {label}
      </Text>
    </View>
  );
}
