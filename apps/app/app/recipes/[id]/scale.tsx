import { router } from 'expo-router';
import { ScaleSheet } from '../../../components/recipes/ScaleSheet';
import { useRecipeSheet } from '../../../lib/use-recipe-sheet';

/** /recipes/[id]/scale (spec 013): Scale by an ingredient, a sheet over the recipe page. */
export default function ScaleRoute() {
  const { recipe, choices, cooking, tracker, save } = useRecipeSheet();
  if (!recipe || !choices) return null;
  return (
    <ScaleSheet
      recipe={recipe}
      choices={choices}
      settings={cooking}
      tracker={tracker}
      onApply={(scaledBy) => void save({ ...choices, scaledBy }).then(() => router.back())}
      onClose={() => router.back()}
    />
  );
}
