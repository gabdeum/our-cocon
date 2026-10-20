import { router } from 'expo-router';
import { ConvertSheet } from '../../../components/recipes/ConvertSheet';
import { useRecipeSheet } from '../../../lib/use-recipe-sheet';

/** /recipes/[id]/convert (spec 013): the unit converter, a sheet over the recipe page. */
export default function ConvertRoute() {
  const { recipe, choices, tracker } = useRecipeSheet();
  if (!recipe || !choices) return null;
  return <ConvertSheet recipe={recipe} choices={choices} tracker={tracker} onClose={() => router.back()} />;
}
