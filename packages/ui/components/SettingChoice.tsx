import type { ReactNode } from 'react';
import { View } from 'react-native';
import { cn } from '../cn';
import { Text } from './Text';

export interface SettingChoiceProps {
  label: string;
  /** Says why it matters: "So the list shows packs you can actually buy". */
  hint?: string;
  /** The choice itself, usually a light SegmentedControl. */
  children: ReactNode;
  /**
   * What the choice does, on a surface-page line under it: "Recipe needs **300 ml cream**" →
   * "Buy 2 × 20 cl". `strong` is the bold part after `lead`.
   */
  example?: { lead: string; strong: string; result: string };
  last?: boolean;
  /** Offline: the label is muted, like a disabled SettingRow. */
  disabled?: boolean;
}

/**
 * A setting with its options under it (SettingChoice README): "Where do you shop?", "Units". It
 * sits in a ListGroup with SettingRows and shares their divider.
 */
export function SettingChoice({ label, hint, children, example, last, disabled }: SettingChoiceProps) {
  return (
    <View className={cn('gap-10 py-14', !last && 'border-b-[1.5px] border-line')}>
      <View>
        <Text size={16} weight="800" color={disabled ? 'ink-muted' : 'ink'}>
          {label}
        </Text>
        {hint ? (
          <Text variant="caption" color="ink-muted" className="mt-[2px]">
            {hint}
          </Text>
        ) : null}
      </View>
      {children}
      {example ? (
        <View className="flex-row items-center justify-between gap-10 rounded-md bg-surface-page px-12 py-10">
          <Text size={14} weight="700" className="min-w-0 flex-1">
            {example.lead}
            <Text size={14} weight="900">
              {example.strong}
            </Text>
          </Text>
          <Text size={14} weight="900" color="olive-deep" numberOfLines={1}>
            {example.result}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
