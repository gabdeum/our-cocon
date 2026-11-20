import type { ReactNode } from 'react';
import { SplitView } from '@cocon/ui';
import type { RecipeLayout } from '../../lib/recipe-layout';
import { RecipeList, type RecipeListProps } from './RecipeList';

/**
 * The recipe page's frame (spec 067 FR-005): from 960 the rail and the Recipes list beside the
 * recipe, in a framed panel; below, the recipe alone. The list stays mounted while another recipe
 * is picked (SC-002), so its search, filters and scroll stay.
 */
export function RecipeWithList({
  layout,
  list,
  rail,
  currentId,
  onPick,
  children,
}: {
  layout: RecipeLayout;
  list: Omit<RecipeListProps, 'onOpen' | 'variant' | 'currentId'>;
  rail: ReactNode;
  currentId?: string;
  /** Another recipe from the list: the route swaps it in place, no push. */
  onPick: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <SplitView rail={layout.split ? rail : undefined} list={layout.split ? <RecipeList {...list} variant="column" currentId={currentId} onOpen={onPick} /> : undefined}>
      {children}
    </SplitView>
  );
}
