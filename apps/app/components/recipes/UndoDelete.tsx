import { useEffect } from 'react';
import type { Tracker } from '@cocon/schemas';
import { strings } from '../../strings/en';
import { useToast } from '../../lib/toast';

export interface UndoDeleteOptions {
  /** The recipe just deleted, from `?deleted=<id>`. */
  deleted: string | undefined;
  /** Puts the recipe back (lib/recipe-delete.ts › restoreRecipe). */
  onUndo: () => Promise<void>;
  tracker: Tracker;
  /** The toast is up: clears `?deleted` so it shows once. */
  onShown: () => void;
}

/**
 * Spec 018 (OC-Delete › After deleting): Recipes shows "Recipe deleted" with "Undo" in the toast.
 * Undo brings the recipe straight back; if that fails, the toast says so (the recipe is still in
 * Recently deleted).
 */
export function useUndoDelete({ deleted, onUndo, tracker, onShown }: UndoDeleteOptions) {
  const toast = useToast();
  useEffect(() => {
    if (!deleted) return;
    toast.show({
      text: strings.recipes.deleted,
      undoFailed: strings.recipes.undoFailed,
      onUndo: async () => {
        await onUndo();
        tracker.track('recipe_restored', { days_since_delete: 0 });
      },
    });
    onShown();
    // Once per deleted recipe; the callbacks are fresh each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleted]);
}
