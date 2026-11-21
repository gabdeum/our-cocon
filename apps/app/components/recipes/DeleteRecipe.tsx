import { useState } from 'react';
import { Button } from '@cocon/ui';
import { useOnline } from '../../lib/online';
import { useFailureToast } from '../../lib/toast';
import { strings } from '../../strings/en';

const d = strings.deleteRecipe;

export interface DeleteRecipeProps {
  disabled?: boolean;
  /** Deletes it (lib/use-delete-recipe.ts) and moves on; throws when deleting failed. */
  onDelete: () => Promise<void>;
}

/**
 * Spec 018 (OC-Delete): "Delete recipe", at once: Recipes then says "Recipe deleted" with Undo, and
 * Recently deleted keeps it 30 days (2026-11-21; it used to ask in a Dialog first). At the end of the
 * edit form's "This recipe" (spec 051 FR-013). Off offline.
 */
export function DeleteRecipe({ disabled, onDelete }: DeleteRecipeProps) {
  const online = useOnline();
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  const remove = async () => {
    setDeleting(true);
    setFailed(false);
    try {
      await onDelete();
    } catch {
      setDeleting(false);
      setFailed(true);
    }
  };

  // Failures are warn toasts (spec 053 FR-015).
  useFailureToast(failed && d.failed);
  return <Button label={d.link} variant="danger-card" icon="trash" block onPress={() => void remove()} disabled={!online || deleting || disabled} />;
}
