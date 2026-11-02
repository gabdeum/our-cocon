import type { ReactNode } from 'react';
import { View } from 'react-native';
import { cn } from '../cn';
import { avatarFills, type AvatarColor } from './Avatar';
import { Link } from './Button';
import { Text } from './Text';

export interface ActivityRowProps {
  /** Who made the change: their initial in their color, or "AI" when their assistant did. */
  badge: { kind: 'person'; initial: string; color: AvatarColor } | { kind: 'ai'; label: string; color: AvatarColor };
  /** "Eva added Pumpkin soup", "Gabriel ticked 4 items". */
  title: string;
  /** "Recipes · via ChatGPT · 1 h ago", or "Undone by Gabriel". */
  sub: string;
  /** "Undo" or "Restore" on an AI change; none on the family's own changes, once undone, or too old. */
  action?: { label: string; accessibilityLabel: string; onPress: () => void; disabled?: boolean };
  /** No divider under the last row. */
  last?: boolean;
}

/**
 * One change in the activity log (ActivityRow README, OC-Home › Latest activity, OC-Activity): a
 * 36 badge, what changed and when, and Undo for an AI change (spec 026, spec 028 FR-006).
 */
export function ActivityRow({ badge, title, sub, action, last }: ActivityRowProps) {
  const ai = badge.kind === 'ai';
  return (
    <View role="listitem" className={cn('min-h-[56px] flex-row items-center gap-12 py-4', !last && 'border-b-[1.5px] border-line')}>
      <View
        aria-hidden
        className={cn('h-[36px] w-[36px] shrink-0 items-center justify-center', ai ? 'rounded-[12px] border-2 border-olive' : 'rounded-full', avatarFills[badge.color])}
      >
        <Text size={ai ? 12 : 14} weight="900">
          {ai ? badge.label : badge.initial}
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

export interface LatestActivityCardProps {
  /** "Latest activity": the title, and the region's name. */
  title: string;
  /** Right of the title: the "All · AI only" SegmentedControl (pill). */
  toggle: ReactNode;
  /** The rows, or a 15/700 ink-muted line when AI only has none. */
  children: ReactNode;
  /** "See all activity". */
  footer: ReactNode;
}

/** ActivityRow README › Card: Home's white card (radius 26, padding 14 16 10, gap 8) around the rows. */
export function LatestActivityCard({ title, toggle, children, footer }: LatestActivityCardProps) {
  return (
    <View role="region" aria-label={title} className="gap-8 rounded-[26px] bg-surface-card px-16 pb-10 pt-14">
      <View className="flex-row items-center gap-10">
        <Text role="heading" aria-level={2} size={20} weight="900" className="min-w-0 flex-1">
          {title}
        </Text>
        {toggle}
      </View>
      {children}
      {footer}
    </View>
  );
}
