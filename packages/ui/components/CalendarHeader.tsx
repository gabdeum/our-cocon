import { useRef, useState } from 'react';
import { Modal, Pressable, View, type HostInstance } from 'react-native';
import { cn, focusRing } from '../cn';
import { theme } from '../theme';
import { Button } from './Button';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { MemberChip, MemberStack, type MemberChipColor } from './MemberChip';
import type { Segment } from './SegmentedControl';
import { Text } from './Text';

export interface CalendarHeaderChip {
  /** A member id, "everyone" or "others". */
  key: string;
  name: string;
  initial: string;
  color: MemberChipColor;
  /** Shown. */
  pressed: boolean;
}

export interface CalendarHeaderProps<V extends string> {
  /** "October", "Oct. 25 – 31", "Sun, Oct. 25", "Coming up" (spec 034 FR-007). */
  title: string;
  /** "Previous month" / "Next month", by the view. */
  prevLabel: string;
  nextLabel: string;
  onPrev: () => void;
  onNext: () => void;
  /** "Today". */
  todayLabel: string;
  onToday: () => void;
  /** Month · Week · Day · Agenda. */
  views: Segment<V>[];
  view: V;
  onView: (view: V) => void;
  /** Screen-reader name of the view menu: "Calendar view". */
  viewsLabel: string;
  /** Screen-reader name of the view button: "View: Week". */
  viewButtonLabel: string;
  /** Members in member order, then Everyone and Others. */
  chips: CalendarHeaderChip[];
  onToggle: (key: string) => void;
  onShowAll: () => void;
  /** The people button: "All" or "4 of 5". */
  peopleLabel: string;
  /** Its screen-reader name: "Show events for: everyone". */
  peopleButtonLabel: string;
  /** Group label and heading of the people filter: "Show events for". */
  filterLabel: string;
  /** "Show all". */
  showAllLabel: string;
  /** Screen-reader name of the area around an open popover: "Close". */
  closeLabel: string;
}

type Menu = 'view' | 'people';

// CalHeader screen: the popovers sit 4 under row 2, from its left edge (54 + 44 + 10 + 44 + 4).
const FALLBACK = { x: 20, y: 156, width: 350 };

/**
 * The shared header of the four calendar views (CalendarHeader README, CalHeader screen), 162 tall:
 * title and Today, then the view menu, the people filter and ‹ ›. Both menus are popovers under row 2
 * that close on an outside tap or Escape; picking a view closes its menu, ticking people doesn't.
 */
export function CalendarHeader<V extends string>(p: CalendarHeaderProps<V>) {
  const [open, setOpen] = useState<Menu | null>(null);
  const [at, setAt] = useState(FALLBACK);
  const rowRef = useRef<HostInstance>(null);
  const viewRef = useRef<HostInstance>(null);
  const peopleRef = useRef<HostInstance>(null);
  const shown = p.chips.filter((c) => c.pressed);
  const filtered = shown.length < p.chips.length;
  const current = p.views.find((v) => v.key === p.view);

  const toggleMenu = (menu: Menu) => {
    if (open === menu) return close();
    rowRef.current?.measureInWindow((x, y, width, height) => setAt({ x, y: y + height + 4, width }));
    setOpen(menu);
  };
  const close = () => {
    const back = open === 'view' ? viewRef : peopleRef;
    setOpen(null);
    // Focus goes back to the button that opened the menu.
    setTimeout(() => (back.current as unknown as { focus?: () => void } | null)?.focus?.(), 0);
  };

  return (
    <View className="gap-10 bg-surface-page px-20 pb-10 pt-[54px]">
      <View className="flex-row items-center gap-8">
        <Text variant="displayLg" role="heading" aria-level={1} numberOfLines={1} className="min-w-0 flex-1">
          {p.title}
        </Text>
        <Button variant="soft" size="sm" label={p.todayLabel} onPress={p.onToday} />
      </View>
      <View ref={rowRef} className="flex-row items-center gap-8">
        <Pressable
          ref={viewRef}
          role="button"
          aria-haspopup
          aria-expanded={open === 'view'}
          aria-label={p.viewButtonLabel}
          onPress={() => toggleMenu('view')}
          className={cn('h-control-md flex-none flex-row items-center gap-6 rounded-pill bg-surface-card pl-14 pr-12 active:bg-surface-card-pressed', focusRing)}
        >
          <Text size={15} weight="900">
            {current?.label}
          </Text>
          <Icon name="chevron-down" size={16} />
        </Pressable>
        <Pressable
          ref={peopleRef}
          role="button"
          aria-haspopup
          aria-expanded={open === 'people'}
          aria-label={p.peopleButtonLabel}
          onPress={() => toggleMenu('people')}
          className={cn(
            'h-control-md flex-none flex-row items-center gap-6 rounded-pill pl-6 pr-10',
            filtered ? 'bg-sage active:bg-sage-pressed' : 'bg-surface-card active:bg-surface-card-pressed',
            focusRing,
          )}
        >
          <MemberStack people={shown} filtered={filtered} />
          <Text size={15} weight="900">
            {p.peopleLabel}
          </Text>
          <Icon name="chevron-down" size={16} />
        </Pressable>
        <View className="flex-1" />
        <IconButton variant="card" icon="back" label={p.prevLabel} onPress={p.onPrev} />
        <IconButton variant="card" icon="chevron-right" label={p.nextLabel} onPress={p.onNext} />
      </View>

      {/* The Modal gives Escape (web) and Back (Android); the clear backdrop closes on an outside tap. */}
      <Modal transparent visible={open !== null} animationType="none" onRequestClose={close}>
        <Pressable role="button" aria-label={p.closeLabel} onPress={close} className="absolute inset-0" />
        {open === 'view' ? (
          <View
            role="navigation"
            aria-label={p.viewsLabel}
            className="absolute w-[200px] rounded-[18px] bg-surface-card p-6"
            style={{ top: at.y, left: at.x, boxShadow: theme.shadow.popover }}
          >
            {p.views.map((v) => {
              const on = v.key === p.view;
              return (
                <Pressable
                  key={v.key}
                  role="link"
                  aria-current={on ? 'page' : undefined}
                  onPress={() => {
                    close();
                    p.onView(v.key);
                  }}
                  className={cn('min-h-[48px] flex-row items-center rounded-[12px] px-12', on && 'bg-surface-soft', focusRing)}
                >
                  <Text size={16} weight={on ? '900' : '700'} className="flex-1">
                    {v.label}
                  </Text>
                  {on ? <Icon name="check" size={18} color="olive" /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {open === 'people' ? (
          <View
            role="group"
            aria-label={p.filterLabel}
            className="absolute rounded-[20px] bg-surface-card px-14 pb-12 pt-10"
            style={{ top: at.y, left: at.x, width: at.width, boxShadow: theme.shadow.popover }}
          >
            <View className="min-h-[36px] flex-row items-center">
              <Text aria-hidden size={13} weight="900" color="ink-muted" className="flex-1 uppercase" style={{ letterSpacing: 0.6 }}>
                {p.filterLabel}
              </Text>
              <Pressable role="button" onPress={p.onShowAll} hitSlop={4} className={cn('h-[36px] justify-center px-4', focusRing)}>
                <Text size={15} weight="800" color="olive-deep">
                  {p.showAllLabel}
                </Text>
              </Pressable>
            </View>
            {p.chips.map((c, i) => (
              <MemberChip
                key={c.key}
                name={c.name}
                initial={c.initial}
                color={c.color}
                pressed={c.pressed}
                onPress={() => p.onToggle(c.key)}
                last={i === p.chips.length - 1}
              />
            ))}
          </View>
        ) : null}
      </Modal>
    </View>
  );
}
