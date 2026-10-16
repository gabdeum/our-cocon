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
  /** Home-indicator safe area, added to the 26 px bottom offset. */
  bottomInset?: number;
}

// TabBar README: container 160 tall when timers exist (pill above the bar), 100 otherwise.
const CONTAINER_WITH_PILL = 160;
const CONTAINER = 100;
const BOTTOM = 26;

/** Active label: 15 px, one line, shrinking to 13 px at most at the largest text size. */
export const TAB_LABEL_MIN_SCALE = 13 / 15;

/**
 * The floating dark navigation pill (TabBar README), 16 from the sides and 26 from the bottom.
 * It floats over the screen, so screens pad their content 180 at the bottom (TabScreen does).
 */
export function TabBar<K extends string>({ items, active, onSelect, label, timerPill, bottomInset = 0 }: TabBarProps<K>) {
  const height = (timerPill ? CONTAINER_WITH_PILL : CONTAINER) + bottomInset;
  return (
    <View
      pointerEvents="box-none"
      className="absolute bottom-0 left-0 right-0 justify-end gap-10 px-16"
      style={{ height, paddingBottom: BOTTOM + bottomInset }}
    >
      {timerPill}
      <View role="navigation" aria-label={label} className="h-tabbar flex-row gap-4 rounded-[34px] bg-ink p-8" style={{ boxShadow: theme.shadow.nav }}>
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
              className={cn('flex-row items-center justify-center gap-8 rounded-[26px]', on ? 'flex-[2.2] bg-honey' : 'flex-1', focusRing)}
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
