import { useEffect, useRef, type RefObject } from 'react';
import { AccessibilityInfo, findNodeHandle, Platform, useWindowDimensions, type HostInstance } from 'react-native';

// Accessibility helpers shared by every component (spec 030).

type Listener = (text: string) => void;
let webListener: Listener | null = null;

/** Lets ThemeProvider's hidden live region receive web announcements. */
export function setWebAnnouncer(listener: Listener | null) {
  webListener = listener;
}

/**
 * Says `text` politely through the screen reader: VoiceOver/TalkBack on the phone
 * (which ignore `aria-live`), the app's single live region on the web.
 */
export function announce(text: string) {
  if (!text) return;
  if (Platform.OS === 'web') webListener?.(text);
  else AccessibilityInfo.announceForAccessibility(text);
}

/**
 * A toggle button's state for every platform: `aria-pressed` on the web, `selected` on iOS
 * and Android, where React Native drops `aria-pressed`.
 */
export function pressedState(on: boolean) {
  return { 'aria-pressed': on, accessibilityState: { selected: on } } as const;
}

/** From this system text size up, layouts switch to their large-text forms (User Story 3). */
export const LARGE_TEXT_SCALE = 1.35;

export function useLargeText(): boolean {
  return useWindowDimensions().fontScale >= LARGE_TEXT_SCALE;
}

/** iOS moves VoiceOver only once the closing modal is gone. */
const RETURN_FOCUS_MS = 400;

/**
 * When a sheet or dialog closes, focus goes back to the control that opened it (spec 030 FR-003):
 * keyboard focus on the web, the screen reader's cursor on the phone.
 */
export function useReturnFocus(visible: boolean, to: RefObject<HostInstance | null> | undefined) {
  const wasVisible = useRef(visible);
  useEffect(() => {
    const closed = wasVisible.current && !visible;
    wasVisible.current = visible;
    if (!closed || !to) return;
    const t = setTimeout(
      () => {
        const target = to.current;
        if (!target) return;
        if (Platform.OS === 'web') (target as unknown as { focus?: () => void }).focus?.();
        else {
          const node = findNodeHandle(target);
          if (node) AccessibilityInfo.setAccessibilityFocus(node);
        }
      },
      Platform.OS === 'web' ? 0 : RETURN_FOCUS_MS,
    );
    return () => clearTimeout(t);
  }, [visible, to]);
}
