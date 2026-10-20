import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { Avatar, type AvatarTone } from './Avatar';
import { Icon } from './Icon';
import { Tag, type TagTone } from './Tag';
import { Text } from './Text';

/** Uppercase group label above a list (bundle.css › oc-overline). Write it in sentence case. */
export function Overline({ children, className }: { children: string; className?: string }) {
  return (
    <Text variant="overline" color="ink-muted" uppercase role="heading" className={className}>
      {children}
    </Text>
  );
}

/** A white list group, optionally under an overline (6 gap). `inset` (4 16) holds SettingRows. */
export function ListGroup({ title, inset, children, className }: { title?: string; inset?: boolean; children: ReactNode; className?: string }) {
  return (
    <View className={cn('gap-6', className)}>
      {title ? <Overline>{title}</Overline> : null}
      <View role={inset ? undefined : 'list'} className={cn('overflow-hidden rounded-xl bg-surface-card', inset && 'px-16 py-4')}>
        {children}
      </View>
    </View>
  );
}

/** 26 × 26 olive checkbox or radio (the row is the tap target). Also RadioCard's. */
export function Mark({ kind, checked }: { kind: 'checkbox' | 'radio'; checked: boolean }) {
  return (
    <View
      aria-hidden
      className={cn(
        'h-[26px] w-[26px] items-center justify-center border-2',
        kind === 'radio' ? 'rounded-full' : 'rounded-[7px]',
        checked ? 'border-olive bg-olive' : 'border-line-dashed bg-surface-card',
      )}
    >
      {checked ? kind === 'radio' ? <View className="h-[10px] w-[10px] rounded-full bg-on-olive" /> : <Icon name="check" size={18} color="onOlive" /> : null}
    </View>
  );
}

export type ListRowLeading =
  | { kind: 'checkbox' | 'radio'; checked: boolean }
  | { kind: 'avatar'; initial: string; tone: AvatarTone };

export type ListRowTrailing =
  | { kind: 'buy'; buy: string; need?: string }
  | { kind: 'value'; text: string }
  | { kind: 'status'; text: string }
  | { kind: 'chevron' }
  | { kind: 'node'; node: ReactNode };

export interface ListRowProps {
  title: string;
  sub?: string;
  /** Merge notes ("Already on the list (100 ml) → will be 400 ml") in warn 700. */
  subTone?: 'muted' | 'warn';
  /** Ticked grocery: struck through in ink-faint. */
  done?: boolean;
  leading?: ListRowLeading;
  trailing?: ListRowTrailing;
  onPress?: () => void;
  /** Overrides the row's spoken name (defaults to title and sub). */
  accessibilityLabel?: string;
  last?: boolean;
  /** Inside a card's padding: no side padding, 52 tall (OC-Recipe's "…" panel). */
  flush?: boolean;
}

/** A row inside a ListGroup (ListRow README). Min 60 tall; the whole row is the tap target. */
export function ListRow({ title, sub, subTone = 'muted', done, leading, trailing, onPress, accessibilityLabel, last, flush }: ListRowProps) {
  const isCheck = leading?.kind === 'checkbox' || leading?.kind === 'radio';
  const content = (
    <>
      {leading?.kind === 'avatar' ? <Avatar initial={leading.initial} tone={leading.tone} size="lg" /> : null}
      {isCheck ? <Mark kind={leading.kind} checked={leading.checked} /> : null}
      <View className="min-w-0 flex-1">
        <Text size={16} weight="800" color={done ? 'ink-faint' : 'ink'} strike={done}>
          {title}
        </Text>
        {sub ? (
          <Text variant="caption" weight={subTone === 'warn' ? '700' : '600'} color={subTone === 'warn' ? 'warn' : 'ink-muted'} className="mt-[1px]">
            {sub}
          </Text>
        ) : null}
      </View>
      {trailing ? <Trailing trailing={trailing} /> : null}
    </>
  );
  const box = cn('flex-row items-center gap-12 py-10', flush ? 'min-h-[52px]' : 'min-h-[60px] px-14', !last && 'border-b-[1.5px] border-line');
  if (!onPress) {
    return (
      <View role="listitem" className={box}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      role={isCheck ? leading.kind : trailing?.kind === 'chevron' ? 'link' : 'button'}
      aria-checked={isCheck ? leading.checked : undefined}
      aria-label={accessibilityLabel}
      onPress={onPress}
      className={cn(box, 'active:bg-surface-card-pressed', focusRing)}
    >
      {content}
    </Pressable>
  );
}

function Trailing({ trailing }: { trailing: ListRowTrailing }) {
  switch (trailing.kind) {
    case 'buy':
      return (
        <View className="max-w-[140px] items-end">
          <Text size={15} weight="900" align="right">
            {trailing.buy}
          </Text>
          {trailing.need ? (
            <Text size={12} weight="700" color="ink-muted" align="right">
              {trailing.need}
            </Text>
          ) : null}
        </View>
      );
    case 'value':
      return (
        <Text size={15} weight="800" color="ink-muted">
          {trailing.text}
        </Text>
      );
    case 'status':
      return (
        <Text size={13} weight="700" color="ink-muted">
          {trailing.text}
        </Text>
      );
    case 'chevron':
      return <Icon name="chevron-right" size={18} color="inkMuted" />;
    case 'node':
      return <>{trailing.node}</>;
  }
}

export interface IngredientRowProps {
  /** From @cocon/quantity: "300 ml". */
  amount: string;
  name: string;
  /** Weight of counted items: "about 300 g". */
  sub?: string;
  tag?: { label: string; tone: TagTone };
  last?: boolean;
}

/** Ingredient line on the recipe page (bundle.css › oc-ingredient): no card, amount column 104. */
export function IngredientRow({ amount, name, sub, tag, last }: IngredientRowProps) {
  return (
    <View role="listitem" className={cn('flex-row items-center gap-12 py-12', !last && 'border-b-[1.5px] border-line')}>
      <Text size={17} weight="900" className="w-[104px]">
        {amount}
      </Text>
      <View className="min-w-0 flex-1">
        <Text size={16} weight="700">
          {name}
        </Text>
        {sub ? (
          <Text variant="caption" color="ink-muted">
            {sub}
          </Text>
        ) : null}
      </View>
      {tag ? <Tag label={tag.label} tone={tag.tone} /> : null}
    </View>
  );
}
