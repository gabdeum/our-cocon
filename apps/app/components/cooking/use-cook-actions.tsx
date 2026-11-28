import { loadCooked } from '@cocon/data';
import { strings } from '../../strings';
import { cancelCook, finishCook, undoEndCook, useRefreshCooks, type CookSession } from '../../lib/cook-sessions';
import { useSession } from '../../lib/session';
import { useToast } from '../../lib/toast';

const p = strings.recipePage;

/**
 * Spec 051: Done and Cancel on a cook, from the Recipes list, the recipe page or cooking mode.
 * Done shows "{recipe} is done! · Undo" (FR-005); Cancel shows "Cancelled · Undo" (FR-006).
 */
export function useCookActions() {
  const { client, tracker } = useSession();
  const toast = useToast();
  const refresh = useRefreshCooks();
  const failed = () => toast.show({ text: p.cookFailed, tone: 'warn' });

  /** The toast for a cook just marked done; how many times comes from the log, this one included. Undo puts it back in progress. */
  const showDone = async (session: CookSession, recipeName: string) => {
    const times = (await loadCooked(client, session.recipe_id).catch(() => null))?.times ?? 1;
    toast.show({
      text: strings.cookDone.toast(recipeName, times),
      onUndo: async () => {
        await undoEndCook({ client }, session);
        await refresh();
      },
    });
  };

  const finish = async (session: CookSession, recipeName: string): Promise<boolean> => {
    try {
      await finishCook({ client, tracker }, session);
    } catch {
      failed();
      return false;
    }
    void refresh();
    await showDone(session, recipeName);
    return true;
  };

  const cancel = async (session: CookSession): Promise<void> => {
    try {
      await cancelCook({ client, tracker }, session);
    } catch {
      failed();
      return;
    }
    void refresh();
    toast.show({
      text: p.cancelled,
      onUndo: async () => {
        await undoEndCook({ client }, session);
        await refresh();
      },
    });
  };

  return { finish, showDone, cancel };
}
