import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Icon } from './Icon';
import { Link } from './Button';
import { Text } from './Text';

export interface StatusBannerProps {
  /** "Recipe deleted". */
  message: string;
  undoLabel?: string;
  onUndo?: () => void;
  className?: string;
}

/** Confirmation with Undo (StatusBanner README › oc-status). Never stack two; a new one replaces the old. */
export function StatusBanner({ message, undoLabel, onUndo, className }: StatusBannerProps) {
  return (
    <View role="status" aria-live="polite" className={cn('min-h-control-lg flex-row items-center justify-between gap-8 rounded-[18px] bg-sage pl-16 pr-8', className)}>
      <Text size={15} weight="800" className="flex-1">
        {message}
      </Text>
      {undoLabel && onUndo ? (
        <Pressable role="button" onPress={onUndo} className={cn('h-control-md justify-center px-12', focusRing)}>
          <Text size={15} weight="900" underline>
            {undoLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** "Mia is shopping" (oc-presence): sage pill with an 8 px olive dot. */
export function Presence({ label }: { label: string }) {
  return (
    <View className="self-start flex-row items-center gap-6 rounded-pill bg-sage px-12 py-[7px]">
      <View aria-hidden className="h-8 w-8 rounded-full bg-olive" />
      <Text size={13} weight="800">
        {label}
      </Text>
    </View>
  );
}

/** "Screen stays on" (oc-awake): sage pill, olive-deep text, 16 px screen-on icon. */
export function AwakeChip({ label }: { label: string }) {
  return (
    <View className="self-start flex-row items-center gap-6 rounded-pill bg-sage px-12 py-8">
      <Icon name="screen-on" size={16} color="oliveDeep" />
      <Text size={13} weight="800" color="olive-deep">
        {label}
      </Text>
    </View>
  );
}

export interface SuccessPanelProps {
  title: string;
  body: string;
  undoLabel?: string;
  onUndo?: () => void;
  /** The two buttons under it (see Add to groceries). */
  actions: ReactNode;
}

/** Full-screen success (StatusBanner README): 72 sage disc with a 34 check, title, body, Undo, buttons. */
export function SuccessPanel({ title, body, undoLabel, onUndo, actions }: SuccessPanelProps) {
  return (
    <View role="status" className="items-center gap-12">
      <View className="h-[72px] w-[72px] items-center justify-center rounded-full bg-sage">
        <Icon name="check" size={34} />
      </View>
      <Text size={22} weight="900" align="center" role="heading">
        {title}
      </Text>
      <Text size={15} weight="600" color="ink-muted" align="center">
        {body}
      </Text>
      {undoLabel && onUndo ? <Link label={undoLabel} onPress={onUndo} underline className="self-center" /> : null}
      <View className="gap-10 self-stretch">{actions}</View>
    </View>
  );
}
