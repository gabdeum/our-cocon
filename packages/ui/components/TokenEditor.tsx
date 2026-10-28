import { useId, useState, type Ref } from 'react';
import { TextInput, View, type TextInputInstance, type TextInputSelectionChangeEvent } from 'react-native';
import { cn } from '../cn';
import { theme } from '../theme';
import { useThemeColors } from '../ThemeProvider';
import { Icon } from './Icon';
import { Text } from './Text';

/** Plain text, or a chip: sage for an ingredient or a temperature, warn for a missing ingredient. */
export type TokenPart = string | { chip: string; tone: 'sage' | 'warn' };

export interface TokenEditorProps {
  /** "Instructions" */
  label: string;
  /** The text with each chip in place: the text field holds exactly this. */
  parts: TokenPart[];
  /** The parts joined: what the field holds. */
  value: string;
  onChangeText: (text: string) => void;
  /** Set it to move the caret (after a chip was inserted or removed); leave it unset otherwise. */
  selection?: { start: number; end: number };
  onSelectionChange?: (selection: { start: number; end: number }) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  hint?: string;
  /** Warns, never blocks typing: "Add instructions or remove this step". */
  warning?: string;
  maxLength?: number;
  inputRef?: Ref<TextInputInstance>;
}

// One set of metrics for the field and the chips drawn under it, so the caret lands on the letters.
const text = { fontFamily: theme.font[600], fontSize: 16, lineHeight: 28 } as const;

/**
 * A step's text with ingredient chips (TokenEditor README; OC-EditSteps). The chips are drawn
 * under a see-through text field holding the same text, so they sit in the line on web and iOS;
 * the screen keeps them whole (a chip is never partly edited, spec 016 FR-001).
 */
export function TokenEditor({ label, parts, value, onChangeText, selection, onSelectionChange, onFocus, onBlur, hint, warning, maxLength, inputRef }: TokenEditorProps) {
  const colors = useThemeColors();
  const [focused, setFocused] = useState(false);
  const hintId = useId();
  const warnId = useId();
  return (
    <View className="gap-6">
      <Text size={14} weight="900">
        {label}
      </Text>
      <View
        className={cn(
          'relative min-h-[76px] rounded-[14px] border-2 p-12',
          warning ? 'border-warn-border bg-warn-soft' : cn('bg-surface-card', focused ? 'border-olive' : 'border-line-strong'),
        )}
      >
        <Text aria-hidden style={text} color="ink">
          {parts.map((p, i) =>
            typeof p === 'string' ? (
              p
            ) : (
              <Text key={i} style={text} color={p.tone === 'warn' ? 'warn' : 'ink'} className={cn('rounded-xs', p.tone === 'warn' ? 'bg-warn-soft' : 'bg-sage')}>
                {p.chip}
              </Text>
            ),
          )}
          {/* Keeps a last empty line's height. */}
          {'​'}
        </Text>
        <TextInput
          ref={inputRef}
          aria-label={label}
          aria-describedby={[warning ? warnId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined}
          aria-invalid={warning ? true : undefined}
          multiline
          scrollEnabled={false}
          value={value}
          maxLength={maxLength}
          onChangeText={onChangeText}
          selection={selection}
          onSelectionChange={(e: TextInputSelectionChangeEvent) => onSelectionChange?.(e.nativeEvent.selection)}
          onFocus={() => {
            setFocused(true);
            onFocus?.();
          }}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          selectionColor={colors.olive}
          className="absolute inset-[12px] p-0 web:outline-none"
          // The letters are the ones drawn underneath; only the caret and selection show here.
          style={[text, { color: 'transparent', caretColor: colors.ink, textAlignVertical: 'top' } as object]}
        />
      </View>
      {warning ? (
        <View nativeID={warnId} className="flex-row items-center gap-8">
          <Icon name="warning" size={18} color="warn" />
          <Text size={14} weight="700" color="warn" className="flex-1">
            {warning}
          </Text>
        </View>
      ) : null}
      {hint ? (
        <Text size={13} weight="600" color="ink-muted" nativeID={hintId}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
