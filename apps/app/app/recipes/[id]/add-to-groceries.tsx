import { useMemo } from 'react';
import { router, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AddGroceriesSheet, type AddGroceriesApi } from '../../../components/groceries/AddGroceriesSheet';
import { addFromRecipe, recipeGroceryLines, undoAddFromRecipe } from '../../../lib/add-from-recipe';
import { groceryListKey, groceryServingsKey, loadGroceryList } from '../../../lib/groceries';
import { useRecipeSheet } from '../../../lib/use-recipe-sheet';
import { useSession } from '../../../lib/session';

/** /recipes/[id]/add-to-groceries (spec 022): pick the recipe's ingredients for the list, a sheet over the recipe page. */
export default function AddToGroceriesRoute() {
  const { recipe, choices, tracker } = useRecipeSheet();
  const { state, client } = useSession();
  const queryClient = useQueryClient();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const key = groceryListKey(familyId ?? '');
  const list = useQuery({ queryKey: key, queryFn: () => loadGroceryList(client), enabled: familyId !== null });
  const view = useMemo(() => (recipe && choices ? recipeGroceryLines(recipe, choices) : null), [recipe, choices]);
  const recipeId = recipe?.id;
  const serves = view?.serves;
  const api = useMemo<AddGroceriesApi | null>(() => {
    if (!familyId || !recipeId || serves === undefined) return null;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: groceryListKey(familyId) });
      void queryClient.invalidateQueries({ queryKey: groceryServingsKey(familyId) });
    };
    return {
      add: async (picked) => {
        const added = await addFromRecipe(client, familyId, recipeId, picked, serves);
        refresh();
        return added;
      },
      undo: async (added) => {
        const ok = await undoAddFromRecipe(client, added);
        refresh();
        return ok;
      },
    };
  }, [client, familyId, recipeId, serves, queryClient]);
  if (!recipe || !view || !api) return null;
  return (
    <AddGroceriesSheet
      recipeName={recipe.name}
      servings={view.servings}
      lines={view.lines}
      list={list.data ?? []}
      facts={recipe.facts}
      api={api}
      tracker={tracker}
      // Opened straight from a link there's nothing to go back to: the recipe page.
      onClose={() => (router.canGoBack() ? router.back() : router.replace(`/recipes/${recipe.id}` as Href))}
      onSeeList={() => router.dismissTo('/groceries')}
    />
  );
}
