import { useMemo, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, Pressable, View, type AccessibilityActionEvent } from 'react-native';
import { cn, focusRing } from '../cn';
import { Avatar, type AvatarTone } from './Avatar';
import { Icon, type IconName } from './Icon';
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

/**
 * A white list group, optionally under an overline (6 gap) with a 12/700 note on its right ("All
 * ticked to start"). `inset` (4 16) holds SettingRows.
 */
export function ListGroup({ title, note, inset, children, className }: { title?: string; note?: string; inset?: boolean; children: ReactNode; className?: string }) {
  return (
    <View className={cn('gap-6', className)}>
      {title && note ? (
        <View className="flex-row items-baseline justify-between gap-12">
          <Overline className="shrink">{title}</Overline>
          <Text size={12} weight="700" color="ink-muted">
            {note}
          </Text>
        </View>
      ) : title ? (
        <Overline>{title}</Overline>
      ) : null}
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
  | { kind: 'value'; text: string }
  | { kind: 'status'; text: string }
  /** With an optional 13/700 status before it: "1 recipe ›" (OC-Settings › More). */
  | { kind: 'chevron'; text?: string }
  | { kind: 'node'; node: ReactNode };

export interface ListRowProps {
  title: string;
  /**
   * After the title on the same line (grocery rows, spec 021): "Heavy cream: 1 pint carton
   * (need 300 ml)". `text` is 16/800 like the title, `note` 15/600 ink-muted.
   */
  titleDetail?: { text: string; note?: string };
  sub?: string;
  /** Merge notes ("Already on the list (100 ml) → will be 400 ml") in warn 700. */
  subTone?: 'muted' | 'warn';
  /** Ticked grocery: struck through in ink-faint. */
  done?: boolean;
  /** Left out (an unticked row in Add to groceries): the title in ink-muted, still readable. */
  dim?: boolean;
  leading?: ListRowLeading;
  trailing?: ListRowTrailing;
  onPress?: () => void;
  /** Overrides the row's spoken name (defaults to title and sub). */
  accessibilityLabel?: string;
  last?: boolean;
  /** Inside a card's padding: no side padding, 52 tall (OC-Recipe's "…" panel). */
  flush?: boolean;
  /** The row's menu (grocery rows: Edit, Move to…, Remove): long-press, right-click or the keyboard's menu key. */
  onLongPress?: () => void;
  /** A drag to the left past 48 px; grocery rows open the same menu. */
  onSwipeLeft?: () => void;
  /** The menu's choices as screen-reader actions, so they don't need a long-press. */
  actions?: { name: string; label: string; onAction: () => void }[];
  /** Shown as it is but can't be pressed (offline: a grocery row keeps its tick, read-only). */
  disabled?: boolean;
  /**
   * A 44 × 44 icon button at the end of the row, centred, beside the row rather than inside it
   * (grocery rows: the vertical "…" that opens Edit). `accessibilityLabel` names what it acts on:
   * "Edit Heavy cream".
   */
  action?: { icon: IconName; accessibilityLabel: string; onPress: () => void; disabled?: boolean };
}

const SWIPE = 48;

/** Follows a horizontal drag to the left (springs back on release) and calls `onSwipeLeft` past 48 px. */
function useSwipeLeft(onSwipeLeft: (() => void) | undefined) {
  const [x] = useState(() => new Animated.Value(0));
  const responder = useMemo(() => {
    const back = () => Animated.spring(x, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start();
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => onSwipeLeft !== undefined && g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderMove: (_, g) => x.setValue(Math.max(-80, Math.min(0, g.dx))),
      onPanResponderRelease: (_, g) => {
        back();
        if (g.dx < -SWIPE) onSwipeLeft?.();
      },
      onPanResponderTerminate: back,
    });
  }, [x, onSwipeLeft]);
  return { x, handlers: responder.panHandlers };
}

/** A row inside a ListGroup (ListRow README). Min 60 tall; the whole row is the tap target. */
export function ListRow({
  title,
  titleDetail,
  sub,
  subTone = 'muted',
  done,
  dim,
  leading,
  trailing,
  onPress,
  accessibilityLabel,
  last,
  flush,
  onLongPress,
  onSwipeLeft,
  actions,
  disabled,
  action,
}: ListRowProps) {
  const swipe = useSwipeLeft(onSwipeLeft);
  const isCheck = leading?.kind === 'checkbox' || leading?.kind === 'radio';
  const content = (
    <>
      {leading?.kind === 'avatar' ? <Avatar initial={leading.initial} tone={leading.tone} size="lg" /> : null}
      {isCheck ? <Mark kind={leading.kind} checked={leading.checked} /> : null}
      <View className="min-w-0 flex-1">
        <Text size={16} weight="800" color={done ? 'ink-faint' : dim ? 'ink-muted' : 'ink'} strike={done}>
          {title}
          {titleDetail ? `: ${titleDetail.text}` : null}
          {titleDetail?.note ? (
            <Text size={15} weight="600" color={done ? 'ink-faint' : 'ink-muted'} strike={done}>
              {` ${titleDetail.note}`}
            </Text>
          ) : null}
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
  const divider = !last && 'border-b-[1.5px] border-line';
  // With an action, the divider goes on the wrapper so it runs under the button too.
  const box = cn('flex-row items-center gap-12 py-10', flush ? 'min-h-[52px]' : 'min-h-[60px] px-14', action ? 'flex-1' : divider);
  if (!onPress) {
    return (
      <View role="listitem" className={box}>
        {content}
      </View>
    );
  }
  const pressable = (
    <Pressable
      role={isCheck ? leading.kind : trailing?.kind === 'chevron' ? 'link' : 'button'}
      aria-checked={isCheck ? leading.checked : undefined}
      aria-label={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      accessibilityActions={actions?.map((a) => ({ name: a.name, label: a.label }))}
      onAccessibilityAction={actions ? (e: AccessibilityActionEvent) => actions.find((a) => a.name === e.nativeEvent.actionName)?.onAction() : undefined}
      // Web: right-click, or the keyboard's menu key (Shift+F10) on the focused row.
      {...(Platform.OS === 'web' && onLongPress
        ? {
            onContextMenu: (e: { preventDefault: () => void }) => {
              e.preventDefault();
              onLongPress();
            },
          }
        : null)}
      className={cn(box, 'active:bg-surface-card-pressed', focusRing)}
    >
      {content}
    </Pressable>
  );
  const row = action ? (
    <View className={cn('flex-row items-center', divider)}>
      {pressable}
      <Pressable
        role="button"
        aria-label={action.accessibilityLabel}
        onPress={action.onPress}
        disabled={action.disabled}
        aria-disabled={action.disabled || undefined}
        className={cn('h-control-md w-control-md items-center justify-center rounded-full active:bg-surface-card-pressed', flush ? '' : 'mr-6', action.disabled && 'opacity-dimmed', focusRing)}
      >
        <Icon name={action.icon} size={22} color="inkMuted" />
      </Pressable>
    </View>
  ) : (
    pressable
  );
  if (!onSwipeLeft) return row;
  return (
    <Animated.View style={{ transform: [{ translateX: swipe.x }] }} {...swipe.handlers}>
      {row}
    </Animated.View>
  );
}

function Trailing({ trailing }: { trailing: ListRowTrailing }) {
  switch (trailing.kind) {
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
      return trailing.text ? (
        <View className="flex-row items-center gap-12">
          <Text size={13} weight="700" color="ink-muted">
            {trailing.text}
          </Text>
          <Icon name="chevron-right" size={18} color="inkMuted" />
        </View>
      ) : (
        <Icon name="chevron-right" size={18} color="inkMuted" />
      );
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
  /**
   * `compact` (the shared recipe page, OC-SharedView): the name on the left and "{amount} · {weight}"
   * in bold on the right, 16 px, padding 10 0.
   */
  layout?: 'column' | 'compact';
}

/** Ingredient line on the recipe page (bundle.css › oc-ingredient): no card, amount column 104. */
export function IngredientRow({ amount, name, sub, tag, last, layout = 'column' }: IngredientRowProps) {
  if (layout === 'compact') {
    return (
      <View role="listitem" className={cn('flex-row items-center gap-12 py-10', !last && 'border-b-[1.5px] border-line')}>
        <View className="min-w-0 flex-1 flex-row flex-wrap items-center gap-8">
          <Text size={16}>{name}</Text>
          {tag ? <Tag label={tag.label} tone={tag.tone} /> : null}
        </View>
        <Text size={16} weight="900" className="text-right">
          {sub ? `${amount} · ${sub}` : amount}
        </Text>
      </View>
    );
  }
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
