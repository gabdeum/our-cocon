import { useEffect, useEffectEvent, useState } from 'react';

/**
 * Past titles while typing a new event's or reminder's (spec 053 FR-001): asked for 150 ms after
 * typing stops, shown only while the title field has focus and holds text. `onBlur` waits a moment,
 * so tapping a suggestion still lands on it.
 */
export function useTitleSuggestions<S>(enabled: boolean, text: string, load: (text: string) => Promise<S[]>) {
  const [focused, setFocused] = useState(false);
  const [items, setItems] = useState<S[]>([]);
  const fetch = useEffectEvent((t: string) => load(t));
  useEffect(() => {
    if (!enabled) return;
    let stale = false;
    const timer = setTimeout(() => void fetch(text).then((s) => !stale && setItems(s)), 150);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [enabled, text]);
  return {
    shown: enabled && focused && text.trim() ? items : [],
    onFocus: () => setFocused(true),
    onBlur: () => setTimeout(() => setFocused(false), 200),
    /** A suggestion was picked: the row goes away. */
    dismiss: () => setFocused(false),
  };
}
