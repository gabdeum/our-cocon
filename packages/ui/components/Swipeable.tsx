import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, PanResponder, Platform, type ViewStyle } from 'react-native';
import { useReduceMotion } from '../reduceMotion';

/** Swipeable README › Commit: a drag this far moves to the next or previous page. */
export const SWIPE_COMMIT = 60;
/** OC-CalWeek: the new page starts this far to the side, then slides in. */
const ENTER_FROM = 140;
const DURATION = 220;
/** A move counts as a swipe once it's this far sideways, and more sideways than up or down. */
const CLAIM = 8;

// Web: the browser keeps vertical scrolling; the swipe gets the horizontal moves.
const webTouch = (Platform.OS === 'web' ? { touchAction: 'pan-y', userSelect: 'none' } : {}) as ViewStyle;

export interface SwipeableProps {
  /** The page shown, as a sortable key (the week's first day). A later key slides in from the right. */
  page: string;
  /** A swipe of 60 px or more: 1 for the next page (swiped left), -1 for the previous. */
  onSwipe: (direction: 1 | -1) => void;
  children: ReactNode;
}

/**
 * Swipeable README: the content follows a horizontal drag (fading to 0.35 at 400 px). Past 60 px it
 * asks for the next or previous page; less snaps back. Each new page, from a swipe, the header's
 * arrows or Today, slides in from its side (220 ms ease-out). Reduce Motion swaps instantly.
 */
export function Swipeable({ page, onSwipe, children }: SwipeableProps) {
  const reduce = useReduceMotion();
  const [dx] = useState(() => new Animated.Value(0));
  const opacity = useMemo(() => dx.interpolate({ inputRange: [-400, 0, 400], outputRange: [0.35, 1, 0.35], extrapolate: 'clamp' }), [dx]);
  const pan = useMemo(() => {
    const horizontal = (g: { dx: number; dy: number }) => Math.abs(g.dx) > CLAIM && Math.abs(g.dx) > Math.abs(g.dy);
    const snapBack = () => {
      if (reduce) dx.setValue(0);
      else Animated.timing(dx, { toValue: 0, duration: DURATION, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
    };
    return PanResponder.create({
      // Capture, so a drag that starts on an event block or an hour still swipes.
      onMoveShouldSetPanResponderCapture: (_, g) => horizontal(g),
      onMoveShouldSetPanResponder: (_, g) => horizontal(g),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => dx.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        if (g.dx <= -SWIPE_COMMIT) onSwipe(1);
        else if (g.dx >= SWIPE_COMMIT) onSwipe(-1);
        else snapBack();
      },
      onPanResponderTerminate: snapBack,
    });
  }, [dx, onSwipe, reduce]);

  // A new page enters from the side it came from.
  const shown = useRef(page);
  useEffect(() => {
    if (page === shown.current) return;
    const from = page > shown.current ? ENTER_FROM : -ENTER_FROM;
    shown.current = page;
    if (reduce) {
      dx.setValue(0);
      return;
    }
    dx.setValue(from);
    Animated.timing(dx, { toValue: 0, duration: DURATION, easing: Easing.out(Easing.ease), useNativeDriver: false }).start();
  }, [page, reduce, dx]);

  return (
    // NativeWind doesn't style Animated.View: it only moves; the children carry the look.
    <Animated.View {...pan.panHandlers} style={[webTouch, { transform: [{ translateX: dx }], opacity }]}>
      {children}
    </Animated.View>
  );
}
