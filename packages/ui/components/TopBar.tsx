import { Children, createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, View, type HostInstance, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { cn } from '../cn';
import { useReduceMotion } from '../reduceMotion';
import { theme } from '../theme';
import { IconButton } from './IconButton';
import { Text } from './Text';

/** What a screen gives its top bar; the layout adds the scroll state. */
export interface TopBarConfig {
  /** "Back to Menu"; `close` is cooking mode's ✕ ("Exit cooking mode"). */
  back: { label: string; onPress: () => void; icon?: 'back' | 'close' };
  /** The page's name: always shown on settings and list screens, faded in on detail screens. */
  title?: string;
  /** `onScroll`: detail screens keep their big heading (in a TopBarHeading) and show the name once it is under the bar. */
  titleMode?: 'always' | 'onScroll';
  /** Up to two round IconButtons (or an ActionMenu), 8 apart. */
  actions?: ReactNode;
}

export interface TopBarProps extends TopBarConfig {
  /** Content is under the bar: hairline and shadow. */
  scrolled?: boolean;
  /** `onScroll` only: the heading has gone under the bar. */
  titleShown?: boolean;
  /** Over the recipe photo: no background until the photo has scrolled away. */
  transparent?: boolean;
}

const BUTTON = 48;
const GAP = 8;
// The drawings' 52: the status bar on a 390 × 844 iPhone. A taller notch pushes the bar down.
const MIN_TOP = 52;
const FADE = 200;

/**
 * One bar at the top of every pushed screen (TopBar README): round back button, the title centred on
 * the screen whatever the sides hold, up to two round actions. The layout keeps it pinned.
 */
export function TopBar({ back, title, titleMode = 'always', actions, scrolled = false, titleShown = false, transparent = false }: TopBarProps) {
  const insets = useContext(SafeAreaInsetsContext);
  const reduce = useReduceMotion();
  const always = titleMode === 'always';
  const visible = always || titleShown;
  const [opacity] = useState(() => new Animated.Value(visible ? 1 : 0));
  useEffect(() => {
    if (reduce) opacity.setValue(visible ? 1 : 0);
    else Animated.timing(opacity, { toValue: visible ? 1 : 0, duration: FADE, useNativeDriver: false }).start();
  }, [visible, reduce, opacity]);

  // Both sides as wide as the wider one, so the title stays centred and shrinks before it overlaps.
  const count = Math.max(1, Children.count(actions));
  const side = count * BUTTON + (count - 1) * GAP;
  // Over the photo, only the buttons take touches: the rest of the bar lets the photo scroll.
  const through = transparent ? 'box-none' : 'auto';

  return (
    <View
      testID="top-bar"
      pointerEvents={through}
      className={cn('border-b-[1.5px] px-16 pb-8', scrolled ? 'border-line' : 'border-transparent', transparent ? 'bg-transparent' : 'bg-surface-page')}
      style={{ paddingTop: Math.max(insets?.top ?? 0, MIN_TOP), boxShadow: scrolled ? theme.shadow.bar : undefined }}
    >
      <View pointerEvents={through} className="flex-row items-center gap-8">
        <View pointerEvents={through} className="flex-1 items-start" style={{ minWidth: side }}>
          <IconButton variant="round" icon={back.icon ?? 'back'} iconSize={back.icon === 'close' ? 20 : 22} label={back.label} onPress={back.onPress} />
        </View>
        {/* NativeWind doesn't style Animated.View: it only fades; the Text carries the look. */}
        <Animated.View pointerEvents="none" style={{ opacity, flexShrink: 1, alignItems: 'center' }}>
          {title ? (
            <Text
              size={17}
              weight="900"
              numberOfLines={1}
              role={always ? 'heading' : undefined}
              aria-level={always ? 1 : undefined}
              aria-hidden={always ? undefined : true}
            >
              {title}
            </Text>
          ) : null}
        </Animated.View>
        <View pointerEvents={through} className="flex-1 flex-row justify-end gap-8" style={{ minWidth: side }}>
          {actions}
        </View>
      </View>
    </View>
  );
}

const HeadingContext = createContext<((node: HostInstance | null) => void) | null>(null);
/** Layouts wrap their content in it with `useTopBar`'s `register`. */
export const TopBarHeadingProvider = HeadingContext.Provider;

/** Wraps a detail screen's big heading; the bar shows the title once this has scrolled under it. */
export function TopBarHeading({ children, className }: { children: ReactNode; className?: string }) {
  const register = useContext(HeadingContext);
  return (
    <View ref={register ?? undefined} className={className}>
      {children}
    </View>
  );
}

type Measurable = { measureInWindow?: (cb: (x: number, y: number, w: number, h: number) => void) => void };
const measure = (node: unknown) =>
  new Promise<{ y: number; h: number } | null>((done) => {
    const m = (node as Measurable | null)?.measureInWindow;
    if (!m) return done(null);
    m.call(node, (_x, y, _w, h) => done({ y, h }));
  });

/**
 * The scroll state a layout feeds its TopBar: `scrolled` past 0, `titleShown` once the TopBarHeading's
 * bottom is under the bar's bottom, and `transparent` until `photoHeight` has scrolled away.
 */
export function useTopBar(config: TopBarConfig | undefined, photoHeight?: number) {
  const [scrolled, setScrolled] = useState(false);
  const [titleShown, setTitleShown] = useState(false);
  const [past, setPast] = useState(false);
  const bar = useRef<HostInstance | null>(null);
  const heading = useRef<HostInstance | null>(null);
  const barHeight = useRef(0);
  const register = useCallback((node: HostInstance | null) => {
    heading.current = node;
  }, []);
  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      setScrolled(y > 0);
      if (photoHeight !== undefined) setPast(y >= photoHeight - barHeight.current);
      if (config?.titleMode !== 'onScroll' || !heading.current) return;
      void Promise.all([measure(heading.current), measure(bar.current)]).then(([h, b]) => {
        if (h && b) setTitleShown(h.y + h.h <= b.y + b.h);
      });
    },
    [config?.titleMode, photoHeight],
  );
  const node = config ? (
    <View ref={bar} onLayout={(e) => (barHeight.current = e.nativeEvent.layout.height)}>
      <TopBar {...config} scrolled={photoHeight !== undefined ? past : scrolled} titleShown={titleShown} transparent={photoHeight !== undefined && !past} />
    </View>
  ) : null;
  return { node, onScroll, register };
}
