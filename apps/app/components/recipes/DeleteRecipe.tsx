import { useState } from 'react';
import { Button, Dialog } from '@cocon/ui';
import { useOnline } from '../../lib/online';
import { useFailureToast } from '../../lib/toast';
import { strings } from '../../strings/en';

const d = strings.deleteRecipe;

export interface DeleteRecipeProps {
  name: string;
  variants: number;
  disabled?: boolean;
  /** Deletes it (lib/use-delete-recipe.ts) and moves on; throws when deleting failed. */
  onDelete: () => Promise<void>;
}

/**
 * Spec 018 (OC-Delete): "Delete recipe", which asks in a Dialog naming the recipe and its variants.
 * At the end of the edit form's "This recipe" (spec 051 FR-013). Off offline.
 */
export function DeleteRecipe({ name, variants, disabled, onDelete }: DeleteRecipeProps) {
  const online = useOnline();
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [failed, setFailed] = useState(false);

  const remove = async () => {
    setConfirm(false);
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
  return (
    <>
      <Button label={d.link} variant="danger-card" icon="trash" block onPress={() => setConfirm(true)} disabled={!online || deleting || disabled} />
      <Dialog
        visible={confirm}
        title={d.title(name)}
        body={d.body(variants)}
        emphasis={d.bodyEmphasis}
        confirmLabel={d.confirm}
        onConfirm={() => void remove()}
        cancelLabel={d.keep}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
