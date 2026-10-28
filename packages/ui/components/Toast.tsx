import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { theme } from '../theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface ToastProps {
  text: string;
  /** "Got it". */
  actionLabel: string;
  onAction: () => void;
  className?: string;
}

/**
 * Toast README › Hint: a sage card with one line of help and a white "Got it" button, floating
 * over the screen (the month view's first-visit hint, spec 037). The ink Undo toast comes with 041.
 */
export function Toast({ text, actionLabel, onAction, className }: ToastProps) {
  return (
    <View role="status" className={cn('flex-row items-center gap-10 rounded-[20px] bg-sage px-14 py-12', className)} style={{ boxShadow: theme.shadow.lift }}>
      <Text size={14} weight="800" className="flex-1" style={{ lineHeight: 14 * 1.35 }}>
        {text}
      </Text>
      <Pressable role="button" onPress={onAction} className={cn('h-control-md flex-none items-center justify-center rounded-pill bg-surface-card px-14 active:bg-surface-card-pressed', focusRing)}>
        <Text size={15} weight="900">
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

export interface FloatingAddProps {
  /** "Add event". */
  label: string;
  onPress: () => void;
  /** A hint card to its left (the month's first-visit hint). */
  hint?: ToastProps | null;
  /** Toast README: the add button hides while a toast shows (spec 041's save toast). */
  hidden?: boolean;
}

/**
 * The calendar's floating olive add button, 20 from the right and 112 from the bottom (above the
 * tab bar), with an optional hint card to its left (OC-CalMonth). Place it last in a full-height screen.
 */
export function FloatingAdd({ label, onPress, hint, hidden = false }: FloatingAddProps) {
  if (hidden) return null;
  return (
    <>
      {hint ? <Toast {...hint} className="absolute bottom-[112px] left-16 right-[92px] z-20" /> : null}
      <IconButton variant="fab" icon="plus" iconSize={28} label={label} onPress={onPress} className="absolute bottom-[112px] right-20 z-20" />
    </>
  );
}
