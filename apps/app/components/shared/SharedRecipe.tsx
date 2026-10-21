import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Callout, Card, Choice, IngredientRow, Link, Photo, PhotoPlaceholder, PillRow, PublicScreen, SegmentedControl, SettingRow, Stepper, Text } from '@cocon/ui';
import { noVariants, validChoice, type AnonymousTracker, type SharedRecipe as Shared, type Tracker, type VariantChoice } from '@cocon/schemas';
import type { UnitSystem } from '@cocon/quantity';
import { strings } from '../../strings/en';
import type { SharedLoad } from '../../lib/shared-recipe';
import { optionHint, recipeView, servingsMax, SERVINGS_MIN } from '../../lib/recipe-view';
import { RecipeStep } from '../recipes/RecipeStep';

const v = strings.sharedView;
const r = strings.recipePage;
/** Ingredients shown before "Show {n} more" (OC-SharedView). */
export const INGREDIENTS_SHOWN = 5;

export interface SharedRecipeProps {
  /** Undefined while loading; 'failed' when the endpoint couldn't be reached. */
  load: SharedLoad | 'failed' | undefined;
  /** The link's token: its timers are keyed by it (the recipe's id is never shared). */
  token: string;
  /** Anonymous only (constitution VI): the page's own events. */
  tracker: AnonymousTracker;
  /** Sends nothing: the step timers' events would otherwise be identified. */
  timerTracker: Tracker;
  onRetry: () => void;
  onSave: () => void;
  saving?: boolean;
  saveFailed?: boolean;
}

/** The public shared recipe page (spec 019 US2; design/ui/OC-SharedView.md). */
export function SharedRecipe({ load, onRetry, ...props }: SharedRecipeProps) {
  if (load === undefined) {
    return (
      <PublicScreen brand={v.brand} tag={v.viewOnly} photo={<PhotoPlaceholder className="h-full" />}>
        <View role="progressbar" aria-label={v.loading} className="gap-12">
          <View className="h-28 w-2/3 rounded-xs bg-surface-soft" />
          {[0, 1, 2].map((n) => (
            <View key={n} className="h-control-md rounded-md bg-surface-soft" />
          ))}
        </View>
      </PublicScreen>
    );
  }
  if (load === 'failed') {
    return (
      <PublicScreen brand={v.brand} tag={v.viewOnly}>
        <Text variant="titleLg" role="heading" aria-level={1}>
          {v.loadFailedTitle}
        </Text>
        <Text color="ink-muted">{v.loadFailedBody}</Text>
        <Button label={v.retry} variant="soft" onPress={onRetry} />
      </PublicScreen>
    );
  }
  if (load.kind === 'not_shared') {
    return (
      <PublicScreen brand={v.brand} tag={v.viewOnly}>
        <Text variant="titleLg" role="heading" aria-level={1}>
          {v.stoppedTitle}
        </Text>
        <Text color="ink-muted">{v.stoppedBody}</Text>
      </PublicScreen>
    );
  }
  return <Loaded recipe={load.recipe} photoUrls={load.photoUrls} {...props} />;
}

function Loaded({
  recipe,
  photoUrls,
  token,
  tracker,
  timerTracker,
  onSave,
  saving,
  saveFailed,
}: Omit<SharedRecipeProps, 'load' | 'onRetry'> & { recipe: Shared; photoUrls: Record<string, string> }) {
  // FR-003: opens in metric; servings, units and variants live on this page only.
  const [servings, setServings] = useState(recipe.serves);
  const [system, setSystem] = useState<UnitSystem>('metric');
  const [picked, setPicked] = useState<VariantChoice>(noVariants);
  const [showAll, setShowAll] = useState(false);
  const choice = validChoice(recipe.variants, picked);

  useEffect(() => {
    tracker.track('shared_recipe_viewed', {});
  }, [tracker]);

  const view = useMemo(() => recipeView(recipe, servings, choice, { system, scale: true }), [recipe, servings, choice, system]);
  const versions = recipe.variants.filter((x) => x.kind === 'version');
  const options = recipe.variants.filter((x) => x.kind === 'option');
  const hidden = view.ingredients.length - INGREDIENTS_SHOWN;
  const ingredients = showAll || hidden <= 0 ? view.ingredients : view.ingredients.slice(0, INGREDIENTS_SHOWN);
  const headerPhoto = recipe.photo_path ? photoUrls[recipe.photo_path] : undefined;
  const nameInText = `${recipe.name.charAt(0).toLowerCase()}${recipe.name.slice(1)}`;

  const switchUnits = (next: UnitSystem) => {
    if (next === system) return;
    setSystem(next);
    tracker.track('shared_units_toggled', { system: next });
  };

  return (
    <PublicScreen
      brand={v.brand}
      tag={v.viewOnly}
      photo={headerPhoto ? <Photo uri={headerPhoto} label={v.photo} /> : <PhotoPlaceholder initial={recipe.name.charAt(0).toUpperCase()} className="h-full" />}
    >
      <View>
        <Text size={14} weight="700" color="olive">
          {recipe.shared_by ? v.sharedBy(recipe.shared_by) : v.sharedByNobody}
        </Text>
        <Text variant="displayLg" role="heading" aria-level={1}>
          {recipe.name}
        </Text>
        {recipe.description ? (
          <Text variant="body" color="ink-muted" className="mt-6">
            {recipe.description}
          </Text>
        ) : null}
      </View>

      {recipe.variants.length > 0 ? (
        <View className="gap-10">
          <Text size={16} weight="900" role="heading" aria-level={2}>
            {r.version}
          </Text>
          {versions.length > 0 ? (
            <PillRow>
              <Choice label={r.classic} selected={choice.version === null} onPress={() => setPicked({ ...choice, version: null })} />
              {versions.map((x) => (
                <Choice key={x.id} label={x.name} selected={choice.version === x.id} onPress={() => setPicked({ ...choice, version: x.id })} />
              ))}
            </PillRow>
          ) : null}
          {options.map((x) => {
            const on = choice.options.includes(x.id);
            return (
              <SettingRow
                key={x.id}
                boxed
                label={x.name}
                hint={optionHint(x) ?? undefined}
                value={on}
                onValueChange={(next) => setPicked({ ...choice, options: next ? [...choice.options, x.id] : choice.options.filter((id) => id !== x.id) })}
              />
            );
          })}
        </View>
      ) : null}

      <Card className="gap-10 py-10 pl-16 pr-10">
        <View className="flex-row items-center justify-between gap-8">
          <Text size={16} weight="800">
            {v.servings}
          </Text>
          <Stepper
            value={servings}
            onChange={(n) => setServings(Math.min(servingsMax(recipe.serves), Math.max(SERVINGS_MIN, n)))}
            min={SERVINGS_MIN}
            max={servingsMax(recipe.serves)}
            decreaseLabel={r.fewerServings}
            increaseLabel={r.moreServings}
          />
        </View>
        <SegmentedControl
          variant="pill"
          label={v.units}
          value={system}
          onChange={switchUnits}
          segments={[
            { key: 'metric', label: r.more.metric },
            { key: 'imperial', label: r.more.imperial },
          ]}
        />
      </Card>

      <View>
        <Text size={20} weight="900" role="heading" aria-level={2} className="mb-6">
          {v.ingredients}
        </Text>
        <View role="list" aria-label={v.ingredients}>
          {ingredients.map((ing, i) => (
            <IngredientRow
              key={ing.id}
              layout="compact"
              amount={ing.amount}
              sub={ing.sub ?? undefined}
              name={ing.name}
              tag={ing.variant ? { label: r.variantTag, tone: 'sage' } : undefined}
              last={i === ingredients.length - 1}
            />
          ))}
        </View>
        {!showAll && hidden > 0 ? <Link label={v.showMore(hidden)} onPress={() => setShowAll(true)} /> : null}
      </View>

      <View className="gap-10">
        <Text size={20} weight="900" role="heading" aria-level={2}>
          {v.steps}
        </Text>
        <View role="list" aria-label={v.steps} className="gap-10">
          {view.steps.map((step, index) => (
            <View key={step.id} role="listitem">
              <RecipeStep
                step={step}
                index={index}
                recipeId={token}
                recipeName={recipe.name}
                tracker={timerTracker}
                photoUri={step.photoPath ? photoUrls[step.photoPath] : undefined}
              />
            </View>
          ))}
        </View>
      </View>

      <Card className="mt-4 gap-10 bg-ink p-18">
        <Text size={18} weight="900" color="on-olive">
          {v.promoTitle}
        </Text>
        <Text size={15} weight="600" color="on-ink">
          {v.promoBody(nameInText)}
        </Text>
        {saveFailed ? <Callout variant="warn" text={v.saveFailed} /> : null}
        <Button label={v.save} busyLabel={v.saving} busy={saving} variant="honey" block onPress={onSave} />
      </Card>
    </PublicScreen>
  );
}
