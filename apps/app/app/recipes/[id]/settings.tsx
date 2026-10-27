import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { RecipeSettings } from '../../../components/recipes/RecipeSettings';
import { useFamilySettings } from '../../../lib/family-settings';
import { useOnline } from '../../../lib/online';
import { loadRecipe, recipeKey } from '../../../lib/recipe';
import { changeRecipeOverrides } from '../../../lib/recipe-settings';
import { useDeleteRecipe } from '../../../lib/use-delete-recipe';
import { useSession } from '../../../lib/session';

/**
 * /recipes/[id]/settings (OC-RecipeSettings, specs 017 and 027). Deleted (018), it closes everything
 * over Recipes, which shows "Recipe deleted · Undo".
 */
export default function RecipeSettingsRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const parsed = z.uuid().safeParse(params.id);
  const id = parsed.success ? parsed.data : null;
  const { state, client, tracker } = useSession();
  const familyId = state.status === 'ready' ? state.family.id : null;
  const deleteRecipe = useDeleteRecipe(client, tracker, familyId ?? '');
  const queryClient = useQueryClient();
  const family = useFamilySettings();
  const online = useOnline();
  const recipe = useQuery({
    queryKey: recipeKey(familyId ?? '', id ?? ''),
    queryFn: () => (id ? loadRecipe(client, id) : null),
    enabled: familyId !== null && id !== null,
  });
  const back = () => (router.canGoBack() ? router.back() : router.replace((id ? `/recipes/${id}` : '/recipes') as Href));
  const edit = (query: string) => {
    if (id) router.push(`/recipes/${id}/edit?${query}` as Href);
  };
  return (
    <RecipeSettings
      recipe={id ? recipe.data : null}
      failed={recipe.isError && recipe.data === undefined}
      onRetry={() => void recipe.refetch()}
      onBack={back}
      onEditRecipe={() => edit('section=details')}
      onEditVariants={(variant) => edit(variant ? `section=variants&variant=${variant}` : 'section=variants')}
      onDelete={
        id
          ? async () => {
              await deleteRecipe(id);
              router.dismissTo({ pathname: '/recipes', params: { deleted: id } });
            }
          : undefined
      }
      defaults={family.settings}
      onChangeSettings={(change) =>
        familyId && id ? changeRecipeOverrides({ queryClient, client, tracker, familyId, recipeId: id }, change) : Promise.resolve('failed' as const)
      }
      readOnly={!online}
    />
  );
}
