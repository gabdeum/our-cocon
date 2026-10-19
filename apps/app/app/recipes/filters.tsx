import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FiltersSheet } from '../../components/recipes/FiltersSheet';
import { loadRecipeList, recipeListKey } from '../../lib/recipes';
import { filterScope, getSheetSearch, setRecipeFilters, useRecipeFilters } from '../../lib/recipe-filters';
import { useSession } from '../../lib/session';

/** /recipes/filters (spec 007): the Filters sheet over the Recipes list. */
export default function FiltersRoute() {
  const { state, client, tracker } = useSession();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const scope = filterScope(state);
  const filters = useRecipeFilters(scope);
  // The list's own query: already in the cache when the sheet opens from it.
  const list = useQuery({
    queryKey: recipeListKey(familyId ?? ''),
    queryFn: () => loadRecipeList(client),
    enabled: familyId !== null,
  });
  if (!list.data) return null;
  return (
    <FiltersSheet
      recipes={list.data}
      members={state.status === 'ready' ? state.members : []}
      query={getSheetSearch(scope)}
      filters={filters}
      tracker={tracker}
      onApply={(next) => {
        setRecipeFilters(scope, next);
        router.back();
      }}
      onClose={() => router.back()}
    />
  );
}
