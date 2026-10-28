import { useCallback, useEffect, useState } from 'react';
import { z } from 'zod';
import { deviceStorage, type ChoiceStorage } from './recipe-choices';

/**
 * Spec 036 FR-004: the header's member filter, remembered per person on this device. It keeps who
 * is **hidden** (member ids, "everyone", "others"), so a new member shows by default and the id of
 * someone who left simply matches no chip. Only ids are stored, never names.
 */
const Stored = z.object({ hidden: z.array(z.string().max(64)).max(52) });

const NONE: ReadonlySet<string> = new Set();

const key = (userId: string) => `cocon.calendar.filter.${userId}`;

export async function readHidden(storage: ChoiceStorage, userId: string): Promise<Set<string>> {
  try {
    const raw = await storage.getItem(key(userId));
    const parsed = Stored.safeParse(raw ? JSON.parse(raw) : null);
    return new Set(parsed.success ? parsed.data.hidden : []);
  } catch {
    return new Set();
  }
}

/** Best effort: if the device refuses, the filter still works, it just won't be remembered. */
export async function writeHidden(storage: ChoiceStorage, userId: string, hidden: ReadonlySet<string>): Promise<void> {
  try {
    await storage.setItem(key(userId), JSON.stringify({ hidden: [...hidden].slice(0, 52) }));
  } catch {
    // Nothing to tell anyone; the choice just isn't kept.
  }
}

/** The hidden chips for this person, with a toggle and Show all that remember them. */
export function useCalendarFilter(userId: string, storage: ChoiceStorage = deviceStorage) {
  // Kept with whose it is, so another person signing in never sees the last one's choice.
  const [stored, setStored] = useState<{ userId: string; hidden: ReadonlySet<string> } | null>(null);
  const hidden = stored?.userId === userId ? stored.hidden : NONE;
  useEffect(() => {
    let live = true;
    void readHidden(storage, userId).then((h) => live && setStored({ userId, hidden: h }));
    return () => {
      live = false;
    };
  }, [storage, userId]);

  const toggle = useCallback(
    (chip: string): ReadonlySet<string> => {
      const next = new Set(hidden);
      if (next.has(chip)) next.delete(chip);
      else next.add(chip);
      setStored({ userId, hidden: next });
      void writeHidden(storage, userId, next);
      return next;
    },
    [hidden, storage, userId],
  );

  const showAll = useCallback(() => {
    setStored({ userId, hidden: NONE });
    void writeHidden(storage, userId, NONE);
  }, [storage, userId]);

  return { hidden, toggle, showAll };
}
