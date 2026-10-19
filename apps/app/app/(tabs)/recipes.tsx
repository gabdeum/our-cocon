import { router, type Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { RecipeList } from '../../components/recipes/RecipeList';
import { DebugFooter } from '../../components/DebugFooter';
import { config } from '../../lib/tracker';
import { loadRecipeList, recipeListKey } from '../../lib/recipes';
import { useSession } from '../../lib/session';

// The recipe page (008) and the create form (014) aren't built yet; typed routes learn them then.
const recipePage = (id: string) => `/recipes/${id}` as Href;
const newRecipe = '/recipes/new' as Href;

/** /recipes (spec 006): the family's recipes, live, searchable. */
export default function RecipesTab() {
  const { state, client, tracker } = useSession();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const list = useQuery({
    queryKey: recipeListKey(familyId ?? ''),
    queryFn: () => loadRecipeList(client),
    enabled: familyId !== null,
  });
  return (
    <RecipeList
      recipes={list.data}
      members={state.status === 'ready' ? state.members : []}
      tracker={tracker}
      failed={list.isError && !list.data}
      onRetry={() => void list.refetch()}
      onOpen={(id) => router.push(recipePage(id))}
      onNew={() => router.push(newRecipe)}
      footer={<DebugFooter config={config} />}
    />
  );
}
