import type { ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Icon } from './Icon';
import { Tag } from './Tag';
import { Photo } from './Card';
import { Text } from './Text';
import { theme } from '../theme';

/**
 * Step text split into plain text, amounts from @cocon/quantity ("20 g butter"), and names of
 * ingredients that are gone (`missing`: plain weight, muted, no highlight).
 */
export type StepTextPart = string | { amount: string } | { missing: string };

/** A piece of a word: an amount's first and last pieces carry its rounded ends. */
export interface StepRun {
  text: string;
  kind: 'plain' | 'amount' | 'missing';
  first?: boolean;
  last?: boolean;
}

/**
 * The step text as words (split at spaces, each keeping its following space), for the iPhone's
 * word-by-word layout. A space inside an amount stays highlighted; runs of spaces become one.
 */
export function stepWords(parts: StepTextPart[]): StepRun[][] {
  const words: StepRun[][] = [];
  let word: StepRun[] = [];
  for (const p of parts) {
    const kind = typeof p === 'string' ? 'plain' : 'missing' in p ? 'missing' : 'amount';
    const text = typeof p === 'string' ? p : 'missing' in p ? p.missing : p.amount;
    const tokens = text.split(/(\s+)/).filter((t) => t !== '');
    const firstWord = tokens.findIndex((t) => t.trim() !== '');
    const lastWord = tokens.findLastIndex((t) => t.trim() !== '');
    tokens.forEach((t, i) => {
      if (t.trim() !== '') {
        word.push(kind === 'amount' ? { text: t, kind, first: i === firstWord, last: i === lastWord } : { text: t, kind });
        return;
      }
      if (word.length === 0) return;
      word.push({ text: ' ', kind: kind === 'amount' && i > firstWord && i < lastWord ? 'amount' : 'plain' });
      words.push(word);
      word = [];
    });
  }
  if (word.length > 0) words.push(word);
  return words;
}

// Nunito's glyphs are 1.364 em tall: a highlight covers that (plus `pad`), as an inline one does on the web.
const GLYPH_HEIGHT = 1.364;

/**
 * The iPhone can't round or pad a highlight inside text, and fills a wrapped one to the line's end,
 * so there the words are laid out one by one and each amount piece is its own rounded box.
 */
function NativeStepText({ parts, cook }: { parts: StepTextPart[]; cook?: boolean }) {
  const variant = cook ? 'bodyCook' : 'bodyLg';
  const { fontSize, lineHeight } = theme.text[variant];
  const pad = cook ? 0 : 1;
  const inset = (lineHeight - fontSize * GLYPH_HEIGHT) / 2 - pad;
  const label = parts.map((p) => (typeof p === 'string' ? p : 'missing' in p ? p.missing : p.amount)).join('');
  return (
    <View accessible accessibilityRole="text" aria-label={label} className="flex-row flex-wrap">
      {stepWords(parts).map((word, i) => (
        <View key={i} className="flex-row">
          {word.map((r, j) =>
            r.kind === 'amount' ? (
              <View
                key={j}
                className={cn(cook ? 'bg-honey' : 'bg-surface-soft', r.first && 'rounded-l-xs pl-4', r.last && 'rounded-r-xs pr-4')}
                style={{ marginVertical: inset, paddingVertical: pad }}
              >
                <Text variant={variant} weight="900" style={{ lineHeight: lineHeight - 2 * (inset + pad) }}>
                  {r.text}
                </Text>
              </View>
            ) : (
              <Text key={j} variant={variant} color={r.kind === 'missing' ? 'ink-muted' : 'ink'}>
                {r.text}
              </Text>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

/**
 * Step text with highlighted amounts (bundle.css › oc-amount). `cook`: honey highlight, 21 px text.
 * `compact`: the recipe form's Preview (OC-EditSteps), 14/600 with bold amounts and no highlight.
 */
export function StepText({ parts, cook, compact }: { parts: StepTextPart[]; cook?: boolean; compact?: boolean }) {
  if (compact) {
    const t = { size: 14, lineHeight: 21 } as const;
    return (
      <Text size={t.size} weight="600" style={{ lineHeight: t.lineHeight }}>
        {parts.map((p, i) =>
          typeof p === 'string' ? (
            p
          ) : 'missing' in p ? (
            <Text key={i} size={t.size} weight="600" color="ink-muted">
              {p.missing}
            </Text>
          ) : (
            <Text key={i} size={t.size} weight="900">
              {p.amount}
            </Text>
          ),
        )}
      </Text>
    );
  }
  if (Platform.OS !== 'web') return <NativeStepText parts={parts} cook={cook} />;
  return (
    <Text variant={cook ? 'bodyCook' : 'bodyLg'}>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          p
        ) : 'missing' in p ? (
          <Text key={i} variant={cook ? 'bodyCook' : 'bodyLg'} color="ink-muted">
            {p.missing}
          </Text>
        ) : (
          <Text
            key={i}
            variant={cook ? 'bodyCook' : 'bodyLg'}
            weight="900"
            className={cn('rounded-xs', cook ? 'bg-honey px-4' : 'bg-surface-soft px-4 py-[1px]')}
          >
            {p.amount}
          </Text>
        ),
      )}
    </Text>
  );
}

export type TimerState = 'idle' | 'running' | 'paused' | 'done';

export interface TimerRowProps {
  /** Only `running` changes the look (olive, white text); idle, paused and done stay honey and differ by label. */
  state: TimerState;
  /** "Start timer", "Pause", "Resume", "Done!". */
  label: string;
  /** "12:00". */
  clock: string;
  onPress: () => void;
  minusLabel: string;
  plusLabel: string;
  /** Screen-reader names: "One minute less" / "One minute more". */
  minusA11y: string;
  plusA11y: string;
  onMinus: () => void;
  onPlus: () => void;
  /**
   * Said politely by screen readers. The clock itself is never live (it would talk every second):
   * set this only at 1 minute left and at zero (OC-RecipeSteps › Accessibility labels).
   */
  announcement?: string;
}

/** Read by screen readers, not drawn. */
export const srOnly = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 } as const;

/** Timer row inside a step (StepCard README): honey button (olive while running) and −1 / +1. */
export function TimerRow({ state, label, clock, onPress, minusLabel, plusLabel, minusA11y, plusA11y, onMinus, onPlus, announcement }: TimerRowProps) {
  const running = state === 'running';
  return (
    <View className="flex-row gap-6">
      <Pressable
        role="button"
        aria-pressed={running}
        onPress={onPress}
        className={cn('min-h-[52px] min-w-0 flex-1 flex-row items-center gap-10 rounded-lg px-14', running ? 'bg-olive' : 'bg-honey active:bg-honey-pressed', focusRing)}
      >
        <Icon name="timer" color={running ? 'onOlive' : 'ink'} />
        <Text size={15} weight="800" color={running ? 'on-olive' : 'ink'} className="flex-1">
          {label}
        </Text>
        <Text size={17} weight="800" color={running ? 'on-olive' : 'ink'} tabular aria-live="off">
          {clock}
        </Text>
      </Pressable>
      <View aria-live="polite" style={srOnly}>
        <Text>{announcement ?? ''}</Text>
      </View>
      {[
        { text: minusLabel, a11y: minusA11y, onPress: onMinus },
        { text: plusLabel, a11y: plusA11y, onPress: onPlus },
      ].map((b) => (
        <Pressable
          key={b.text}
          role="button"
          aria-label={b.a11y}
          onPress={b.onPress}
          className={cn('w-[52px] items-center justify-center rounded-lg bg-surface-soft active:bg-surface-soft-pressed', focusRing)}
        >
          <Text size={15} weight="900">
            {b.text}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export interface StepCardProps {
  number: number;
  /** Optional: a step can be just its text. */
  name?: string;
  /** "Variant" when a variant added the step. */
  variantTag?: string;
  parts: StepTextPart[];
  /** The step's photo, full width at radius 16 above the text (spec 009 FR-004), and its label. */
  photo?: { uri: string; label: string };
  /** In order: temperature Callout, TimerRow, tip Callout (StepCard README › Order inside). */
  children?: ReactNode;
}

/** One recipe step on the recipe page (StepCard README). */
export function StepCard({ number, name, variantTag, parts, photo, children }: StepCardProps) {
  return (
    <View className="gap-12 rounded-xl bg-surface-card p-16">
      <View className="flex-row items-center gap-10">
        <View aria-hidden className="h-[32px] w-[32px] items-center justify-center rounded-full bg-honey">
          <Text size={15} weight="900">
            {number}
          </Text>
        </View>
        {name ? (
          <Text variant="titleSm" role="heading" aria-level={3} className="flex-1">
            {name}
          </Text>
        ) : (
          <View className="flex-1" />
        )}
        {variantTag ? <Tag label={variantTag} tone="sage" /> : null}
      </View>
      {photo ? (
        <View className="w-full overflow-hidden rounded-lg" style={{ aspectRatio: 13 / 8 }}>
          <Photo uri={photo.uri} label={photo.label} />
        </View>
      ) : null}
      {parts.length > 0 ? <StepText parts={parts} /> : null}
      {children}
    </View>
  );
}

export interface StepRowProps {
  number: number;
  /** The step's name, or its text when it has none (one line, cut short). */
  title: string;
  /** The step timer's length ("35:00"), in a honey chip on the right. */
  clock?: string;
  /** "Open step 3 in cooking mode". */
  accessibilityLabel: string;
  onPress: () => void;
}

/** One step in the recipe page's step list (StepCard README › StepRow): a quick look that opens the step in cooking mode. */
export function StepRow({ number, title, clock, accessibilityLabel, onPress }: StepRowProps) {
  return (
    <Pressable
      role="link"
      aria-label={accessibilityLabel}
      onPress={onPress}
      className={cn('min-h-[60px] flex-row items-center gap-10 rounded-lg bg-surface-card py-10 pl-14 pr-10 active:bg-surface-card-pressed', focusRing)}
    >
      <View aria-hidden className="h-[32px] w-[32px] items-center justify-center rounded-full bg-honey">
        <Text size={15} weight="900">
          {number}
        </Text>
      </View>
      <Text size={16} weight="800" numberOfLines={1} className="min-w-0 flex-1">
        {title}
      </Text>
      {clock ? (
        <View className="flex-row items-center gap-4 rounded-pill bg-honey px-10 py-4">
          <Icon name="timer" size={16} />
          <Text size={14} weight="800" tabular>
            {clock}
          </Text>
        </View>
      ) : null}
      <Icon name="chevron-right" color="inkMuted" />
    </Pressable>
  );
}

/** Under the step list: "−1 / +1 changes a timer by a minute, even while it runs." (StepCard README). */
export function StepFootnote({ text }: { text: string }) {
  return (
    <Text variant="caption" color="ink-muted" align="center">
      {text}
    </Text>
  );
}
