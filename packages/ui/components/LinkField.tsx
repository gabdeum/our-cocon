import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Text } from './Text';

export interface LinkFieldProps {
  /** The link, or a state in its place: "Creating link…", "Not shared". */
  value: string;
  /** The field's screen-reader name: "Link". */
  label: string;
  /** "Copy link", "Copied ✓", "Create a new link". */
  actionLabel: string;
  onAction: () => void;
  /** No action yet (the link is still being made). */
  actionDisabled?: boolean;
}

/**
 * A link to send and its one action (LinkField README; OC-Share): a read-only 54 field that
 * truncates, and an ink button of the same height.
 */
export function LinkField({ value, label, actionLabel, onAction, actionDisabled }: LinkFieldProps) {
  return (
    <View className="flex-row gap-8">
      <View aria-label={label} className="h-[54px] min-w-0 flex-1 justify-center rounded-[16px] border-2 border-line-strong bg-surface-card px-14">
        <Text size={15} weight="700" color="ink-muted" numberOfLines={1} selectable>
          {value}
        </Text>
      </View>
      <Pressable
        role="button"
        aria-disabled={actionDisabled}
        disabled={actionDisabled}
        onPress={onAction}
        className={cn('h-[54px] items-center justify-center rounded-[16px] px-18', actionDisabled ? 'bg-on-ink' : 'bg-ink active:bg-ink-pressed', focusRing)}
      >
        <Text size={16} weight="900" color={actionDisabled ? 'ink-muted' : 'on-olive'} numberOfLines={1}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}
