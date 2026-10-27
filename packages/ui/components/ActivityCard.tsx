import { View } from 'react-native';
import { Link } from './Button';
import { Text } from './Text';

export interface ActivityCardProps {
  /** "AI": what made the change. */
  badge: string;
  /** What changed: "6 items added to Groceries", "New: Pumpkin soup". */
  title: string;
  /** Who, through what, when: "Added by Alex via ChatGPT · 4 h ago", or "Undone by Gabriel". */
  sub: string;
  /** "Undo" or "Restore"; no action once undone or too old. */
  action?: { label: string; accessibilityLabel: string; onPress: () => void; disabled?: boolean };
}

/**
 * One AI change (ActivityCard README, OC-Home): a soft card with a white "AI" badge, the change, who
 * asked for it, and Undo. Home shows the latest two; the activity list shows them all (spec 026).
 */
export function ActivityCard({ badge, title, sub, action }: ActivityCardProps) {
  return (
    <View className="flex-row items-center gap-12 rounded-[20px] bg-surface-soft px-14 py-12">
      <View aria-hidden className="h-[36px] w-[36px] shrink-0 items-center justify-center rounded-[12px] bg-surface-card">
        <Text size={12} weight="900" color="olive">
          {badge}
        </Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text size={15} weight="800">
          {title}
        </Text>
        <Text size={13} weight="600" color="ink-muted">
          {sub}
        </Text>
      </View>
      {action ? (
        <Link label={action.label} accessibilityLabel={action.accessibilityLabel} onPress={action.onPress} disabled={action.disabled} className="px-4" />
      ) : null}
    </View>
  );
}
