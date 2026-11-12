import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Animated, PanResponder, Platform, Pressable, View, type AccessibilityActionEvent } from 'react-native';
import { useReduceMotion } from '../reduceMotion';
import { cn, focusRing } from '../cn';
import { Avatar, type AvatarColor } from './Avatar';
import { Icon, type IconName } from './Icon';
import { IconTile, type IconTileTone } from './IconTile';
import { Tag, type TagTone } from './Tag';
import { Link } from './Button';
import { DetailText, Text } from './Text';

/** Uppercase group label above a list (bundle.css › oc-overline). Write it in sentence case. */
export function Overline({ children, className }: { children: string; className?: string }) {
  return (
    <Text variant="overline" color="ink-muted" uppercase role="heading" className={className}>
      {children}
    </Text>
  );
}

/** A ListGroup's rows are its list's items (spec 030: a list holds only list items). */
const InList = createContext(false);

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
        <InList.Provider value={!inset}>{children}</InList.Provider>
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
  | { kind: 'avatar'; initial: string; color: AvatarColor }
  /** An assistant's letters in a 40 px square (Settings › AI assistants, spec 025). */
  | { kind: 'tile'; letters: string; tone: IconTileTone }
  /** A 36 px `surface-soft` tile with a 20 px ink icon (the Menu's settings rows, spec 029). */
  | { kind: 'icon'; icon: IconName };

export type ListRowTrailing =
  /** `olive`: a setting that's on, in olive-deep ("Allowed", OC-Connect). */
  | { kind: 'value'; text: string; tone?: 'olive' }
  | { kind: 'status'; text: string }
  /** With an optional 13/700 status before it: "1 recipe ›" (OC-Settings › More). */
  | { kind: 'chevron'; text?: string; tone?: 'olive' }
  | { kind: 'node'; node: ReactNode };

export interface ListRowProps {
  title: string;
  /**
   * After the title on the same line (grocery rows, spec 021): "Heavy cream: 1 pint carton
   * (need 300 ml)". `text` is 16/800 like the title, `note` 15/600 ink-muted.
   */
  titleDetail?: { text: string; note?: string };
  /** Spec 051 FR-010: how the recipe prepares it ("In recipe: grated"), a quiet line above `sub`. */
  detail?: string;
  sub?: string;
  /**
   * Merge notes ("Already on the list (100 ml) → will be 400 ml") in warn 700; `olive`: a good
   * status in olive-deep 700 ("Connected · used 2 h ago"); `soft`: a grocery row's source line
   * (spec 051 FR-009), as `DetailText`.
   */
  subTone?: 'muted' | 'warn' | 'olive' | 'soft';
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
  const reduceMotion = useReduceMotion();
  const responder = useMemo(() => {
    const back = () => (reduceMotion ? x.setValue(0) : Animated.spring(x, { toValue: 0, useNativeDriver: Platform.OS !== 'web' }).start());
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => onSwipeLeft !== undefined && g.dx < -12 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
      onPanResponderMove: (_, g) => x.setValue(Math.max(-80, Math.min(0, g.dx))),
      onPanResponderRelease: (_, g) => {
        back();
        if (g.dx < -SWIPE) onSwipeLeft?.();
      },
      onPanResponderTerminate: back,
    });
  }, [x, onSwipeLeft, reduceMotion]);
  return { x, handlers: responder.panHandlers };
}

/** A row inside a ListGroup (ListRow README). Min 60 tall; the whole row is the tap target. */
export function ListRow({
  title,
  titleDetail,
  detail,
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
  const inList = useContext(InList);
  const isCheck = leading?.kind === 'checkbox' || leading?.kind === 'radio';
  // A control at the end of a pressable row (a Restore link) sits beside it, not inside: a button
  // can't hold another (spec 030, axe "nested-interactive").
  // A row with an `action` button keeps its trailing node inside (no caller has both).
  const beside = onPress && !action && trailing?.kind === 'node' ? trailing.node : null;
  const content = (
    <>
      {leading?.kind === 'avatar' ? <Avatar initial={leading.initial} color={leading.color} size="lg" /> : null}
      {leading?.kind === 'tile' ? <IconTile letters={leading.letters} tone={leading.tone} /> : null}
      {leading?.kind === 'icon' ? <IconTile icon={leading.icon} tone="soft" size="sm" /> : null}
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
        {detail ? <DetailText className="mt-[1px]">{detail}</DetailText> : null}
        {sub && subTone === 'soft' ? <DetailText className="mt-[1px]">{sub}</DetailText> : null}
        {sub && subTone !== 'soft' ? (
          <Text variant="caption" weight={subTone === 'muted' ? '600' : '700'} color={subTone === 'warn' ? 'warn' : subTone === 'olive' ? 'olive-deep' : 'ink-muted'} className="mt-[1px]">
            {sub}
          </Text>
        ) : null}
      </View>
      {trailing && !beside ? <Trailing trailing={trailing} /> : null}
    </>
  );
  const divider = !last && 'border-b-[1.5px] border-line';
  // With an action, the divider goes on the wrapper so it runs under the button too.
  const box = cn('flex-row items-center gap-12 py-10', flush ? 'min-h-[52px]' : leading?.kind === 'icon' ? 'min-h-[64px] px-14' : 'min-h-[60px] px-14', action || beside ? 'flex-1' : divider);
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
        // It opens the row's sheet: the way in for web screen readers, which can't use the row's actions (L49).
        aria-haspopup="dialog"
        onPress={action.onPress}
        disabled={action.disabled}
        aria-disabled={action.disabled || undefined}
        className={cn('h-control-md w-control-md items-center justify-center rounded-full active:bg-surface-card-pressed', flush ? '' : 'mr-6', action.disabled && 'opacity-dimmed', focusRing)}
      >
        <Icon name={action.icon} size={22} color="inkMuted" />
      </Pressable>
    </View>
  ) : beside ? (
    // The row's padding and gap continue round the control, as if it were inside.
    <View className={cn('flex-row items-center', !flush && 'pr-14', divider)}>
      {pressable}
      {beside}
    </View>
  ) : (
    pressable
  );
  const moving = onSwipeLeft ? (
    <Animated.View style={{ transform: [{ translateX: swipe.x }] }} {...swipe.handlers}>
      {row}
    </Animated.View>
  ) : (
    row
  );
  return inList ? <View role="listitem">{moving}</View> : moving;
}

function Trailing({ trailing }: { trailing: ListRowTrailing }) {
  switch (trailing.kind) {
    case 'value':
      return (
        <Text size={15} weight="800" color={trailing.tone === 'olive' ? 'olive-deep' : 'ink-muted'}>
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
          <Text size={13} weight="700" color={trailing.tone === 'olive' ? 'olive-deep' : 'ink-muted'}>
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

export interface IconRowProps {
  /** Olive, 22: clock, repeat, pin, car, bell on the event page. */
  icon?: IconName;
  /** In the icon's place: the member dots on the compact event page (spec 050). */
  leading?: ReactNode;
  /** 16/800: "Saturday, Oct 31"; 15/800 when compact. */
  title: string;
  /** 14/700 muted: "Morning · about 09:00–12:00"; compact: on the title's line after " · ". */
  sub?: string;
  /** Links at the end ("Copy", "Open in Maps"), 16 apart; compact: soft 36 pills ("Copy", "Maps"), 8 apart. */
  actions?: { label: string; accessibilityLabel?: string; onPress: () => void }[];
  /** Olive, 22, at the end: the car on the who row (spec 050). */
  trailingIcon?: IconName;
  /** Spec 050 FR-006: 52 tall, one line. */
  compact?: boolean;
  last?: boolean;
}

/**
 * ListRow README › Icon row (spec 042, OC-CalEvent): a fact with an olive icon, inside a white
 * `ListGroup inset` card. Min 56 tall, 60 with a sub-line or links. Not pressable; its links are.
 * Compact (spec 050 FR-006): 52 tall, the sub-line on the title's line, the links soft pills.
 */
export function IconRow({ icon, leading, title, sub, actions = [], trailingIcon, compact, last }: IconRowProps) {
  const start = leading ?? (icon ? <Icon name={icon} size={22} color="olive" /> : null);
  const end = trailingIcon ? <Icon name={trailingIcon} size={22} color="olive" /> : null;
  if (compact) {
    return (
      <View className={cn('min-h-[52px] flex-row items-center gap-12 py-6', !last && 'border-b-[1.5px] border-line')}>
        {start}
        <Text size={15} weight="800" numberOfLines={actions.length ? 1 : undefined} className="min-w-0 flex-1">
          {title}
          {sub ? (
            <Text size={15} weight="700" color="ink-muted">
              {` · ${sub}`}
            </Text>
          ) : null}
        </Text>
        {actions.length ? (
          <View className="flex-none flex-row gap-8">
            {actions.map((action) => (
              <Pressable
                key={action.label}
                role="link"
                aria-label={action.accessibilityLabel ?? action.label}
                onPress={action.onPress}
                className={cn('h-[36px] items-center justify-center rounded-pill bg-surface-soft px-12 active:bg-surface-soft-pressed', focusRing)}
              >
                <Text size={14} weight="800">
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
        {end}
      </View>
    );
  }
  return (
    <View className={cn('flex-row items-center gap-12 py-8', sub || actions.length ? 'min-h-[60px]' : 'min-h-[56px]', !last && 'border-b-[1.5px] border-line')}>
      {start}
      <View className="min-w-0 flex-1">
        <Text size={16} weight="800">
          {title}
        </Text>
        {sub ? (
          <Text size={14} weight="700" color="ink-muted">
            {sub}
          </Text>
        ) : null}
      </View>
      {actions.length ? (
        <View className="flex-row gap-16">
          {actions.map((action) => (
            <Link key={action.label} label={action.label} accessibilityLabel={action.accessibilityLabel} onPress={action.onPress} />
          ))}
        </View>
      ) : null}
      {end}
    </View>
  );
}

export interface IngredientRowProps {
  /** From @cocon/quantity: "300 ml". */
  amount: string;
  name: string;
  /** Spec 051 FR-008: how it's prepared ("grated"), after the name on its line: "Gruyère · grated", muted. */
  detail?: string | null;
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
export function IngredientRow({ amount, name, detail, sub, tag, last, layout = 'column' }: IngredientRowProps) {
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
          {detail ? (
            <Text size={15} weight="600" color="ink-soft">
              {` · ${detail}`}
            </Text>
          ) : null}
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
