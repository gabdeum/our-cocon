import { useCallback, useEffect, useRef } from 'react';
import { View } from 'react-native';
import { Link, Meta, Stepper } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import type { RecipeChoices } from '../../lib/recipe-choices';
import { servingsText, SERVINGS_MIN } from '../../lib/recipe-view';

const p = strings.recipePage;
const more = strings.recipePage.more;
/** `servings_changed` waits for the stepper to settle, so 6 → 9 in three taps is one change. */
export const SERVINGS_SETTLE_MS = 800;

/**
 * The servings stepper's rules, shared by the recipe page and cooking mode's options (spec 008,
 * 013): scaled by an ingredient, servings can be 7½, − goes to 7 and + to 8, and the scale ends.
 * `servings_changed` is sent once the stepper settles, from where the burst of taps started;
 * leaving before it settles still sends it.
 */
export function useServings({
  current,
  shown,
  max,
  tracker,
  update,
}: {
  current: RecipeChoices | null;
  /** The servings in force: the view's when scaled by an ingredient. */
  shown: number;
  max: number;
  tracker: Tracker;
  update: (next: RecipeChoices) => void;
}) {
  const burst = useRef<{ from: number; to: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const send = useCallback(() => {
    const b = burst.current;
    burst.current = null;
    if (!b) return;
    clearTimeout(b.timer);
    if (b.from !== b.to) tracker.track('servings_changed', { from: b.from, to: b.to });
  }, [tracker]);
  useEffect(() => send, [send]);
  return (stepped: number) => {
    if (!current) return;
    const to = Math.min(max, Math.max(SERVINGS_MIN, stepped > shown ? Math.floor(shown) + 1 : Math.ceil(shown) - 1));
    const from = burst.current?.from ?? Math.min(max, Math.max(SERVINGS_MIN, Math.round(shown)));
    clearTimeout(burst.current?.timer);
    burst.current = { from, to, timer: setTimeout(send, SERVINGS_SETTLE_MS) };
    update({ ...current, servings: to, scaledBy: null });
  };
}

/** "Onion" → "onion", as said in "Scaled by onion". */
export const scaledName = (name: string) => `${name.charAt(0).toLowerCase()}${name.slice(1)}`;

/** The stepper, showing "7½" while scaled by an ingredient. */
export function ServingsStepper({ shown, scaled, max, onChange }: { shown: number; scaled: boolean; max: number; onChange: (stepped: number) => void }) {
  return (
    <Stepper
      value={shown}
      display={scaled ? servingsText(shown) : undefined}
      announcement={p.servingsAnnouncement(scaled ? servingsText(shown) : String(shown))}
      onChange={onChange}
      min={SERVINGS_MIN}
      max={max}
      decreaseLabel={p.fewerServings}
      increaseLabel={p.moreServings}
    />
  );
}

/** "Scaled by onion · Reset" under the stepper (spec 013). */
export function ScaledByLine({ name, onReset }: { name: string; onReset: () => void }) {
  return (
    <View className="flex-row flex-wrap items-center gap-8">
      {/* Meta and Link align themselves to the top; their wrappers let the row centre them. */}
      <View>
        <Meta label={more.scaledBy(name)} tone="sage" />
      </View>
      <View>
        <Link label={more.reset} aria-label={more.resetA11y(name)} onPress={onReset} />
      </View>
    </View>
  );
}
