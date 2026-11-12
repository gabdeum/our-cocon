import { useState } from 'react';
import { endCook, loadCooked } from '@cocon/data';
import { strings } from '../../strings/en';
import { cancelCook, finishCook, undoEndCook, useRefreshCooks, type CookSession } from '../../lib/cook-sessions';
import { useSession } from '../../lib/session';
import { useToast } from '../../lib/toast';
import { CookDoneSheet, type CookDoneSheetProps } from './CookDoneSheet';

const p = strings.recipePage;

/**
 * Spec 051: Done and Cancel on a cook, from the Recipes list, the recipe page or cooking mode.
 * Done opens the Done sheet (FR-005); Cancel shows "Cancelled · Undo" (FR-006). Render `sheet`.
 */
export function useCookActions() {
  const { state, client, tracker } = useSession();
  const toast = useToast();
  const refresh = useRefreshCooks();
  const [done, setDone] = useState<{ session: CookSession; view: NonNullable<CookDoneSheetProps['done']> } | null>(null);
  const me = state.status === 'ready' ? (state.members.find((m) => m.user_id === state.userId)?.display_name ?? strings.recipe.formerMember) : strings.recipe.formerMember;
  const failed = () => toast.show({ text: p.cookFailed, tone: 'warn' });

  /** The sheet for a cook just marked done; how many times comes from the log, this one included. */
  const showDone = async (session: CookSession, recipeName: string) => {
    const times = (await loadCooked(client, session.recipe_id).catch(() => null))?.times ?? 1;
    setDone({ session, view: { recipeName, member: me, times, step: session.current_step + 1 } });
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

  const attempt = async (write: () => Promise<unknown>) => {
    try {
      await write();
      void refresh();
      return true;
    } catch {
      return false;
    }
  };

  const sheet = (
    <CookDoneSheet
      key={done?.session.id ?? 'none'}
      done={done?.view ?? null}
      onUndo={() => (done ? attempt(() => undoEndCook({ client }, done.session)) : Promise.resolve(false))}
      // Undo isn't tracked, so marking it done again isn't either: one cook_finished per cook.
      onMarkDone={() => (done ? attempt(() => endCook(client, done.session.id, 'done')) : Promise.resolve(false))}
      onClose={() => setDone(null)}
    />
  );
  return { finish, showDone, cancel, sheet, closeDone: () => setDone(null) };
}
