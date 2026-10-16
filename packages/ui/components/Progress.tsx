import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Text } from './Text';

const segment = (i: number, current: number) => (i < current ? 'bg-olive-muted' : i === current ? 'bg-olive' : 'bg-line-strong');

export interface FormProgressProps<K extends string> {
  sections: { key: K; label: string }[];
  current: K;
  onSelect: (key: K) => void;
}

/** Form sections (Progress README › oc-formnav): bar 6 tall + label; each one opens its section. */
export function FormProgress<K extends string>({ sections, current, onSelect }: FormProgressProps<K>) {
  const at = sections.findIndex((s) => s.key === current);
  return (
    <View className="flex-row gap-6">
      {sections.map((s, i) => (
        <Pressable
          key={s.key}
          role="link"
          aria-current={i === at ? 'step' : undefined}
          onPress={() => onSelect(s.key)}
          className={cn('min-h-touch-min flex-1 gap-6', focusRing)}
        >
          <View className={cn('h-6 rounded-[3px]', segment(i, at))} />
          <Text size={13} weight={i === at ? '900' : '700'} color={i === at ? 'ink' : 'ink-muted'} numberOfLines={1}>
            {s.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export interface CookProgressProps {
  count: number;
  /** 0-based. */
  current: number;
  onSelect: (index: number) => void;
  /** "Step 2 of 6". */
  stepLabel: string;
  /** Right-hand hint (14/700 muted). */
  hint?: string;
  /** Screen-reader name of each segment: (i) => "Go to step 3". */
  segmentLabel: (index: number) => string;
}

/** Cooking-mode steps (Progress README › --cook): 8-tall bars in 44-tall tap areas; tap jumps. */
export function CookProgress({ count, current, onSelect, stepLabel, hint, segmentLabel }: CookProgressProps) {
  return (
    <View className="gap-6">
      <View className="flex-row gap-6">
        {Array.from({ length: count }, (_, i) => (
          <Pressable
            key={i}
            role="button"
            aria-label={segmentLabel(i)}
            aria-current={i === current ? 'step' : undefined}
            onPress={() => onSelect(i)}
            className={cn('min-h-touch-min flex-1 justify-center', focusRing)}
          >
            <View className={cn('h-8 rounded-[4px]', segment(i, current))} />
          </Pressable>
        ))}
      </View>
      <View className="flex-row items-center justify-between gap-8">
        <Text size={14} weight="900" color="olive" uppercase>
          {stepLabel}
        </Text>
        {hint ? (
          <Text size={14} weight="700" color="ink-muted">
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
