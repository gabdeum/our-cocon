import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Icon } from './Icon';
import { Tag } from './Tag';
import { Text } from './Text';

/**
 * Step text split into plain text, amounts from @cocon/quantity ("20 g butter"), and names of
 * ingredients that are gone (`missing`: plain weight, muted, no highlight).
 */
export type StepTextPart = string | { amount: string } | { missing: string };

/** Step text with highlighted amounts (bundle.css › oc-amount). `cook`: honey highlight, 21 px text. */
export function StepText({ parts, cook }: { parts: StepTextPart[]; cook?: boolean }) {
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
const srOnly = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 } as const;

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
  /** In order: temperature Callout, TimerRow, tip Callout (StepCard README › Order inside). */
  children?: ReactNode;
}

/** One recipe step on the recipe page (StepCard README). */
export function StepCard({ number, name, variantTag, parts, children }: StepCardProps) {
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
      {parts.length > 0 ? <StepText parts={parts} /> : null}
      {children}
    </View>
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
