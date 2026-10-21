import { useState } from 'react';
import { Callout, Dialog, Link } from '@cocon/ui';
import { useOnline } from '../../lib/online';
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
 * Spec 018 (OC-Delete): the danger link "Delete this recipe", which asks in a Dialog naming the
 * recipe and its variants. At the end of the edit form's Variants and of recipe settings. Off offline.
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

  return (
    <>
      {failed ? <Callout variant="warn" text={d.failed} /> : null}
      <Link label={d.link} tone="danger" icon="trash" onPress={() => setConfirm(true)} disabled={!online || deleting || disabled} />
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
