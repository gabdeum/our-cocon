import { useCallback, useEffect, useState } from 'react';
import { deviceStorage, type ChoiceStorage } from './recipe-choices';

/**
 * Spec 037 FR-006: the month view's first-visit hint, hidden for good once this person taps
 * "Got it" (on this device; 032-later has syncing it across devices).
 */
const key = (userId: string) => `cocon.calendar.monthHint.${userId}`;

/** True while the hint should show. False until the device has answered, so it never flashes. */
export function useMonthHint(userId: string, storage: ChoiceStorage = deviceStorage) {
  const [seen, setSeen] = useState<{ userId: string; seen: boolean } | null>(null);
  useEffect(() => {
    let live = true;
    storage
      .getItem(key(userId))
      .then((v) => live && setSeen({ userId, seen: v === 'seen' }))
      // If the device can't say, show it: dismissing still works for this visit.
      .catch(() => live && setSeen({ userId, seen: false }));
    return () => {
      live = false;
    };
  }, [storage, userId]);

  const dismiss = useCallback(() => {
    setSeen({ userId, seen: true });
    storage.setItem(key(userId), 'seen').catch(() => undefined);
  }, [storage, userId]);

  return { show: seen?.userId === userId && !seen.seen, dismiss };
}
