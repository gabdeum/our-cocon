import { View } from 'react-native';
import { cn } from '../cn';
import { Text, type TextColor, type Weight } from './Text';

export type TagTone = 'sage' | 'warn' | 'honey' | 'white' | 'soft';

// bundle.css › Tag
const tags: Record<TagTone, { fill: string; text: TextColor; weight: Weight }> = {
  sage: { fill: 'bg-sage', text: 'olive-deep', weight: '800' },
  warn: { fill: 'bg-warn-soft', text: 'warn', weight: '800' },
  honey: { fill: 'bg-honey', text: 'ink', weight: '900' },
  white: { fill: 'bg-surface-card', text: 'ink', weight: '800' },
  soft: { fill: 'bg-surface-soft', text: 'ink', weight: '800' },
};

/** Small non-interactive label (Tag README): "Variant", "To buy", "+1", "Latest recipe", a step's "Tip". */
export function Tag({ label, tone = 'sage', className }: { label: string; tone?: TagTone; className?: string }) {
  const t = tags[tone];
  return (
    <View className={cn('self-start flex-row items-center rounded-pill px-10 py-4', t.fill, className)}>
      <Text variant="tag" weight={t.weight} color={t.text} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export type MetaTone = 'soft' | 'white' | 'sage' | 'warn';

const metas: Record<MetaTone, string> = {
  soft: 'bg-surface-soft',
  white: 'bg-surface-card',
  sage: 'bg-sage',
  warn: 'bg-warn-soft',
};

/** Meta chip (Tag README › oc-meta): "1 h 10", "Best Oct – Mar", "2 to buy". */
export function Meta({ label, tone = 'soft', className }: { label: string; tone?: MetaTone; className?: string }) {
  return (
    <View className={cn('self-start flex-row items-center rounded-pill px-12 py-6', metas[tone], className)}>
      <Text size={14} weight={tone === 'warn' ? '800' : '700'} color={tone === 'warn' ? 'warn' : 'ink'}>
        {label}
      </Text>
    </View>
  );
}
