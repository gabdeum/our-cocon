import type { ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { cn, focusRing } from '../cn';
import { theme } from '../theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export interface TabBarItem<K extends string> {
  key: K;
  label: string;
  icon: IconName;
}

export interface TabBarProps<K extends string> {
  items: TabBarItem<K>[];
  active: K;
  onSelect: (key: K) => void;
  /** Screen-reader name of the navigation: "Main". */
  label: string;
  /** The TimerPill, centred 10 above the bar while any timer exists (spec 011). */
  timerPill?: ReactNode;
  /** Home-indicator safe area: the bar sits at least this far from the bottom, and never under 26. */
  bottomInset?: number;
}

// TabBar README: container 160 tall when timers exist (pill above the bar), 100 otherwise.
const CONTAINER_WITH_PILL = 160;
const CONTAINER = 100;
const BOTTOM = 26;

/** Spec 036 FR-001: the selected tab's fixed width, sized to "Groceries" plus 16 px each side. */
export const SELECTED_TAB_WIDTH = 132;

/** Active label: 15 px, one line, shrinking to 13 px at most at the largest text size. */
export const TAB_LABEL_MIN_SCALE = 13 / 15;

/**
 * The floating dark navigation pill (TabBar README), 16 from the sides and 26 from the bottom.
 * It floats over the screen, so screens pad their content 180 at the bottom (TabScreen does).
 */
export function TabBar<K extends string>({ items, active, onSelect, label, timerPill, bottomInset = 0 }: TabBarProps<K>) {
  // 26 already clears a home indicator (34 on the iPhone) by most of its height; adding both put the bar 60 up.
  const bottom = Math.max(BOTTOM, bottomInset);
  const height = (timerPill ? CONTAINER_WITH_PILL : CONTAINER) - BOTTOM + bottom;
  return (
    <View
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 right-0 justify-end gap-10 px-16"
      style={{ height, paddingBottom: bottom }}
    >
      {timerPill}
      <View role="navigation" aria-label={label} className="h-tabbar flex-row gap-4 rounded-[34px] bg-ink p-8" style={{ boxShadow: theme.shadow.nav }}>
        {items.map((item) => {
          const on = item.key === active;
          return (
            <Pressable
              // On the iPhone a tab is made anew when it's selected or unselected: its size from
              // before (132, then still wider than the others) stuck. The web keeps it, for focus.
              key={Platform.OS === 'web' ? item.key : `${item.key}:${on}`}
              role="link"
              aria-label={item.label}
              aria-current={on ? 'page' : undefined}
              accessibilityState={Platform.OS === 'web' ? undefined : { selected: on }}
              onPress={() => onSelect(item.key)}
              // The selected tab is a fixed width and never grows; the others share the rest, min 44 (spec 036 FR-001).
              // Both looks set the same style keys, so nothing of one is left on the other.
              className={cn('flex-row items-center justify-center gap-6 rounded-[26px]', on && 'bg-honey', focusRing)}
              style={
                on
                  ? { flexBasis: SELECTED_TAB_WIDTH, flexGrow: 0, flexShrink: 0, minWidth: SELECTED_TAB_WIDTH, paddingHorizontal: 16 }
                  : { flexBasis: 0, flexGrow: 1, flexShrink: 1, minWidth: 44, paddingHorizontal: 0 }
              }
            >
              <Icon name={item.icon} size="md" color={on ? 'ink' : 'onInk'} />
              {on ? (
                <Text size={15} weight="800" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={TAB_LABEL_MIN_SCALE} className="shrink" aria-hidden>
                  {item.label}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
