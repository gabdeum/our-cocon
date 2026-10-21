import { View } from 'react-native';
import { MAX_VARIANTS } from '@cocon/schemas';
import { BackHeader, Button, Card, IconTile, Link, ListGroup, ListRow, PushedScreen, Text } from '@cocon/ui';
import { strings } from '../../strings/en';
import type { RecipeDetail } from '../../lib/recipe';
import { variantSummary, type SummaryBase } from '../../lib/recipe-variants';

const r = strings.recipeSettings;

export interface RecipeSettingsProps {
  /** Undefined while loading; null when there's no such recipe for this family. */
  recipe: RecipeDetail | null | undefined;
  failed?: boolean;
  onRetry?: () => void;
  onBack: () => void;
  /** "Edit recipe": the form at Details (032-later L25). */
  onEditRecipe: () => void;
  /** The form at Variants: all of them, one (its id), or a new one ("new"). */
  onEditVariants: (variant?: string) => void;
}

/** What the one-line summaries need from the recipe. */
function summaryBase(recipe: RecipeDetail): SummaryBase {
  const names = new Map(recipe.ingredients.map((i) => [i.id, i.name]));
  for (const v of recipe.variants)
    for (const c of v.changes) for (const i of c.type === 'swap_ingredient' ? c.with : c.type === 'add_ingredient' ? [c.ingredient] : []) names.set(i.id, i.name);
  return { ingredients: recipe.ingredients, steps: recipe.steps, names, facts: (key) => recipe.facts[key] };
}

/**
 * Recipe settings (OC-RecipeSettings): the "Edit recipe" row and the Variants list (spec 017). The
 * switches for screen, scale, thermometer and units come with spec 027.
 */
export function RecipeSettings({ recipe, failed, onRetry, onBack, onEditRecipe, onEditVariants }: RecipeSettingsProps) {
  if (recipe === undefined && !failed) {
    return (
      <PushedScreen className="gap-18">
        <BackHeader backLabel={r.back} onBack={onBack} title={r.title} />
        <View role="progressbar" aria-label={r.loading} className="gap-12">
          {[0, 1, 2].map((n) => (
            <View key={n} className="h-control-md rounded-md bg-surface-soft" />
          ))}
        </View>
      </PushedScreen>
    );
  }
  if (!recipe) {
    return (
      <PushedScreen className="gap-18">
        <BackHeader backLabel={r.back} onBack={onBack} title={r.loadFailedTitle} lead={r.loadFailedBody} />
        {onRetry ? <Button label={r.retry} variant="soft" onPress={onRetry} /> : null}
      </PushedScreen>
    );
  }
  const base = summaryBase(recipe);
  return (
    <PushedScreen className="gap-18">
      <BackHeader backLabel={recipe.name} onBack={onBack} title={r.title} lead={r.lead} />
      <ListGroup>
        <ListRow title={r.editRecipe} trailing={{ kind: 'chevron' }} onPress={onEditRecipe} last />
      </ListGroup>
      <View role="region" aria-label={r.variants} className="gap-10">
        <View className="flex-row items-baseline justify-between">
          <Text size={20} weight="900" role="heading" aria-level={2}>
            {r.variants}
          </Text>
          <Link label={r.edit} aria-label={r.editA11y} onPress={() => onEditVariants()} />
        </View>
        <Text size={14} weight="600" color="ink-muted">
          {r.variantsLead}
        </Text>
        {recipe.variants.map((v) => {
          const summary = variantSummary(v.changes, base);
          return (
            <Card key={v.id} onPress={() => onEditVariants(v.id)} accessibilityLabel={r.variantA11y(v.name, summary)} className="px-16 py-14">
              <View className="flex-row items-start gap-12">
                <IconTile icon={v.kind === 'version' ? 'swap' : 'plus'} tone={v.kind === 'version' ? 'sage' : 'honey'} />
                <View className="min-w-0 flex-1">
                  <Text size={16} weight="900">
                    {v.name}
                  </Text>
                  <Text size={14} weight="600" color="ink-muted">
                    {summary}
                  </Text>
                </View>
              </View>
            </Card>
          );
        })}
        {recipe.variants.length < MAX_VARIANTS ? <Button label={r.addVariant} variant="dashed" icon="plus" block onPress={() => onEditVariants('new')} /> : null}
      </View>
    </PushedScreen>
  );
}
