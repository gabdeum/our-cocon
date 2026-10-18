import { StatusBanner } from '@cocon/ui';
import type { Member } from '../../lib/session';
import { strings } from '../../strings/en';

/** "Alex just changed this recipe" with Reload (spec 004 edge case), from useRecipeChangedBy. */
export function RecipeChangedBanner({ by, onReload }: { by: Member | null; onReload: () => void }) {
  if (!by) return null;
  return <StatusBanner message={strings.sync.recipeChanged(by.display_name)} actionLabel={strings.sync.reload} onAction={onReload} />;
}
