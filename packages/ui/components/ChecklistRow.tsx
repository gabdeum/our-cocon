import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { Text } from './Text';

export interface ChecklistRowProps {
  label: string;
  done: boolean;
  /** Ticks or unticks it (the event page, spec 042). Left out in the add sheet, where rows are only listed. */
  onToggle?: () => void;
  /** Offline: the checkbox keeps its look and its tick, `aria-disabled`, not pressable (as ListRow). */
  disabled?: boolean;
  /** The add sheet: a remove button, labelled "Remove {label}" by the caller. */
  remove?: { label: string; onPress: () => void };
  /** The last row: no divider under it. */
  last?: boolean;
}

function Box({ done }: { done: boolean }) {
  return (
    <View aria-hidden className={cn('h-[26px] w-[26px] flex-none items-center justify-center rounded-[8px]', done ? 'bg-olive' : 'border-2 border-line-dashed')}>
      {done ? <Icon name="check" size={16} color="onOlive" /> : null}
    </View>
  );
}

/**
 * ChecklistRow README: a checklist item with its box. Tickable (a full-width checkbox, spec 042),
 * or listed with a remove button in the add sheet (OC-CalAddMore).
 */
export function ChecklistRow({ label, done, onToggle, disabled, remove, last = false }: ChecklistRowProps) {
  const row = cn('min-h-[52px] w-full flex-row items-center gap-12', !last && 'border-b-[1.5px] border-line');
  const text = (
    <Text size={16} weight="700" color={done ? 'ink-muted' : 'ink'} strike={done} className="min-w-0 flex-1">
      {label}
    </Text>
  );
  if (onToggle) {
    return (
      <Pressable
        role="checkbox"
        aria-checked={done}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        onPress={onToggle}
        className={cn(row, !disabled && 'active:bg-surface-card-pressed', focusRing)}
      >
        <Box done={done} />
        {text}
      </Pressable>
    );
  }
  return (
    <View className={row}>
      <Box done={done} />
      {text}
      {remove ? <IconButton variant="card" icon="close" iconSize={18} label={remove.label} onPress={remove.onPress} /> : null}
    </View>
  );
}

/** ChecklistRow README: "+ Add to checklist" under the add sheet's rows (olive-deep 16/800, 48 tall). */
export function ChecklistAdd({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable role="button" onPress={onPress} className={cn('min-h-[48px] w-full flex-row items-center active:bg-surface-card-pressed', focusRing)}>
      <Text size={16} weight="800" color="olive-deep">
        {label}
      </Text>
    </Pressable>
  );
}
