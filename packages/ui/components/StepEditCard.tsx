import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Tag } from './Tag';
import { Text } from './Text';

export interface StepEditCardProps {
  number: number;
  /** The drag handle, from ReorderList; it sits first, as on IngredientEditCard. */
  handle?: ReactNode;
  /** The one step being edited: 2 px olive border, olive number, and its fields. */
  expanded: boolean;
  /** Collapsed: the step's name, or its text's first line. */
  title: string;
  /** Collapsed: "Tip", "12 min". */
  badges?: string[];
  /** Collapsed: the sage temperature check line, "Temperature check: center reaches 71 °C (160 °F)". */
  note?: string;
  /** Collapsed: what tapping it does, for screen readers ("Step 2, Blind bake. Tap to edit."). */
  openLabel: string;
  onOpen: () => void;
  /** 2 px warn-border: the step has a problem to fix before Save. */
  attention?: boolean;
  /** Expanded: what goes beside the number (the "Step name" input). */
  header?: ReactNode;
  /** Expanded: the step's fields, in order. */
  children?: ReactNode;
}

function NumberBadge({ number, current }: { number: number; current: boolean }) {
  return (
    <View aria-hidden className={cn('h-[30px] w-[30px] items-center justify-center rounded-full', current ? 'bg-olive' : 'bg-honey')}>
      <Text size={14} weight="900" color={current ? 'on-olive' : 'ink'}>
        {number}
      </Text>
    </View>
  );
}

/**
 * One step in the recipe form (StepEditCard README; OC-EditSteps): collapsed to its number, name
 * and badges, or expanded with its fields. Only one is expanded at a time; the screen decides.
 */
export function StepEditCard({ number, handle, expanded, title, badges = [], note, openLabel, onOpen, attention, header, children }: StepEditCardProps) {
  if (expanded) {
    return (
      <View className={cn('gap-12 rounded-xl border-2 bg-surface-card p-14', attention ? 'border-warn-border' : 'border-olive')}>
        <View className="flex-row items-center gap-10">
          {handle}
          <NumberBadge number={number} current />
          <View className="min-w-0 flex-1">{header}</View>
        </View>
        {children}
      </View>
    );
  }
  return (
    <View className={cn('flex-row items-center gap-10 rounded-[18px] bg-surface-card py-12 pl-8 pr-14', attention && 'border-2 border-warn-border')}>
      {handle}
      <Pressable role="button" aria-expanded={false} aria-label={openLabel} onPress={onOpen} className={cn('min-h-[44px] flex-1 justify-center gap-8 rounded-md active:opacity-90', focusRing)}>
        <View className="flex-row items-center gap-10">
          <NumberBadge number={number} current={false} />
          <Text size={16} weight="800" numberOfLines={1} className="flex-1">
            {title}
          </Text>
          {badges.map((b) => (
            <Tag key={b} label={b} tone="soft" />
          ))}
        </View>
        {note ? <StepNote text={note} className="ml-[40px]" /> : null}
      </Pressable>
    </View>
  );
}

/** The sage temperature check line, under a collapsed step or in the open one (OC-EditSteps, step 5). */
export function StepNote({ text, className }: { text: string; className?: string }) {
  return (
    <View className={cn('rounded-[12px] bg-sage px-10 py-8', className)}>
      <Text size={14} weight="700">
        {text}
      </Text>
    </View>
  );
}

/** The open step's "Preview" box: the text as the recipe page will show it (OC-EditSteps). */
export function StepPreview({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="gap-2 rounded-[14px] bg-surface-page px-12 py-10">
      <Text variant="overline" color="ink-muted" uppercase role="heading">
        {label}
      </Text>
      {children}
    </View>
  );
}

/** Two fields side by side, the second wider (OC-EditSteps › Timer and Timer label: 1fr 1.6fr). */
export function FieldPair({ first, second }: { first: ReactNode; second: ReactNode }) {
  return (
    <View className="flex-row items-start gap-8">
      <View style={{ flex: 1 }}>{first}</View>
      <View style={{ flex: 1.6 }}>{second}</View>
    </View>
  );
}
