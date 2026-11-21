import type { ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { theme } from '../theme';
import { Icon, Logo } from './Icon';
import { Text } from './Text';
import type { TabBarItem } from './TabBar';

export interface NavRailProps<K extends string> {
  /** The TabBar's items: same destinations, icons, order and labels (spec 064 SC-002). */
  items: TabBarItem<K>[];
  active: K;
  onSelect: (key: K) => void;
  /** Screen-reader name of the navigation: "Main". */
  label: string;
  /** The TimerPill in its vertical form, at the bottom while any timer runs (spec 064 FR-002). */
  timer?: ReactNode;
  /** Safe areas: the rail sits 12 under the top one, and at least 12 from the bottom, more when its inset is larger. */
  insets?: { top: number; bottom: number };
}

/** NavRail README: 12 around the rail (top, bottom, left). */
const MARGIN = 12;

/** Labels always shown, 13 px, one line, shrinking to 11 px at most at the largest text size. */
const LABEL_MIN_SCALE = 11 / 13;

/**
 * The TabBar as a side rail, from 960 wide (NavRail README, spec 064): floating on the left of a
 * 104 slot (`theme.layout.rail`), the logo tile on top, then the same tabs with their labels always
 * shown, and the timer at the bottom. Screens start their content after the slot.
 */
export function NavRail<K extends string>({ items, active, onSelect, label, timer, insets }: NavRailProps<K>) {
  return (
    <View
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 top-0"
      style={{
        width: theme.layout.rail,
        paddingLeft: MARGIN,
        // 12 under the status bar, level with the screens' first row (`useWideTop`).
        paddingTop: (insets?.top ?? 0) + MARGIN,
        paddingBottom: Math.max(MARGIN, insets?.bottom ?? 0),
      }}
    >
      <View role="navigation" aria-label={label} className="flex-1 items-center gap-6 rounded-[30px] bg-ink px-8 py-14" style={{ boxShadow: theme.shadow.nav }}>
        <View aria-hidden className="mb-12 h-[40px] w-[40px] items-center justify-center rounded-[12px] bg-honey">
          <Logo size={24} color="ink" />
        </View>
        {items.map((item) => {
          const on = item.key === active;
          return (
            <Pressable
              key={item.key}
              role="link"
              aria-label={item.label}
              aria-current={on ? 'page' : undefined}
              accessibilityState={Platform.OS === 'web' ? undefined : { selected: on }}
              onPress={() => onSelect(item.key)}
              className={cn('h-[64px] w-[76px] items-center justify-center gap-[3px] rounded-[20px] px-4', on && 'bg-honey', focusRing)}
            >
              <Icon name={item.icon} size="md" color={on ? 'ink' : 'onInk'} />
              <Text
                size={13}
                weight={on ? '900' : '700'}
                color={on ? 'ink' : 'on-ink'}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={LABEL_MIN_SCALE}
                aria-hidden
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
        <View className="flex-1" />
        {timer}
      </View>
    </View>
  );
}
