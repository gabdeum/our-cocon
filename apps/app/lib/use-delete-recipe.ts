import { useQueryClient } from '@tanstack/react-query';
import type { Tracker } from '@cocon/schemas';
import { deleteRecipe } from './recipe-delete';
import type { Client } from './supabase';

/**
 * Spec 018: "Delete this recipe" from the edit form or recipe settings. Moves it to Recently deleted,
 * records `recipe_deleted` and refreshes every recipe list. Throws when nothing was deleted.
 */
export function useDeleteRecipe(client: Pick<Client, 'from'>, tracker: Tracker, familyId: string) {
  const queryClient = useQueryClient();
  return async (id: string) => {
    await deleteRecipe(client, id);
    tracker.track('recipe_deleted', { source: 'app' });
    void queryClient.invalidateQueries({ queryKey: ['recipes', familyId] });
  };
}
