import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBanner } from '@cocon/ui';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { BANNER_MS } from '../timers/TimerAlerts';

export interface UndoDeleteProps {
  /** Puts the recipe back (lib/recipe-delete.ts › restoreRecipe). */
  onUndo: () => Promise<void>;
  tracker: Tracker;
  /** The banner went away: Undo, or after 8 s. */
  onDone: () => void;
}

/**
 * Spec 018 (OC-Delete › After deleting): Recipes shows "Recipe deleted" with "Undo" for 8 s. Undo
 * brings the recipe straight back; if that fails, the banner says so (the recipe is still in
 * Recently deleted).
 */
export function UndoDelete({ onUndo, tracker, onDone }: UndoDeleteProps) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<'shown' | 'undoing' | 'failed'>('shown');

  useEffect(() => {
    if (state === 'undoing') return;
    const t = setTimeout(onDone, BANNER_MS);
    return () => clearTimeout(t);
  }, [state, onDone]);

  const undo = async () => {
    setState('undoing');
    try {
      await onUndo();
    } catch {
      setState('failed');
      return;
    }
    tracker.track('recipe_restored', { days_since_delete: 0 });
    onDone();
  };

  return (
    <View pointerEvents="box-none" className="absolute left-16 right-16 top-12 z-10" style={{ marginTop: insets.top }}>
      {state === 'failed' ? (
        <StatusBanner tone="warn" message={strings.recipes.undoFailed} />
      ) : (
        <StatusBanner message={strings.recipes.deleted} actionLabel={strings.recipes.undo} onAction={state === 'shown' ? () => void undo() : undefined} />
      )}
    </View>
  );
}
