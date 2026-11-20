import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { avatarFills, EdgeRing, type AvatarColor } from './Avatar';
import { Icon } from './Icon';
import { Text } from './Text';

export interface ReminderRowProps {
  title: string;
  /** "Was due yesterday", "15:00 · nudges hourly", "Done just now". */
  detail: string;
  /** Who it's for: an initial ("G", "Ev", or "All" for Everyone), their colour, and their name for screen readers. */
  member: { initial: string; color: AvatarColor; name: string };
  done?: boolean;
  /** The tick box (left out on a snoozed row). `toggleLabel`: "Mark done: {title}". */
  onToggle?: () => void;
  toggleLabel?: string;
  /** "2d late", "3h late": the late badge. */
  late?: string;
  /** "Snoozed": a soft pill in the late badge's place (spec 058: snoozed ones are listed on the day they're back). */
  snoozed?: string;
  /** The Reminders screen's detail icons, with their names ("Repeats", "Has notes"). */
  repeats?: string;
  notes?: string;
  /** Everything right of the dot (title, detail, late badge) is one button that opens the drawer; `openLabel`: "Open {title}". */
  onOpen?: () => void;
  openLabel?: string;
  /** Offline: the tick box keeps its look, not pressable. */
  disabled?: boolean;
  /** The last row: no divider under it. */
  last?: boolean;
  /** `sm`: Home's Reminders card, min 50 and padding 2 0; `md`: the Reminders screen. */
  size?: 'sm' | 'md';
}

/** ReminderRow README: the 28 px member dot, its initial 13/900 ("All" 10/900); half opacity when done. */
function MemberDot({ initial, color, name, done }: ReminderRowProps['member'] & { done: boolean }) {
  return (
    <View role="img" aria-label={name} className={cn('ml-2 h-[28px] w-[28px] flex-none items-center justify-center rounded-full', avatarFills[color], done && 'opacity-50')}>
      <Text size={initial.length > 2 ? 10 : 13} weight="900" aria-hidden>
        {initial}
      </Text>
      <EdgeRing color={color} />
    </View>
  );
}

/**
 * ReminderRow README (OC-HomeReminders, OC-Reminders): tick box · member dot · title and detail ·
 * late badge · ⋮. Min 58 tall (50 at `sm`, on Home), a 1.5 px divider between rows.
 */
export function ReminderRow({ title, detail, member, done = false, onToggle, toggleLabel, late, snoozed, repeats, notes, onOpen, openLabel, disabled, last = false, size = 'md' }: ReminderRowProps) {
  const text = (
    <>
      <Text size={16} weight="800" numberOfLines={1} strike={done} color={done ? 'ink-muted' : 'ink'}>
        {title}
      </Text>
      <View className="min-w-0 flex-row items-center gap-[5px]">
        {repeats && !done ? (
          <View role="img" aria-label={repeats}>
            <Icon name="repeat" size={14} color="inkMuted" />
          </View>
        ) : null}
        {notes && !done ? (
          <View role="img" aria-label={notes}>
            <Icon name="note" size={14} color="inkMuted" />
          </View>
        ) : null}
        <Text size={13} weight="700" color="ink-muted" numberOfLines={1} className="min-w-0 flex-shrink">
          {detail}
        </Text>
      </View>
    </>
  );
  const badge =
    late && !done ? (
      <View className="ml-8 flex-none rounded-full bg-warn-soft px-8 py-[3px]">
        <Text size={12} weight="900" color="warn">
          {late}
        </Text>
      </View>
    ) : snoozed && !done ? (
      <View className="ml-8 flex-none rounded-full bg-surface-soft px-8 py-[3px]">
        <Text size={12} weight="900" color="ink-muted">
          {snoozed}
        </Text>
      </View>
    ) : null;
  return (
    <View className={cn(size === 'sm' ? 'min-h-[50px] py-2' : 'min-h-[58px] py-4', 'flex-row items-center', !last && 'border-b-[1.5px] border-line')}>
      {onToggle ? (
        <Pressable
          role="checkbox"
          aria-checked={done}
          aria-label={toggleLabel}
          disabled={disabled}
          aria-disabled={disabled || undefined}
          onPress={onToggle}
          className={cn('-ml-8 h-control-md w-[40px] flex-none items-center justify-center rounded-[12px]', !disabled && 'active:bg-surface-soft', focusRing)}
        >
          <View aria-hidden className={cn('h-[24px] w-[24px] items-center justify-center rounded-[8px]', done ? 'bg-olive' : 'border-[2.5px] border-line-dashed bg-surface-card')}>
            {done ? <Icon name="check" size={16} color="onOlive" /> : null}
          </View>
        </Pressable>
      ) : null}
      <MemberDot {...member} done={done} />
      {onOpen ? (
        <Pressable
          role="button"
          aria-label={openLabel}
          aria-haspopup="dialog"
          onPress={onOpen}
          className={cn('-mr-8 ml-10 min-h-control-md min-w-0 flex-1 flex-row items-center rounded-[8px] py-2 pr-8 active:bg-surface-soft', focusRing)}
        >
          <View className="min-w-0 flex-1 gap-[1px]">{text}</View>
          {badge}
        </Pressable>
      ) : (
        <>
          <View className="ml-10 min-w-0 flex-1 gap-[1px]">{text}</View>
          {badge}
        </>
      )}
    </View>
  );
}

/** ReminderRow README › Pill: who a reminder is for, in the drawer: their name on their colour, 24 tall, 13/900. Not a control. */
export function MemberPill({ name, color }: { name: string; color: AvatarColor }) {
  return (
    <View className={cn('h-[24px] flex-none flex-row items-center rounded-pill px-[9px]', avatarFills[color])}>
      <Text size={13} weight="900" numberOfLines={1}>
        {name}
      </Text>
      <EdgeRing color={color} />
    </View>
  );
}

/** ReminderRow README › Show more: the pagination row at the end of a Reminders section's card, 48 tall, a divider above. */
export function ReminderMore({ label, busy, onPress }: { label: string; busy?: boolean; onPress: () => void }) {
  return (
    <Pressable
      role="button"
      aria-busy={busy || undefined}
      onPress={() => !busy && onPress()}
      className={cn('min-h-[48px] w-full flex-row items-center justify-between border-t-[1.5px] border-line active:bg-surface-card-pressed', focusRing)}
    >
      <Text size={15} weight="800" color="olive-deep">
        {label}
      </Text>
    </Pressable>
  );
}
