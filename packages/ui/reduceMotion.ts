import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * The device's Reduce Motion setting: slides become instant swaps (BottomSheet, Swipeable),
 * scrolls jump (MonthGrid, cooking mode). Follows the setting if it changes while the app is open.
 */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled?.().then((v) => alive && setReduce(v));
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => alive && setReduce(v));
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}
