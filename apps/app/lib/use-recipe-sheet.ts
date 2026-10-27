import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { loadRecipe, recipeKey, type RecipeDetail } from './recipe';
import { deviceStorage, readChoices, startingChoices, writeChoices, type RecipeChoices } from './recipe-choices';
import { useCookingSettings } from './recipe-settings';
import { servingsMax } from './recipe-view';
import { useSession } from './session';

/**
 * A sheet over the recipe page (spec 013's scale and converter): the recipe from the page's own
 * query, its choices on this device and its settings in force (spec 027). `save` writes the choices
 * back for the page to read on return.
 */
export function useRecipeSheet() {
  const params = useLocalSearchParams<{ id: string }>();
  const parsed = z.uuid().safeParse(params.id);
  const id = parsed.success ? parsed.data : null;
  const { state, client, tracker } = useSession();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const userId = state.status === 'ready' ? state.userId : '';
  const recipe = useQuery({
    queryKey: recipeKey(familyId ?? '', id ?? ''),
    queryFn: () => (id ? loadRecipe(client, id) : null),
    enabled: familyId !== null && id !== null,
  });
  const data: RecipeDetail | null | undefined = recipe.data;
  const [choices, setChoices] = useState<RecipeChoices | null>(null);
  useEffect(() => {
    if (!data || !userId) return;
    let live = true;
    void readChoices(deviceStorage, userId, data.id).then((stored) => {
      if (live) setChoices(startingChoices(stored, data, servingsMax(data.serves)));
    });
    return () => {
      live = false;
    };
  }, [data, userId]);
  const cooking = useCookingSettings(data?.overrides);
  const save = (next: RecipeChoices) => (data ? writeChoices(deviceStorage, userId, data.id, next) : Promise.resolve());
  return { recipe: data && !data.deleted_at ? data : null, choices, cooking, tracker, save };
}
