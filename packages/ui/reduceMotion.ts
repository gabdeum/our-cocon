import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** The device's Reduce Motion setting: slides become instant swaps (BottomSheet, Swipeable). */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled?.().then((v) => alive && setReduce(v));
    return () => {
      alive = false;
    };
  }, []);
  return reduce;
}
