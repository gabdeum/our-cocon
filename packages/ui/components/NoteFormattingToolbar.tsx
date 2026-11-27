import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type NoteToolbarFormat = 'bold' | 'link' | 'bullet' | 'number' | 'check';

export interface NoteFormattingToolbarProps {
  /** Which buttons show as on: the caret is in bold text or on a line of that list (spec 074 FR-007). */
  active: Partial<Record<NoteToolbarFormat, boolean>>;
  onPress: (format: NoteToolbarFormat) => void;
  /** The iPhone's Hide keyboard, on the right; left out on the web. */
  onHideKeyboard?: () => void;
  /** Screen-reader names: the toolbar ("Formatting"), each button, and Hide keyboard. */
  labels: Record<NoteToolbarFormat | 'toolbar' | 'hideKeyboard', string>;
}

const icons: Record<Exclude<NoteToolbarFormat, 'bold'>, IconName> = { link: 'link', bullet: 'list-bullet', number: 'list-number', check: 'checklist' };

function ToolButton({ label, on, onPress, children }: { label: string; on?: boolean; onPress: () => void; children: (color: 'ink' | 'onOlive') => React.ReactNode }) {
  return (
    <Pressable
      role="button"
      aria-label={label}
      aria-pressed={on ?? false}
      onPress={onPress}
      className={cn('h-control-md w-[48px] items-center justify-center rounded-[12px]', on ? 'bg-olive active:bg-olive-pressed' : 'active:bg-surface-soft-pressed', focusRing)}
    >
      {children(on ? 'onOlive' : 'ink')}
    </Pressable>
  );
}

/**
 * The notes field's formatting bar (NoteFormattingToolbar README; OC-NoteEditor, spec 074): Bold,
 * Link | Bulleted, Numbered, Checklist, and Hide keyboard on the right on the iPhone. 52 tall, on
 * `surface-soft` under a 1.5 `line-strong` line; a format that's on shows olive.
 */
export function NoteFormattingToolbar({ active, onPress, onHideKeyboard, labels }: NoteFormattingToolbarProps) {
  const button = (f: Exclude<NoteToolbarFormat, 'bold'>) => (
    <ToolButton key={f} label={labels[f]} on={active[f]} onPress={() => onPress(f)}>
      {(color) => <Icon name={icons[f]} size={22} color={color} />}
    </ToolButton>
  );
  return (
    <View role="toolbar" aria-label={labels.toolbar} className="h-[52px] flex-row items-center gap-[2px] border-t-[1.5px] border-line-strong bg-surface-soft px-6">
      <ToolButton label={labels.bold} on={active.bold} onPress={() => onPress('bold')}>
        {(color) => (
          <Text size={19} weight="900" color={color === 'onOlive' ? 'on-olive' : 'ink'} aria-hidden>
            B
          </Text>
        )}
      </ToolButton>
      {button('link')}
      <View aria-hidden className="mx-4 h-[24px] w-[1.5px] bg-line-handle" />
      {button('bullet')}
      {button('number')}
      {button('check')}
      {onHideKeyboard ? (
        <Pressable
          role="button"
          aria-label={labels.hideKeyboard}
          onPress={onHideKeyboard}
          className={cn('ml-auto h-control-md w-[48px] items-center justify-center rounded-[12px] active:bg-surface-soft-pressed', focusRing)}
        >
          <Icon name="keyboard-hide" size={22} color="inkMuted" />
        </Pressable>
      ) : null}
    </View>
  );
}
