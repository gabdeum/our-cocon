import type { ReactNode } from 'react';
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
  /** The Reminders screen's detail icons, with their names ("Repeats", "Has notes"). */
  repeats?: string;
  notes?: string;
  /** Tapping the title opens it (the Reminders screen's drawer); `openLabel`: "Open {title}". */
  onOpen?: () => void;
  openLabel?: string;
  /** The ⋮ at the right, as a menu: an ActionMenu with `trigger="dots"` (Home). */
  trailing?: ReactNode;
  /** The ⋮ at the right, as a button that opens a dialog (the Reminders screen's drawer): "Open {title}". */
  more?: { label: string; onPress: () => void };
  /** Offline: the tick box keeps its look, not pressable. */
  disabled?: boolean;
  /** The last row: no divider under it. */
  last?: boolean;
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
 * late badge · ⋮. Min 58 tall, a 1.5 px divider between rows.
 */
export function ReminderRow({ title, detail, member, done = false, onToggle, toggleLabel, late, repeats, notes, onOpen, openLabel, trailing, more, disabled, last = false }: ReminderRowProps) {
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
  return (
    <View className={cn('min-h-[58px] flex-row items-center py-4', !last && 'border-b-[1.5px] border-line')}>
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
        <Pressable role="button" aria-label={openLabel} onPress={onOpen} className={cn('ml-10 min-w-0 flex-1 gap-[1px] rounded-[8px] py-2 active:bg-surface-soft', focusRing)}>
          {text}
        </Pressable>
      ) : (
        <View className="ml-10 min-w-0 flex-1 gap-[1px]">{text}</View>
      )}
      {late && !done ? (
        <View className="ml-8 flex-none rounded-full bg-warn-soft px-8 py-[3px]">
          <Text size={12} weight="900" color="warn">
            {late}
          </Text>
        </View>
      ) : null}
      {trailing ? <View className="-mr-8 flex-none">{trailing}</View> : null}
      {more ? (
        <Pressable
          role="button"
          aria-label={more.label}
          aria-haspopup="dialog"
          onPress={more.onPress}
          className={cn('-mr-8 h-control-md w-[36px] flex-none items-center justify-center rounded-[12px] active:bg-surface-soft', focusRing)}
        >
          <Icon name="more-vertical" size={20} color="ink" />
        </Pressable>
      ) : null}
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
